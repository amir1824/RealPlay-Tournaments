import request, { Response } from 'supertest';
import { TestApp } from './test-app';
import { iso } from './time';
import { ErrorResponse } from '@app/platform/http/app-exception.filter';
import { BetIngestionResponse } from '@app/tournaments/bets/bet.types';
import { LeaderboardResponse } from '@app/tournaments/leaderboard/leaderboard.types';
import { TournamentResponse } from '@app/tournaments/tournament/tournament.types';

export interface TournamentWindow {
  name?: string;
  startsAt: string;
  endsAt: string;
}

export function postTournament(testApp: TestApp, window: TournamentWindow) {
  return request(testApp.server)
    .post('/tournaments')
    .send({ name: 'Test Tournament', ...window });
}

export async function createTournament(
  testApp: TestApp,
  window: TournamentWindow,
): Promise<TournamentResponse> {
  const response = await postTournament(testApp, window).expect(201);
  return jsonBody(response);
}

/** Open now and for the next minute: bets dated now count toward it. */
export function openTournament(testApp: TestApp): Promise<TournamentResponse> {
  return createTournament(testApp, { startsAt: iso(-1000), endsAt: iso(60000) });
}

/**
 * Ended well past the test grace period (1s). Date its bets with
 * duringEndedTournament(). Inserted directly, so no snapshot job exists for it.
 */
export function endedTournament(testApp: TestApp): Promise<{ id: string }> {
  return testApp.prisma.tournament.create({
    data: {
      name: 'Ended Tournament',
      startsAt: new Date(iso(-20000)),
      endsAt: new Date(iso(-10000)),
    },
    select: { id: true },
  });
}

export function duringEndedTournament(): string {
  return iso(-15000);
}

export interface BetInput {
  externalBetId: string;
  playerId: string;
  amount: number;
  currency?: string;
  createdAt?: string;
}

/**
 * currency defaults to USD and createdAt to now. A replay should pin createdAt,
 * or it is a duplicate with different fields.
 */
export function postBet(testApp: TestApp, bet: BetInput) {
  return request(testApp.server)
    .post('/bet')
    .send({ currency: 'USD', createdAt: iso(0), ...bet });
}

export function getLeaderboard(testApp: TestApp, tournamentId: string, query = '') {
  return request(testApp.server).get(`/tournaments/${tournamentId}/leaderboard${query}`);
}

export async function readLeaderboard(
  testApp: TestApp,
  tournamentId: string,
  query = '',
): Promise<LeaderboardResponse> {
  const response = await getLeaderboard(testApp, tournamentId, query).expect(200);
  return jsonBody(response);
}

export function betBody(response: Response): BetIngestionResponse {
  return jsonBody(response);
}

export function errorBody(response: Response): ErrorResponse {
  return jsonBody(response);
}

/** Supertest types `body` as `any`. The assertion stops here so specs read a domain type. */
function jsonBody<T>(response: Response): T {
  const body: unknown = response.body as unknown;
  return body as T;
}
