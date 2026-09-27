export interface IngestBetInput {
  externalBetId: string;
  playerId: string;
  amount: number;
  currency: string;
  createdAt: Date;
}

export type TournamentBetStatus = 'counted' | 'already_counted';

export interface BetIngestionResponse {
  betId: string;
  externalBetId: string;
  duplicate: boolean;
  tournaments: Array<{ tournamentId: string; status: TournamentBetStatus }>;
}

export interface StoredBet {
  id: string;
  externalBetId: string;
  playerId: string;
  amount: number;
  currency: string;
  createdAt: Date;
}
