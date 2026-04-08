/**
 * Role inference from recent match history
 *
 * Analyzes individualPosition / teamPosition fields from recent matches
 * to estimate a player's role comfort profile.
 *
 * Role comfort scoring:
 *   - Primary role (most frequent): large comfort bonus
 *   - Secondary role: medium comfort bonus
 *   - Tertiary+ roles: autofill penalty
 *
 * These bonuses/penalties are added to base_skill to compute role_score.
 */

import type { Role, RoleComfort, MatchSummary } from "@/types";
import { normalizePosition } from "@/lib/utils";
import { MIN_MATCHES_FOR_INFERENCE, ROLE_INFERENCE_QUEUE_IDS } from "@/lib/riot/constants";

const ALL_ROLES: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

/** Comfort bonus added to base_skill when a player is on their best role */
export const ROLE_COMFORT_BONUSES: Record<
  "primary" | "secondary" | "off",
  number
> = {
  primary: 200,   // on their best role: significant boost
  secondary: 80,  // on second-best role: moderate boost
  off: -150,      // autofill / off-role: clear penalty
};

/**
 * Derive role comfort profile from match summaries.
 * Returns role comfort for ALL 5 roles, sorted by score descending.
 */
export function inferRoleComfort(
  matches: MatchSummary[],
  baseSkill: number
): {
  roleComfort: RoleComfort[];
  primaryRole: Role;
  secondaryRole: Role;
} {
  // Filter to relevant queue types
  const relevantMatches = matches.filter((m) =>
    ROLE_INFERENCE_QUEUE_IDS.has(m.queueId)
  );

  const roleCounts: Record<Role, number> = {
    TOP: 0,
    JUNGLE: 0,
    MID: 0,
    ADC: 0,
    SUPPORT: 0,
  };

  // Count games per role (prefer teamPosition, fall back to individualPosition)
  for (const match of relevantMatches) {
    const role =
      normalizePosition(match.teamPosition) ||
      normalizePosition(match.individualPosition);
    if (role) roleCounts[role]++;
  }

  const totalRoled = Object.values(roleCounts).reduce((a, b) => a + b, 0);

  // Fall back to uniform distribution if not enough data
  const hasEnoughData = totalRoled >= MIN_MATCHES_FOR_INFERENCE;

  // When there's not enough data, return neutral scores (no bonus/penalty)
  // and signal unknown role via FILL-like defaults — UI should prompt manual input
  if (!hasEnoughData) {
    const neutralScore = baseSkill;
    const roleComfort: RoleComfort[] = ALL_ROLES.map((role) => ({
      role,
      frequency: 0.2,
      score: neutralScore,
    }));
    return { roleComfort, primaryRole: "MID", secondaryRole: "SUPPORT" };
  }

  const sorted = (Object.entries(roleCounts) as [Role, number][]).sort(
    (a, b) => b[1] - a[1]
  );

  const roleComfort: RoleComfort[] = ALL_ROLES.map((role) => {
    const count = roleCounts[role];
    const frequency = count / totalRoled;

    let comfortTier: "primary" | "secondary" | "off" = "off";
    if (sorted[0][0] === role) comfortTier = "primary";
    else if (sorted[1][0] === role && sorted[1][1] > 0) comfortTier = "secondary";

    const bonus = ROLE_COMFORT_BONUSES[comfortTier];
    const score = Math.max(0, baseSkill + bonus);

    return { role, frequency, score };
  });

  // Sort by score descending for easy access
  roleComfort.sort((a, b) => b.score - a.score);

  const primaryRole = roleComfort[0].role;
  const secondaryRole = roleComfort[1].role;

  return { roleComfort, primaryRole, secondaryRole };
}

/**
 * Get the role comfort score for a specific role assignment.
 * Used during optimization.
 */
export function getRoleScore(
  baseSkill: number,
  roleComfort: RoleComfort[],
  assignedRole: Role
): number {
  const comfort = roleComfort.find((rc) => rc.role === assignedRole);
  return comfort?.score ?? Math.max(0, baseSkill + ROLE_COMFORT_BONUSES.off);
}

/**
 * Determine if a role assignment is the player's primary, secondary, or off-role.
 * Uses roleComfort scores to detect off-role: if a role's score is significantly
 * below the max (gap > 200pts), it means it has an off-role penalty (-150).
 * This correctly handles multi-role selections (not just primary/secondary).
 */
export function classifyRoleAssignment(
  roleComfort: RoleComfort[],
  assignedRole: Role,
  primaryRole: Role,
  secondaryRole: Role
): { isPrimaryRole: boolean; isSecondaryRole: boolean; isOffRole: boolean } {
  const maxScore = Math.max(...roleComfort.map((rc) => rc.score));
  const assignedScore = roleComfort.find((rc) => rc.role === assignedRole)?.score ?? 0;
  // Gap between playable (+80) and off-role (-150) is 230pts; use 200 as threshold
  const isOffRole = maxScore - assignedScore > 200;

  return {
    isPrimaryRole: assignedRole === primaryRole,
    isSecondaryRole: assignedRole === secondaryRole && assignedRole !== primaryRole,
    isOffRole,
  };
}

/**
 * Analyze champion pool concentration.
 * Returns 0 (diverse) to 1 (OTP).
 */
export function computeChampionConcentration(matches: MatchSummary[]): number {
  if (matches.length === 0) return 0;

  const champCounts: Record<string, number> = {};
  for (const m of matches) {
    champCounts[m.championName] = (champCounts[m.championName] ?? 0) + 1;
  }

  const counts = Object.values(champCounts).sort((a, b) => b - a);
  const topChampGames = counts[0] ?? 0;

  // Concentration = fraction of games on single most-played champion
  return topChampGames / matches.length;
}

/**
 * Get top N champion names by play frequency.
 */
export function getTopChampions(
  matches: MatchSummary[],
  n: number = 3
): string[] {
  const counts: Record<string, number> = {};
  for (const m of matches) {
    counts[m.championName] = (counts[m.championName] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name]) => name);
}
