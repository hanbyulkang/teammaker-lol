/**
 * Player profile builder
 *
 * Fetches account + ranked data from Riot API.
 * No caching — always fresh data. Match history removed (role inference
 * was unreliable; users set roles manually in the review panel).
 */

import type { Platform, PlayerProfile, RankedEntry, Tier, Division } from "@/types";
import * as riotClient from "@/lib/riot/client";
import { RiotApiError } from "@/lib/riot/types";
import { rankToScore, unrankedScore, computeBaseSkill } from "./rankMapping";
import { inferRoleComfort } from "./roleInference";

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

// ─── Main profile builder ─────────────────────────────────────────────────────

export async function buildPlayerProfile(
  gameName: string,
  tagLine: string,
  platform: Platform
): Promise<PlayerProfile> {
  // Step 1: Resolve Riot ID → PUUID
  const account = await riotClient.getAccountByRiotId(gameName, tagLine, platform);
  const { puuid } = account;

  // Step 2: Fetch ranked entries by PUUID
  const rankedEntries = await riotClient.getRankedEntries(puuid, platform)
    .catch(() => [] as import("@/lib/riot/types").LeagueEntryDto[]);

  // Step 3: Parse ranked data
  const soloEntry = rankedEntries.find((e) => e.queueType === "RANKED_SOLO_5x5");
  const flexEntry  = rankedEntries.find((e) => e.queueType === "RANKED_FLEX_SR");

  const soloRanked = soloEntry ? toRankedEntry(soloEntry) : null;
  const flexRanked = flexEntry  ? toRankedEntry(flexEntry)  : null;

  const soloScore = soloRanked
    ? rankToScore(soloRanked.tier, soloRanked.rank, soloRanked.leaguePoints)
    : unrankedScore();
  const flexScore = flexRanked
    ? rankToScore(flexRanked.tier, flexRanked.rank, flexRanked.leaguePoints)
    : null;

  const baseSkill = computeBaseSkill(soloScore, flexScore);

  // Step 4: Neutral role defaults — user sets roles in review panel
  const { roleComfort, primaryRole, secondaryRole } = inferRoleComfort([], baseSkill);

  return {
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
    recentMatches: [],
    topChampions: [],
    championConcentration: 0,
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Batch builder ────────────────────────────────────────────────────────────

export async function buildPlayerProfiles(
  players: { gameName: string; tagLine: string }[],
  platform: Platform
): Promise<{
  profiles: PlayerProfile[];
  errors: { riotId: string; message: string }[];
}> {
  // 2 API calls per player (account + ranked) — safe to run all 10 in parallel
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
      let message = "플레이어 정보를 불러올 수 없습니다";
      if (err instanceof RiotApiError) {
        if (err.statusCode === 404) message = "플레이어를 찾을 수 없습니다";
        else if (err.statusCode === 429) message = "요청 한도 초과 — 잠시 후 다시 시도해주세요";
        else if (err.statusCode === 403) message = "API 키가 만료되었습니다";
        else message = `Riot API 오류 (${err.statusCode})`;
      }
      errors.push({ riotId, message });
    }
  }

  return { profiles, errors };
}
