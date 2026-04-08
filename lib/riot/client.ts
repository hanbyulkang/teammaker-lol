/**
 * Riot API client
 *
 * All methods throw RiotApiError on non-2xx responses.
 * Callers are responsible for caching; this module only handles HTTP.
 */

import type { Platform } from "@/types";
import {
  PLATFORM_TO_REGION,
  PLATFORM_BASE_URL,
  REGION_BASE_URL,
  RECENT_MATCH_COUNT,
  ROLE_INFERENCE_QUEUE_IDS,
} from "./constants";
import type {
  RiotAccountDto,
  SummonerDto,
  LeagueEntryDto,
  MatchDto,
  ChampionMasteryDto,
} from "./types";
import { RiotApiError } from "./types";

function getApiKey(): string {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error("RIOT_API_KEY is not set");
  return key;
}

async function riotFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "X-Riot-Token": getApiKey() },
    next: { revalidate: 0 }, // never use Next.js cache for Riot calls; we manage our own
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new RiotApiError(429, "Rate limit exceeded");
    }
    if (res.status === 404) {
      throw new RiotApiError(404, "Not found");
    }
    if (res.status === 403) {
      throw new RiotApiError(403, "Invalid or expired API key");
    }
    throw new RiotApiError(res.status, `Riot API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Account API ─────────────────────────────────────────────────────────────

/** Resolve a Riot ID (gameName + tagLine) to a full account DTO */
export async function getAccountByRiotId(
  gameName: string,
  tagLine: string,
  platform: Platform
): Promise<RiotAccountDto> {
  const region = PLATFORM_TO_REGION[platform];
  const url = `${REGION_BASE_URL(region)}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return riotFetch<RiotAccountDto>(url);
}

/** Look up an account by PUUID */
export async function getAccountByPuuid(
  puuid: string,
  platform: Platform
): Promise<RiotAccountDto> {
  const region = PLATFORM_TO_REGION[platform];
  const url = `${REGION_BASE_URL(region)}/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`;
  return riotFetch<RiotAccountDto>(url);
}

// ─── Summoner API ─────────────────────────────────────────────────────────────

/** Get summoner data by PUUID (platform-specific) */
export async function getSummonerByPuuid(
  puuid: string,
  platform: Platform
): Promise<SummonerDto> {
  const url = `${PLATFORM_BASE_URL(platform)}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
  return riotFetch<SummonerDto>(url);
}

// ─── League API ───────────────────────────────────────────────────────────────

/** Get ranked entries for a player by PUUID */
export async function getRankedEntries(
  puuid: string,
  platform: Platform
): Promise<LeagueEntryDto[]> {
  const url = `${PLATFORM_BASE_URL(platform)}/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;
  return riotFetch<LeagueEntryDto[]>(url);
}

// ─── Match API ────────────────────────────────────────────────────────────────

/** Get recent match IDs for a PUUID, filtered to relevant queue types */
export async function getRecentMatchIds(
  puuid: string,
  platform: Platform,
  count: number = RECENT_MATCH_COUNT
): Promise<string[]> {
  const region = PLATFORM_TO_REGION[platform];
  // Fetch from solo/flex/normal draft only
  const queueIds = Array.from(ROLE_INFERENCE_QUEUE_IDS);
  // Fetch without queue filter and take top N; Riot returns sorted newest first
  const url = `${REGION_BASE_URL(region)}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?count=${count}`;
  return riotFetch<string[]>(url);
}

/** Get full match details */
export async function getMatch(
  matchId: string,
  platform: Platform
): Promise<MatchDto> {
  const region = PLATFORM_TO_REGION[platform];
  const url = `${REGION_BASE_URL(region)}/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
  return riotFetch<MatchDto>(url);
}

// ─── Champion Mastery API ─────────────────────────────────────────────────────

/** Get top N champion masteries for a PUUID */
export async function getTopChampionMasteries(
  puuid: string,
  platform: Platform,
  count: number = 10
): Promise<ChampionMasteryDto[]> {
  const url = `${PLATFORM_BASE_URL(platform)}/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/top?count=${count}`;
  return riotFetch<ChampionMasteryDto[]>(url);
}
