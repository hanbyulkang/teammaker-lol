/**
 * Internal numeric rank mapping
 *
 * Converts tier/division/LP into a single comparable number.
 *
 * Scale:
 *   Iron IV (0 LP)   = 0
 *   Iron I  (100 LP) = 400
 *   Bronze IV        = 400
 *   ...
 *   Diamond I (100)  = 2800
 *   Master (0 LP)    = 2800
 *   Master (500 LP)  = 3300
 *   Grandmaster      = 2900 base (LP stacks same way)
 *   Challenger       = 3000 base
 *
 * Each tier = 400 points. Each division = 100 points. LP = 0–99 points.
 * Master/GM/Challenger have no divisions; LP is compressed to 0–400 range.
 */

import type { Tier, Division } from "@/types";

const TIER_BASE: Record<Tier, number> = {
  IRON: 0,
  BRONZE: 400,
  SILVER: 800,
  GOLD: 1200,
  PLATINUM: 1600,
  EMERALD: 2000,
  DIAMOND: 2400,
  MASTER: 2800,
  GRANDMASTER: 2800, // same base; differentiated by LP
  CHALLENGER: 2800, // same base
};

const DIVISION_OFFSET: Record<Division, number> = {
  IV: 0,
  III: 100,
  II: 200,
  I: 300,
};

/**
 * Convert tier + division + LP to internal numeric score.
 * For Master/GM/Challenger there is no division — pass "I" and actual LP.
 */
export function rankToScore(
  tier: Tier,
  division: Division | null,
  lp: number
): number {
  const base = TIER_BASE[tier];

  if (tier === "MASTER" || tier === "GRANDMASTER" || tier === "CHALLENGER") {
    // Compress LP: 0–2000+ LP maps to roughly 0–400 extra
    const lpBonus = Math.min(lp / 5, 400);
    return base + lpBonus;
  }

  const divOffset = DIVISION_OFFSET[division ?? "IV"];
  // LP adds 0–99 within a division
  const lpBonus = Math.min(lp, 99);
  return base + divOffset + lpBonus;
}

/** Return 0 for unranked players (placed at Iron IV floor) */
export function unrankedScore(): number {
  return 0;
}

/**
 * Convert a score back to a human-readable approximate rank.
 * Used for explanations and display only.
 */
export function scoreToApproxRank(score: number): string {
  if (score >= 2800) {
    if (score >= 3200) return "Challenger";
    if (score >= 3000) return "Grandmaster";
    return "Master";
  }
  if (score >= 2400) return `Diamond ${divisionFromScore(score, 2400)}`;
  if (score >= 2000) return `Emerald ${divisionFromScore(score, 2000)}`;
  if (score >= 1600) return `Platinum ${divisionFromScore(score, 1600)}`;
  if (score >= 1200) return `Gold ${divisionFromScore(score, 1200)}`;
  if (score >= 800) return `Silver ${divisionFromScore(score, 800)}`;
  if (score >= 400) return `Bronze ${divisionFromScore(score, 400)}`;
  return `Iron ${divisionFromScore(score, 0)}`;
}

function divisionFromScore(score: number, tierBase: number): string {
  const relative = score - tierBase;
  if (relative >= 300) return "I";
  if (relative >= 200) return "II";
  if (relative >= 100) return "III";
  return "IV";
}

/** Combine solo queue + flex queue into a single baseline skill estimate */
export function computeBaseSkill(
  soloScore: number,
  flexScore: number | null
): number {
  if (flexScore === null) return soloScore;
  // Solo queue is the primary signal (80% weight), flex is a minor secondary signal
  return Math.round(soloScore * 0.8 + flexScore * 0.2);
}
