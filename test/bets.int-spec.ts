import { LiveBoardReplay } from '@app/tournaments/leaderboard/live-board/live-board-replay.service';
import { LiveLeaderboardService } from '@app/tournaments/leaderboard/live-board/live-leaderboard.service';
import { countTournamentBets } from './support/ledger';
import { betBody, openTournament, postBet, readLeaderboard } from './support/requests';
import { useTestApp } from './support/test-app';
import { iso } from './support/time';

const CONCURRENT_REQUESTS = 20;

describe('Bet ingestion', () => {
  const testApp = useTestApp();

  it('counts a valid bet toward the player score', async () => {
    const tournament = await openTournament(testApp);

    const response = await postBet(testApp, {
      externalBetId: 'bet_1',
      playerId: 'player_42',
      amount: 250,
    }).expect(201);

    expect(betBody(response)).toMatchObject({
      duplicate: false,
      tournaments: [{ tournamentId: tournament.id, status: 'counted' }],
    });
    expect((await readLeaderboard(testApp, tournament.id)).players).toEqual([
      { placement: 1, playerId: 'player_42', score: 250 },
    ]);
  });

  it('stores the currency upper-cased, so a retry in another case is the same bet', async () => {
    await postBet(testApp, {
      externalBetId: 'lower',
      playerId: 'player_x',
      amount: 100,
      currency: 'usd',
    }).expect(201);

    expect(
      await testApp.prisma.bet.findUnique({ where: { externalBetId: 'lower' } }),
    ).toMatchObject({
      currency: 'USD',
    });
  });

  it('does not double-count an identical duplicate externalBetId', async () => {
    const tournament = await openTournament(testApp);
    const bet = { externalBetId: 'bet_dup', playerId: 'player_42', amount: 250, createdAt: iso(0) };

    await postBet(testApp, bet).expect(201);
    const replay = await postBet(testApp, bet).expect(200);

    expect(betBody(replay)).toMatchObject({
      duplicate: true,
      tournaments: [{ tournamentId: tournament.id, status: 'already_counted' }],
    });
    expect(await countTournamentBets(testApp, tournament.id)).toBe(1);
    expect((await readLeaderboard(testApp, tournament.id)).players).toEqual([
      { placement: 1, playerId: 'player_42', score: 250 },
    ]);
  });

  it('counts a single externalBetId exactly once under concurrent duplicate requests', async () => {
    const tournament = await openTournament(testApp);
    const bet = {
      externalBetId: 'bet_concurrent',
      playerId: 'player_race',
      amount: 500,
      createdAt: iso(0),
    };

    const responses = await Promise.all(
      Array.from({ length: CONCURRENT_REQUESTS }, () => postBet(testApp, bet)),
    );

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([...Array<number>(CONCURRENT_REQUESTS - 1).fill(200), 201]);
    expect(await testApp.prisma.bet.count({ where: { externalBetId: bet.externalBetId } })).toBe(1);
    expect(await countTournamentBets(testApp, tournament.id)).toBe(1);
    expect((await readLeaderboard(testApp, tournament.id)).players).toEqual([
      { placement: 1, playerId: 'player_race', score: 500 },
    ]);
  });

  it('keeps the first bet when a duplicate externalBetId has different fields', async () => {
    const tournament = await openTournament(testApp);
    const bet = {
      externalBetId: 'bet_conflict',
      playerId: 'player_42',
      amount: 250,
      createdAt: iso(0),
    };

    await postBet(testApp, bet).expect(201);
    const duplicate = await postBet(testApp, { ...bet, amount: 999 }).expect(200);

    expect(betBody(duplicate)).toMatchObject({
      duplicate: true,
      tournaments: [{ tournamentId: tournament.id, status: 'already_counted' }],
    });
    expect((await readLeaderboard(testApp, tournament.id)).players).toEqual([
      { placement: 1, playerId: 'player_42', score: 250 },
    ]);
  });

  it('stores the bet when Redis fails, and the ledger replay puts it on the board', async () => {
    const tournament = await openTournament(testApp);
    jest
      .spyOn(testApp.get(LiveLeaderboardService), 'applyMany')
      .mockRejectedValueOnce(new Error('redis down'));

    await postBet(testApp, {
      externalBetId: 'bet_redis_down',
      playerId: 'player_42',
      amount: 250,
    }).expect(201);
    expect((await readLeaderboard(testApp, tournament.id)).players).toEqual([]);

    await testApp.get(LiveBoardReplay).replay();

    expect(await countTournamentBets(testApp, tournament.id)).toBe(1);
    expect((await readLeaderboard(testApp, tournament.id)).players).toEqual([
      { placement: 1, playerId: 'player_42', score: 250 },
    ]);
  });

  it('rejects invalid input with a 400 and stores nothing', async () => {
    const bet = { externalBetId: 'invalid', playerId: 'player_x', amount: 100 };

    await postBet(testApp, { ...bet, amount: 0 }).expect(400);
    await postBet(testApp, { ...bet, playerId: ' player_x ' }).expect(400);
    await postBet(testApp, { ...bet, playerId: 'player\u0000x' }).expect(400);
    await postBet(testApp, { ...bet, createdAt: '2026-02-31T12:00:00Z' }).expect(400);
    await postBet(testApp, { ...bet, createdAt: '2026-06-04T12:30:60Z' }).expect(400);
    await postBet(testApp, { ...bet, createdAt: '2026-06-04T12:30:00.000123Z' }).expect(400);

    expect(await testApp.prisma.bet.count()).toBe(0);
  });
});
