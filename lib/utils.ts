import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a Riot ID display string */
export function formatRiotId(gameName: string, tagLine: string): string {
  return `${gameName}#${tagLine}`;
}

/** Parse "gameName#tagLine" → { gameName, tagLine } or null */
export function parseRiotId(
  input: string
): { gameName: string; tagLine: string } | null {
  const trimmed = input.trim();
  const lastHash = trimmed.lastIndexOf("#");
  if (lastHash === -1 || lastHash === 0 || lastHash === trimmed.length - 1) {
    return null;
  }
  return {
    gameName: trimmed.slice(0, lastHash).trim(),
    tagLine: trimmed.slice(lastHash + 1).trim(),
  };
}

/** Parse multi-line Riot ID input, returning parsed ids + errors */
export function parseRiotIdList(raw: string): {
  valid: { gameName: string; tagLine: string; raw: string }[];
  errors: { raw: string; reason: string }[];
} {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const valid: { gameName: string; tagLine: string; raw: string }[] = [];
  const errors: { raw: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const parsed = parseRiotId(line);
    if (!parsed) {
      errors.push({ raw: line, reason: "format" });
      continue;
    }
    const key = `${parsed.gameName.toLowerCase()}#${parsed.tagLine.toLowerCase()}`;
    if (seen.has(key)) {
      errors.push({ raw: line, reason: "duplicate" });
      continue;
    }
    seen.add(key);
    valid.push({ ...parsed, raw: line });
  }

  return { valid, errors };
}

/** Clamp a number to a range */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Format a win rate as a percentage string */
export function formatWinRate(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "—";
  return `${Math.round((wins / total) * 100)}%`;
}

/** Format a relative time string ("5m ago") */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/** Normalize an individual match position to our Role type */
export function normalizePosition(
  pos: string
): "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT" | null {
  switch (pos?.toUpperCase()) {
    case "TOP":
      return "TOP";
    case "JUNGLE":
      return "JUNGLE";
    case "MIDDLE":
    case "MID":
      return "MID";
    case "BOTTOM":
    case "ADC":
      return "ADC";
    case "UTILITY":
    case "SUPPORT":
      return "SUPPORT";
    default:
      return null;
  }
}

/** Map numeric balance score to a label key */
export function balanceLabel(
  score: number
): "balancePerfect" | "balanceGood" | "balanceFair" | "balancePoor" {
  if (score >= 90) return "balancePerfect";
  if (score >= 75) return "balanceGood";
  if (score >= 55) return "balanceFair";
  return "balancePoor";
}

/** Generate a shareable lobby URL */
export function lobbyUrl(lobbyId: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/lobby/${lobbyId}`;
}
