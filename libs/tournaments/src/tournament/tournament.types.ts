export interface TournamentResponse {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  finalizedAt: string | undefined;
}

export interface CreateTournamentInput {
  name: string;
  startsAt: Date;
  endsAt: Date;
}
