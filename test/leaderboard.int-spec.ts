import { appliedBetsKey, leaderboardKey } from '@app/tournaments/leaderboard/leaderboard.keys';
import { getLeaderboard, openTournament, postBet, readLeaderboard } from './support/requests';
import { useTestApp } from './support/test-app';

const UNKNOWN_TOURNAMENT_ID = '00000000-0000-4000-8000-000000000000';

describe('Live leaderboard', () => {
  const testApp = useTestApp();

  it('orders by score descending, with ties broken by playerId', async () => {
    const tournament = await openTournament(testApp);
    await postBet(testApp, { externalBetId: 'b1', playerId: 'player_c', amount: 100 });
    await postBet(testApp, { externalBetId: 'b2', playerId: 'player_a', amount: 500 });
    await postBet(testApp, { externalBetId: 'b3', playerId: 'player_b', amount: 500 });

    expect((await readLeaderboard(testApp, tournament.id)).players).toEqual([
      { placement: 1, playerId: 'player_a', score: 500 },
      { placement: 2, playerId: 'player_b', score: 500 },
      { placement: 3, playerId: 'player_c', score: 100 },
    ]);
  });

  it('keeps placements absolute across pages', async () => {
    const tournament = await openTournament(testApp);
    await postBet(testApp, { externalBetId: 'bet_0', playerId: 'player_0', amount: 100 });
    await postBet(testApp, { externalBetId: 'bet_1', playerId: 'player_1', amount: 200 });
    await postBet(testApp, { externalBetId: 'bet_2', playerId: 'player_2', amount: 300 });
    await postBet(testApp, { externalBetId: 'bet_3', playerId: 'player_3', amount: 400 });
    await postBet(testApp, { externalBetId: 'bet_4', playerId: 'player_4', amount: 500 });

    const page = await readLeaderboard(testApp, tournament.id, '?limit=2&offset=2');

    expect(page.total).toBe(5);
    expect(page.players).toEqual([
      { placement: 3, playerId: 'player_2', score: 300 },
      { placement: 4, playerId: 'player_1', score: 200 },
    ]);
  });

  it('answers 404 for an unknown tournament and 400 for an oversized page', async () => {
    const tournament = await openTournament(testApp);

    await getLeaderboard(testApp, UNKNOWN_TOURNAMENT_ID).expect(404);
    await getLeaderboard(testApp, tournament.id, '?limit=101').expect(400);
  });

  it('gives both board keys an expiry from their first write', async () => {
    const tournament = await openTournament(testApp);
    await postBet(testApp, { externalBetId: 'ttl', playerId: 'player_a', amount: 100 });

    expect(await testApp.redis.pttl(leaderboardKey(tournament.id))).toBeGreaterThan(0);
    expect(await testApp.redis.pttl(appliedBetsKey(tournament.id))).toBeGreaterThan(0);
  });
});
