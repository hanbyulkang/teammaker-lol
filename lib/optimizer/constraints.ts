/**
 * Constraint validation and resolution
 *
 * Supports:
 *   TOGETHER: both players must be on the same team
 *   OPPOSITE: both players must be on different teams
 *
 * Algorithm:
 *   1. Union-Find for TOGETHER groups → each group must fit in one team (≤5)
 *   2. Validate OPPOSITE constraints don't conflict with TOGETHER groups
 *   3. During split generation, filter splits that violate any constraint
 */

import type { TeamConstraint } from "@/types";

// ─── Union-Find ───────────────────────────────────────────────────────────────

class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return;

    const rankX = this.rank.get(rx) ?? 0;
    const rankY = this.rank.get(ry) ?? 0;

    if (rankX < rankY) {
      this.parent.set(rx, ry);
    } else if (rankX > rankY) {
      this.parent.set(ry, rx);
    } else {
      this.parent.set(ry, rx);
      this.rank.set(rx, rankX + 1);
    }
  }

  /** Get all nodes grouped by their root */
  groups(nodes: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const node of nodes) {
      const root = this.find(node);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push(node);
    }
    return groups;
  }
}

// ─── Constraint validation ────────────────────────────────────────────────────

export interface ConstraintValidationResult {
  valid: boolean;
  errors: string[];
  /** TOGETHER groups: each group must be on same team */
  togetherGroups: string[][];
  /** OPPOSITE pairs after resolving groups */
  oppositePairs: [string, string][];
}

/**
 * Validate all constraints for a player set.
 * Returns structured result with any violations detected.
 */
export function validateConstraints(
  puuids: string[],
  constraints: TeamConstraint[]
): ConstraintValidationResult {
  const errors: string[] = [];
  const uf = new UnionFind();

  // Build TOGETHER groups
  for (const c of constraints) {
    if (c.type === "TOGETHER") {
      uf.union(c.puuidA, c.puuidB);
    }
  }

  const groups = uf.groups(puuids);
  const togetherGroups = Array.from(groups.values()).filter(
    (g) => g.length > 1
  );

  // Validate no TOGETHER group exceeds 5 members
  for (const group of togetherGroups) {
    if (group.length > 5) {
      errors.push(
        `${group.length} players are constrained to be together, but a team only has 5 slots.`
      );
    }
  }

  // Resolve OPPOSITE constraints to group-level
  const oppositePairs: [string, string][] = [];
  for (const c of constraints) {
    if (c.type !== "OPPOSITE") continue;
    const rootA = uf.find(c.puuidA);
    const rootB = uf.find(c.puuidB);

    if (rootA === rootB) {
      // Two players in the same TOGETHER group are also constrained OPPOSITE → impossible
      errors.push(
        `Players "${c.puuidA.slice(0, 8)}..." and "${c.puuidB.slice(0, 8)}..." must be together AND opposite — impossible.`
      );
    } else {
      oppositePairs.push([rootA, rootB]);
    }
  }

  // Check for contradictory OPPOSITE constraints forming a cycle
  // (e.g., A opp B, B opp C, A opp C → one of three must be on same team as another)
  // For 5v5, this is only a problem if 3+ "groups" must all be on opposite teams
  // We do a simple reachability check
  const oppositeConflict = detectOppositeConflict(
    oppositePairs,
    Array.from(groups.keys())
  );
  if (oppositeConflict) {
    errors.push(
      "The opposite-team constraints form a contradiction that cannot be satisfied."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    togetherGroups,
    oppositePairs,
  };
}

/**
 * Quick check: can we 2-color the "opposite" graph?
 * Returns true if there is a conflict (odd cycle).
 */
function detectOppositeConflict(
  pairs: [string, string][],
  nodes: string[]
): boolean {
  const adj = new Map<string, string[]>();
  for (const node of nodes) adj.set(node, []);
  for (const [a, b] of pairs) {
    adj.get(a)?.push(b);
    adj.get(b)?.push(a);
  }

  const color = new Map<string, 0 | 1>();
  for (const start of nodes) {
    if (color.has(start)) continue;
    // BFS 2-coloring
    const queue = [start];
    color.set(start, 0);
    while (queue.length > 0) {
      const node = queue.shift()!;
      const c = color.get(node)!;
      for (const neighbor of adj.get(node) ?? []) {
        if (!color.has(neighbor)) {
          color.set(neighbor, c === 0 ? 1 : 0);
          queue.push(neighbor);
        } else if (color.get(neighbor) === c) {
          return true; // conflict
        }
      }
    }
  }
  return false;
}

// ─── Split validation ─────────────────────────────────────────────────────────

/**
 * Check whether a specific team split (set of 5 PUUIDs) satisfies all constraints.
 */
export function splitSatisfiesConstraints(
  teamAPuuids: Set<string>,
  constraints: TeamConstraint[],
  uf: { find: (x: string) => string }
): boolean {
  for (const c of constraints) {
    const aInA = teamAPuuids.has(c.puuidA);
    const bInA = teamAPuuids.has(c.puuidB);

    if (c.type === "TOGETHER") {
      if (aInA !== bInA) return false; // must be on same team
    } else {
      // OPPOSITE
      if (aInA === bInA) return false; // must be on different teams
    }
  }
  return true;
}

/**
 * Export a reusable UnionFind built from TOGETHER constraints.
 * Used by the optimizer for fast split validation.
 */
export function buildUnionFind(
  puuids: string[],
  constraints: TeamConstraint[]
): UnionFind {
  const uf = new UnionFind();
  for (const puuid of puuids) uf.find(puuid); // register all nodes
  for (const c of constraints) {
    if (c.type === "TOGETHER") uf.union(c.puuidA, c.puuidB);
  }
  return uf;
}
