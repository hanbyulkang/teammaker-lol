/**
 * Internal numeric rank mapping
 *
 * Design intent:
 *  - Iron–Emerald: uniform 400pt tier gaps (gradual progression)
 *  - Emerald → Diamond: 800pt gap (skill cliff begins here)
 *  - Diamond → Master: 1200pt gap (very strong separation)
 *  - Master / Grandmaster / Challenger: 600–800pt apart (apex tiers clearly distinct)
 *
 * Each non-apex tier = 4 divisions × 100pt + LP (0–99).
 * Apex tiers have no divisions; LP is compressed to 0–300 extra.
 *
 * Scale reference:
 *   Iron IV (0 LP)       =    0
 *   Emerald I (99 LP)    = 2399
 *   Diamond IV (0 LP)    = 2800
 *   Diamond I (99 LP)    = 3199
 *   Master (0 LP)        = 4400
 *   Grandmaster (0 LP)   = 5000
 *   Challenger (0 LP)    = 5800
 */

import type { Tier, Division } from "@/types";

const TIER_BASE: Record<Tier, number> = {
  IRON:          0,
  BRONZE:      400,
  SILVER:      800,
  GOLD:       1200,
  PLATINUM:   1600,
  EMERALD:    2000,   // Emerald I top ≈ 2399
  DIAMOND:    2800,   // +800 jump from Emerald
  MASTER:     4400,   // +1200 jump from Diamond I top
  GRANDMASTER: 5000,  // +600 from Master base
  CHALLENGER:  5800,  // +800 from GM base
};

const DIVISION_OFFSET: Record<Division, number> = {
  IV: 0,
  III: 100,
  II: 200,
  I: 300,
};

/**
 * Convert tier + division + LP to internal numeric score.
 * For Master/GM/Challenger pass division = null and actual LP.
 */
export function rankToScore(
  tier: Tier,
  division: Division | null,
  lp: number
): number {
  const base = TIER_BASE[tier];

  if (tier === "MASTER" || tier === "GRANDMASTER" || tier === "CHALLENGER") {
    // Compress LP: up to ~3000 LP → 0–300 extra
    const lpBonus = Math.min(lp / 10, 300);
    return base + lpBonus;
  }

  const divOffset = DIVISION_OFFSET[division ?? "IV"];
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
  if (score >= 5800) return "Challenger";
  if (score >= 5000) return "Grandmaster";
  if (score >= 4400) return "Master";
  if (score >= 2800) return `Diamond ${divisionFromScore(score, 2800)}`;
  if (score >= 2000) return `Emerald ${divisionFromScore(score, 2000)}`;
  if (score >= 1600) return `Platinum ${divisionFromScore(score, 1600)}`;
  if (score >= 1200) return `Gold ${divisionFromScore(score, 1200)}`;
  if (score >= 800)  return `Silver ${divisionFromScore(score, 800)}`;
  if (score >= 400)  return `Bronze ${divisionFromScore(score, 400)}`;
  return `Iron ${divisionFromScore(score, 0)}`;
}

function divisionFromScore(score: number, tierBase: number): string {
  const relative = score - tierBase;
  if (relative >= 300) return "I";
  if (relative >= 200) return "II";
  if (relative >= 100) return "III";
  return "IV";
}

/** Combine solo queue + flex queue into a single baseline skill estimate.
 *  Uses the higher of the two — represents peak rank achieved this season. */
export function computeBaseSkill(
  soloScore: number,
  flexScore: number | null
): number {
  if (flexScore === null) return soloScore;
  return Math.max(soloScore, flexScore);
}
