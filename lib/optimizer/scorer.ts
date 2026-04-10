/**
 * Team scoring
 *
 * For a given team of 5 players with a specific role assignment,
 * compute the team's total strength and individual role scores.
 *
 * Role score = base_skill + role_comfort_bonus
 * (The comfort bonuses are embedded in roleComfort[].score from inferRoleComfort)
 */

import type {
  PlayerProfile,
  Role,
  RoleAssignment,
  TeamComposition,
} from "@/types";
import { getRoleScore, classifyRoleAssignment } from "@/lib/analysis/roleInference";

const ALL_ROLES: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

// ─── Role assignment optimizer ─────────────────────────────────────────────────

/**
 * Find the optimal role assignment for a team of exactly 5 players.
 * Brute-force over 5! = 120 permutations.
 *
 * Returns the assignment that maximizes total team role score.
 */
export function findBestRoleAssignment(players: PlayerProfile[]): {
  roleAssignments: RoleAssignment[];
  totalStrength: number;
} {
  if (players.length !== 5) {
    throw new Error(`Expected 5 players, got ${players.length}`);
  }

  let bestStrength = -Infinity;
  let bestPerm: Role[] = [...ALL_ROLES];

  for (const perm of permutations<Role>(ALL_ROLES)) {
    let strength = 0;
    for (let i = 0; i < 5; i++) {
      strength += getRoleScore(
        players[i].baseSkill,
        players[i].roleComfort,
        perm[i]
      );
    }
    if (strength > bestStrength) {
      bestStrength = strength;
      bestPerm = perm;
    }
  }

  const roleAssignments: RoleAssignment[] = players.map((player, i) => {
    const role = bestPerm[i];
    const roleScore = getRoleScore(player.baseSkill, player.roleComfort, role);
    const cls = classifyRoleAssignment(
      player.roleComfort,
      role,
      player.primaryRole,
      player.secondaryRole
    );
    return {
      puuid: player.puuid,
      role,
      roleScore,
      ...cls,
    };
  });

  return { roleAssignments, totalStrength: bestStrength };
}

/**
 * Build a full TeamComposition from players + their best role assignment.
 */
export function buildTeamComposition(
  players: PlayerProfile[]
): TeamComposition {
  const { roleAssignments, totalStrength } = findBestRoleAssignment(players);
  return { players, roleAssignments, totalStrength };
}

// ─── Balance scoring ──────────────────────────────────────────────────────────

/**
 * Compute a 0–100 balance score from a strength gap.
 *
 * The maximum "reasonable" gap is roughly 500 points
 * (e.g., full team of Gold 4 vs Platinum 1 at every role).
 * We compress that to a 0–100 scale.
 */
export function computeBalanceScore(
  teamAStrength: number,
  teamBStrength: number
): number {
  const gap = Math.abs(teamAStrength - teamBStrength);
  const maxReasonableGap = 500;
  const score = Math.max(0, 100 - (gap / maxReasonableGap) * 100);
  return Math.round(score);
}

// ─── Explanation generator ────────────────────────────────────────────────────

/**
 * Generate human-readable explanation bullets for a result.
 */
export function generateExplanation(
  teamA: TeamComposition,
  teamB: TeamComposition,
  strengthGap: number,
  balanceScore: number,
  offRoleCount: number
): string[] {
  const lines: string[] = [];

  // Balance assessment
  if (balanceScore >= 90) {
    lines.push(`Nearly perfect balance — projected strength gap is only ${Math.round(strengthGap)} points.`);
  } else if (balanceScore >= 75) {
    lines.push(`Well-balanced split with a projected strength gap of ${Math.round(strengthGap)} points.`);
  } else if (balanceScore >= 55) {
    lines.push(`Reasonably fair split. Strength gap: ${Math.round(strengthGap)} points.`);
  } else {
    lines.push(`Some imbalance detected (gap: ${Math.round(strengthGap)} points) — this may be the best achievable split given constraints.`);
  }

  // Off-role info
  if (offRoleCount === 0) {
    lines.push("All players are assigned to their primary or secondary role.");
  } else if (offRoleCount === 1) {
    const offPlayer = [...teamA.roleAssignments, ...teamB.roleAssignments].find(
      (r) => r.isOffRole
    );
    if (offPlayer) {
      lines.push(`1 player (${offPlayer.role}) is off their preferred roles. The algorithm minimized autofill.`);
    }
  } else {
    lines.push(
      `${offRoleCount} players are off their preferred roles. This was the fairest split available.`
    );
  }

  // Team A highlights
  const teamAComfort = teamA.roleAssignments.filter(
    (r) => r.isPrimaryRole
  ).length;
  const teamBComfort = teamB.roleAssignments.filter(
    (r) => r.isPrimaryRole
  ).length;

  if (teamAComfort === 5 && teamBComfort === 5) {
    lines.push("Both teams have all 5 players on their primary roles — ideal match conditions.");
  } else {
    lines.push(
      `Team A has ${teamAComfort}/5 players on primary roles. Team B has ${teamBComfort}/5.`
    );
  }

  // Algorithm note
  lines.push("Role comfort was weighted alongside rank to find the fairest in-house matchup.");

  return lines;
}

/**
 * Swap role assignments between two players within the same team.
 * Recalculates roleScore, isOffRole, isPrimaryRole, isSecondaryRole for both.
 */
export function swapRolesInTeam(
  team: TeamComposition,
  puuid1: string,
  puuid2: string
): TeamComposition {
  const asgn1 = team.roleAssignments.find((a) => a.puuid === puuid1)!;
  const asgn2 = team.roleAssignments.find((a) => a.puuid === puuid2)!;
  const player1 = team.players.find((p) => p.puuid === puuid1)!;
  const player2 = team.players.find((p) => p.puuid === puuid2)!;

  const newAsgn1: RoleAssignment = {
    puuid: puuid1,
    role: asgn2.role,
    roleScore: getRoleScore(player1.baseSkill, player1.roleComfort, asgn2.role),
    ...classifyRoleAssignment(player1.roleComfort, asgn2.role, player1.primaryRole, player1.secondaryRole),
  };
  const newAsgn2: RoleAssignment = {
    puuid: puuid2,
    role: asgn1.role,
    roleScore: getRoleScore(player2.baseSkill, player2.roleComfort, asgn1.role),
    ...classifyRoleAssignment(player2.roleComfort, asgn1.role, player2.primaryRole, player2.secondaryRole),
  };

  const newAssignments = team.roleAssignments.map((a) => {
    if (a.puuid === puuid1) return newAsgn1;
    if (a.puuid === puuid2) return newAsgn2;
    return a;
  });

  return {
    ...team,
    roleAssignments: newAssignments,
    totalStrength: newAssignments.reduce((sum, a) => sum + a.roleScore, 0),
  };
}

// ─── Permutation utility ──────────────────────────────────────────────────────

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [[...arr]];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}
