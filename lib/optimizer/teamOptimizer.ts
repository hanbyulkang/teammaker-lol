/**
 * Team optimizer — main entry point
 *
 * Algorithm overview:
 *  1. Validate constraints (impossible constraint detection)
 *  2. Enumerate all valid C(10,5) = 252 team splits
 *  3. Filter splits that violate hard constraints
 *  4. For each valid split, find the best role assignment (5! = 120 per team)
 *  5. Score each split on:
 *       a) strength gap (primary objective — minimize)
 *       b) total role quality (secondary — maximize)
 *  6. Return the best result with explanation
 *
 * Total work: up to 252 × 120 × 120 ≈ 3.6M role evaluations.
 * In practice, constraints prune many splits, making this very fast.
 *
 * Fairness philosophy:
 *   Slightly uneven raw rank totals with good role coverage beats
 *   mathematically equal totals with heavy autofill.
 *   Role quality is factored in after balance as a tiebreaker.
 */

import type {
  PlayerProfile,
  TeamConstraint,
  TeamGenerationResult,
  TeamComposition,
} from "@/types";
import {
  validateConstraints,
  splitSatisfiesConstraints,
  buildUnionFind,
} from "./constraints";
import {
  buildTeamComposition,
  computeBalanceScore,
  generateExplanation,
} from "./scorer";

// ─── Main optimizer ───────────────────────────────────────────────────────────

export interface OptimizerResult {
  result: TeamGenerationResult;
}

export interface OptimizerError {
  error: string;
  details?: string[];
}

export type OptimizerOutput = OptimizerResult | OptimizerError;

export function isOptimizerError(
  output: OptimizerOutput
): output is OptimizerError {
  return "error" in output;
}

/**
 * Generate the best balanced 5v5 team split for 10 players.
 */
export function generateTeams(
  players: PlayerProfile[],
  constraints: TeamConstraint[]
): OptimizerOutput {
  if (players.length !== 10) {
    return {
      error: `Need exactly 10 players. Got ${players.length}.`,
    };
  }

  // Step 1: Validate constraints
  const validation = validateConstraints(
    players.map((p) => p.puuid),
    constraints
  );
  if (!validation.valid) {
    return {
      error: "Constraint validation failed",
      details: validation.errors,
    };
  }

  // Step 2: Build union-find for fast constraint checking
  const uf = buildUnionFind(
    players.map((p) => p.puuid),
    constraints
  );

  // Step 3: Enumerate all C(10,5) = 252 splits
  const combinations = getCombinations(players, 5);
  let candidatesEvaluated = 0;
  let bestResult: ScoredSplit | null = null;

  for (const teamAPlayers of combinations) {
    const teamAPuuids = new Set(teamAPlayers.map((p) => p.puuid));
    const teamBPlayers = players.filter((p) => !teamAPuuids.has(p.puuid));

    // Symmetry: only evaluate half the splits (A vs B = B vs A)
    if (teamAPlayers[0].puuid > teamBPlayers[0].puuid) continue;

    // Step 4: Check constraints
    if (!splitSatisfiesConstraints(teamAPuuids, constraints, uf)) continue;

    // Step 5: Find best role assignment for each team
    const teamA = buildTeamComposition(teamAPlayers);
    const teamB = buildTeamComposition(teamBPlayers);

    const strengthGap = Math.abs(teamA.totalStrength - teamB.totalStrength);
    const totalRoleQuality = teamA.totalStrength + teamB.totalStrength;
    const balanceScore = computeBalanceScore(
      teamA.totalStrength,
      teamB.totalStrength
    );

    const offRoleCount = [
      ...teamA.roleAssignments,
      ...teamB.roleAssignments,
    ].filter((r) => r.isOffRole).length;

    candidatesEvaluated++;

    const scored: ScoredSplit = {
      teamA,
      teamB,
      strengthGap,
      totalRoleQuality,
      balanceScore,
      offRoleCount,
    };

    if (betterThan(scored, bestResult)) {
      bestResult = scored;
    }
  }

  if (!bestResult) {
    return {
      error: "No valid team split found. Your constraints may be too restrictive.",
      details: validation.errors,
    };
  }

  // Step 6: Generate explanation
  const explanation = generateExplanation(
    bestResult.teamA,
    bestResult.teamB,
    bestResult.strengthGap,
    bestResult.balanceScore,
    bestResult.offRoleCount
  );

  const result: TeamGenerationResult = {
    teamA: bestResult.teamA,
    teamB: bestResult.teamB,
    strengthGap: Math.round(bestResult.strengthGap),
    balanceScore: bestResult.balanceScore,
    offRoleCount: bestResult.offRoleCount,
    explanation,
    satisfiedConstraints: constraints,
    candidatesEvaluated,
  };

  return { result };
}

// ─── Comparison logic ─────────────────────────────────────────────────────────

interface ScoredSplit {
  teamA: TeamComposition;
  teamB: TeamComposition;
  strengthGap: number;
  totalRoleQuality: number;
  balanceScore: number;
  offRoleCount: number;
}

/**
 * Returns true if candidate is strictly better than current best.
 *
 * Ordering:
 *  1. Minimize strengthGap (primary — balance matters most)
 *  2. Minimize offRoleCount (secondary — autofill hurts game quality)
 *  3. Maximize totalRoleQuality (tiebreaker — prefer higher comfort)
 */
function betterThan(
  candidate: ScoredSplit,
  current: ScoredSplit | null
): boolean {
  if (!current) return true;

  // Primary: lower strength gap wins
  const GAP_THRESHOLD = 20; // treat gaps within 20 pts as "equal" for tiebreaking
  const gapDiff = current.strengthGap - candidate.strengthGap;

  if (gapDiff > GAP_THRESHOLD) return true;
  if (gapDiff < -GAP_THRESHOLD) return false;

  // Secondary: fewer off-role assignments
  if (candidate.offRoleCount < current.offRoleCount) return true;
  if (candidate.offRoleCount > current.offRoleCount) return false;

  // Tiebreaker: higher total role quality
  return candidate.totalRoleQuality > current.totalRoleQuality;
}

// ─── Combination generator ────────────────────────────────────────────────────

/**
 * Generate all C(n, k) combinations from an array.
 * C(10, 5) = 252 — fast enough for synchronous execution.
 */
function getCombinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];

  function helper(start: number, current: T[]): void {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      helper(i + 1, current);
      current.pop();
    }
  }

  helper(0, []);
  return result;
}
