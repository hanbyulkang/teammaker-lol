/**
 * Player profile builder
 *
 * Orchestrates Riot API calls → derives a full PlayerProfile.
 * Uses DB caching to avoid redundant API calls.
 *
 * Cache strategy:
 *   - CachedPlayer record with expiresAt
 *   - On cache miss: fetch from Riot API, store in DB
 *   - On cache hit: return cached data
 */

import type { Platform, PlayerProfile, RankedEntry, MatchSummary, Tier, Division } from "@/types";
import { prisma } from "@/lib/db";
import * as riotClient from "@/lib/riot/client";
import { RiotApiError } from "@/lib/riot/types";
import { PLAYER_CACHE_TTL_MS, ROLE_INFERENCE_QUEUE_IDS } from "@/lib/riot/constants";
import { rankToScore, unrankedScore, computeBaseSkill } from "./rankMapping";
import {
  inferRoleComfort,
  computeChampionConcentration,
  getTopChampions,
} from "./roleInference";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRankedEntry(entry: {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}): RankedEntry {
  return {
    queueType: entry.queueType as RankedEntry["queueType"],
    tier: entry.tier as Tier,
    rank: entry.rank as Division,
    leaguePoints: entry.leaguePoints,
    wins: entry.wins,
    losses: entry.losses,
  };
}

function toMatchSummary(
  matchDto: import("@/lib/riot/types").MatchDto,
  puuid: string
): MatchSummary | null {
  const participant = matchDto.info.participants.find(
    (p) => p.puuid === puuid
  );
  if (!participant) return null;

  return {
    matchId: matchDto.metadata.matchId,
    championName: participant.championName,
    individualPosition: participant.individualPosition,
    teamPosition: participant.teamPosition,
    win: participant.win,
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    gameDate: matchDto.info.gameCreation,
    gameDuration: matchDto.info.gameDuration,
    queueId: matchDto.info.queueId,
  };
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function getCachedProfile(
  puuid: string
): Promise<PlayerProfile | null> {
  const record = await prisma.cachedPlayer.findUnique({ where: { puuid } });
  if (!record) return null;
  if (record.expiresAt < new Date()) return null;
  return record.profileData as unknown as PlayerProfile;
}

async function setCachedProfile(profile: PlayerProfile): Promise<void> {
  const expiresAt = new Date(Date.now() + PLAYER_CACHE_TTL_MS);
  await prisma.cachedPlayer.upsert({
    where: { puuid: profile.puuid },
    create: {
      puuid: profile.puuid,
      gameName: profile.gameName,
      tagLine: profile.tagLine,
      platform: profile.platform,
      profileData: profile as unknown as import("@prisma/client").Prisma.InputJsonValue,
      expiresAt,
    },
    update: {
      gameName: profile.gameName,
      tagLine: profile.tagLine,
      profileData: profile as unknown as import("@prisma/client").Prisma.InputJsonValue,
      fetchedAt: new Date(),
      expiresAt,
    },
  });
}

// ─── Main profile builder ─────────────────────────────────────────────────────

/**
 * Build a complete PlayerProfile for a given Riot ID + platform.
 * Uses cache when available; fetches from Riot API on miss.
 *
 * Throws RiotApiError for player not found, rate limit, etc.
 */
export async function buildPlayerProfile(
  gameName: string,
  tagLine: string,
  platform: Platform
): Promise<PlayerProfile> {
  // Step 1: Resolve Riot ID → PUUID
  const account = await riotClient.getAccountByRiotId(
    gameName,
    tagLine,
    platform
  );
  const { puuid } = account;

  // Step 2: Check cache by PUUID
  const cached = await getCachedProfile(puuid);
  if (cached) return cached;

  // Step 3: Fetch all Riot data in parallel where possible
  const [summoner, matchIds] = await Promise.all([
    riotClient.getSummonerByPuuid(puuid, platform),
    riotClient.getRecentMatchIds(puuid, platform).catch(() => [] as string[]),
  ]);

  const [rankedEntries, matchDetails] = await Promise.all([
    riotClient.getRankedEntries(summoner.id, platform).catch(() => []),
    // Fetch up to 15 matches (throttle to avoid rate limits on dev keys)
    Promise.all(
      matchIds.slice(0, 15).map((id) =>
        riotClient.getMatch(id, platform).catch(() => null)
      )
    ),
  ]);

  // Step 4: Parse ranked data
  const soloEntry = rankedEntries.find(
    (e) => e.queueType === "RANKED_SOLO_5x5"
  );
  const flexEntry = rankedEntries.find(
    (e) => e.queueType === "RANKED_FLEX_SR"
  );

  const soloRanked = soloEntry ? toRankedEntry(soloEntry) : null;
  const flexRanked = flexEntry ? toRankedEntry(flexEntry) : null;

  const soloScore = soloRanked
    ? rankToScore(soloRanked.tier, soloRanked.rank, soloRanked.leaguePoints)
    : unrankedScore();

  const flexScore = flexRanked
    ? rankToScore(flexRanked.tier, flexRanked.rank, flexRanked.leaguePoints)
    : null;

  const baseSkill = computeBaseSkill(soloScore, flexScore);

  // Step 5: Parse match summaries
  const recentMatches: MatchSummary[] = matchDetails
    .filter(Boolean)
    .map((m) => toMatchSummary(m!, puuid))
    .filter((m): m is MatchSummary => m !== null);

  // Step 6: Infer role profile
  const { roleComfort, primaryRole, secondaryRole } = inferRoleComfort(
    recentMatches,
    baseSkill
  );

  // Step 7: Champion analysis
  const topChampions = getTopChampions(recentMatches, 3);
  const championConcentration = computeChampionConcentration(recentMatches);

  // Step 8: Assemble profile
  const profile: PlayerProfile = {
    puuid,
    gameName: account.gameName,
    tagLine: account.tagLine,
    platform,
    soloRanked,
    flexRanked,
    baseSkill,
    primaryRole,
    secondaryRole,
    roleComfort,
    recentMatches: recentMatches.slice(0, 10), // store last 10 for display
    topChampions,
    championConcentration,
    fetchedAt: new Date().toISOString(),
  };

  // Step 9: Cache result
  await setCachedProfile(profile);

  return profile;
}

/**
 * Build profiles for a list of Riot IDs.
 * Returns partial results — errors are collected separately.
 */
export async function buildPlayerProfiles(
  players: { gameName: string; tagLine: string }[],
  platform: Platform
): Promise<{
  profiles: PlayerProfile[];
  errors: { riotId: string; message: string }[];
}> {
  const results = await Promise.allSettled(
    players.map((p) => buildPlayerProfile(p.gameName, p.tagLine, platform))
  );

  const profiles: PlayerProfile[] = [];
  const errors: { riotId: string; message: string }[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const riotId = `${players[i].gameName}#${players[i].tagLine}`;

    if (result.status === "fulfilled") {
      profiles.push(result.value);
    } else {
      const err = result.reason;
      let message = "Failed to load player data";
      if (err instanceof RiotApiError) {
        if (err.statusCode === 404) message = "Player not found";
        else if (err.statusCode === 429) message = "Rate limit exceeded — try again shortly";
        else if (err.statusCode === 403) message = "API key invalid or expired";
        else message = `Riot API error (${err.statusCode})`;
      }
      errors.push({ riotId, message });
    }
  }

  return { profiles, errors };
}
