// Raw Riot API response shapes

export interface RiotAccountDto {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface SummonerDto {
  accountId: string;
  profileIconId: number;
  revisionDate: number;
  id: string; // encrypted summoner ID
  puuid: string;
  summonerLevel: number;
}

export interface LeagueEntryDto {
  leagueId: string;
  summonerId: string;
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  hotStreak: boolean;
  veteran: boolean;
  freshBlood: boolean;
  inactive: boolean;
  miniSeries?: {
    target: number;
    wins: number;
    losses: number;
    progress: string;
  };
}

export interface MatchMetadataDto {
  dataVersion: string;
  matchId: string;
  participants: string[]; // puuids
}

export interface MatchParticipantDto {
  puuid: string;
  summonerName: string;
  riotIdGameName: string;
  riotIdTagline: string;
  championId: number;
  championName: string;
  teamId: number; // 100 or 200
  individualPosition: string; // TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY, Invalid
  teamPosition: string; // same values; more reliable
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  totalDamageDealtToChampions: number;
  visionScore: number;
  goldEarned: number;
}

export interface MatchInfoDto {
  gameId: number;
  gameMode: string;
  gameType: string;
  gameName: string;
  gameCreation: number;
  gameDuration: number; // seconds
  queueId: number;
  participants: MatchParticipantDto[];
  teams: unknown[];
}

export interface MatchDto {
  metadata: MatchMetadataDto;
  info: MatchInfoDto;
}

export interface ChampionMasteryDto {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime: number;
  championName?: string; // may not be present in all versions
}

// Internal Riot API error
export class RiotApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "RiotApiError";
  }
}
