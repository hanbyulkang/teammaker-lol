// ─── Riot API primitives ─────────────────────────────────────────────────────

export type Platform =
  | "kr"
  | "na1"
  | "euw1"
  | "eune1"
  | "br1"
  | "la1"
  | "la2"
  | "jp1"
  | "oc1"
  | "tr1"
  | "ru"
  | "sg2"
  | "tw2"
  | "vn2"
  | "ph2";

export type Region = "americas" | "europe" | "asia" | "sea";

export type Tier =
  | "IRON"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "EMERALD"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

export type Division = "I" | "II" | "III" | "IV";

export type Role = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";

export type Queue = "RANKED_SOLO_5x5" | "RANKED_FLEX_SR";

// ─── Ranked entry ─────────────────────────────────────────────────────────────

export interface RankedEntry {
  queueType: Queue;
  tier: Tier;
  rank: Division;
  leaguePoints: number;
  wins: number;
  losses: number;
}

// ─── Match summary ─────────────────────────────────────────────────────────────

export interface MatchSummary {
  matchId: string;
  championName: string;
  individualPosition: string; // JUNGLE, TOP, MIDDLE, BOTTOM, UTILITY
  teamPosition: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  gameDate: number; // timestamp
  gameDuration: number; // seconds
  queueId: number;
}

// ─── Player profile (derived) ─────────────────────────────────────────────────

export interface RoleComfort {
  role: Role;
  /** 0–1 fraction of recent games played in this role */
  frequency: number;
  /** normalized comfort score (0–400); includes skill baseline + role fit */
  score: number;
}

export interface PlayerProfile {
  puuid: string;
  gameName: string;
  tagLine: string;
  platform: Platform;

  // Ranked
  soloRanked: RankedEntry | null;
  flexRanked: RankedEntry | null;

  // Derived scores
  /** Internal numeric rank (0–3400+); see rankMapping.ts */
  baseSkill: number;

  // Role analysis
  primaryRole: Role;
  secondaryRole: Role;
  roleComfort: RoleComfort[];

  // Match history summary
  recentMatches: MatchSummary[];
  /** top 3 champion names by recent game frequency */
  topChampions: string[];
  /** 0–1 concentration: 1 = OTP, 0 = diverse pool */
  championConcentration: number;

  /** ISO timestamp of last API fetch */
  fetchedAt: string;
}

// ─── Constraint types ─────────────────────────────────────────────────────────

export type ConstraintType = "TOGETHER" | "OPPOSITE";

export interface TeamConstraint {
  id: string;
  type: ConstraintType;
  puuidA: string;
  puuidB: string;
}

// ─── Optimization types ───────────────────────────────────────────────────────

export interface RoleAssignment {
  puuid: string;
  role: Role;
  /** role_score for this assignment (base_skill + comfort bonus/penalty) */
  roleScore: number;
  /** true if this is the player's primary role */
  isPrimaryRole: boolean;
  /** true if this is the player's secondary role */
  isSecondaryRole: boolean;
  /** true if player is off their primary and secondary roles */
  isOffRole: boolean;
}

export interface TeamComposition {
  players: PlayerProfile[];
  roleAssignments: RoleAssignment[];
  /** sum of roleScores for this team */
  totalStrength: number;
}

export interface TeamGenerationResult {
  teamA: TeamComposition;
  teamB: TeamComposition;
  /** absolute strength gap between teams */
  strengthGap: number;
  /** 0–100 balance score (100 = perfectly balanced) */
  balanceScore: number;
  /** total off-role count across both teams */
  offRoleCount: number;
  /** human-readable explanation bullets */
  explanation: string[];
  /** which constraints were satisfied */
  satisfiedConstraints: TeamConstraint[];
  /** algorithm metadata */
  candidatesEvaluated: number;
}

// ─── API request/response shapes ──────────────────────────────────────────────

export interface ResolvePlayersRequest {
  platform: Platform;
  riotIds: string[]; // "gameName#tagLine"
}

export interface ResolvePlayersResponse {
  players: PlayerProfile[];
  errors: { riotId: string; message: string }[];
}

export interface CreateLobbyRequest {
  platform: Platform;
  puuids: string[];
}

export interface CreateLobbyResponse {
  lobbyId: string;
}

export interface GenerateTeamsRequest {
  constraints: TeamConstraint[];
}

export interface GenerateTeamsResponse {
  result: TeamGenerationResult;
}

// ─── UI state types ───────────────────────────────────────────────────────────

export type AppStep = "input" | "review" | "result";

export interface LobbyState {
  step: AppStep;
  platform: Platform;
  rawInput: string;
  players: PlayerProfile[];
  constraints: TeamConstraint[];
  result: TeamGenerationResult | null;
  isLoading: boolean;
  errors: Record<string, string>;
}

// ─── Platform display metadata ────────────────────────────────────────────────

export interface PlatformInfo {
  value: Platform;
  label: string;
  region: Region;
  flag?: string;
}
