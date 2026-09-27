export interface LeaderboardEntry {
  placement: number;
  playerId: string;
  score: number;
}

export interface LeaderboardQuery {
  tournamentId: string;
  limit: number;
  offset: number;
}

export interface LeaderboardPage {
  total: number;
  players: LeaderboardEntry[];
}

export interface LeaderboardResponse extends LeaderboardQuery, LeaderboardPage {
  source: 'live' | 'final';
}

/** One bet counted toward one tournament: a tournament_bets row. */
export interface CountedBet {
  tournamentId: string;
  /** Sets the board's safety expiry; see live-leaderboard.service.ts. */
  tournamentEndsAt: Date;
  playerId: string;
  amount: number;
  externalBetId: string;
}
