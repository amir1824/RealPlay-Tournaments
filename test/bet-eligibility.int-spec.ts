import { betBody, createTournament, postBet, readLeaderboard } from './support/requests';
import { useTestApp } from './support/test-app';
import { iso } from './support/time';

describe('Bet eligibility window', () => {
  const testApp = useTestApp();

  it('counts a bet exactly at startsAt and exactly at endsAt', async () => {
    const startsAt = iso(0);
    const endsAt = iso(10000);
    const tournament = await createTournament(testApp, { startsAt, endsAt });

    await postBet(testApp, {
      externalBetId: 'bet_at_start',
      playerId: 'player_a',
      amount: 100,
      createdAt: startsAt,
    }).expect(201);
    await postBet(testApp, {
      externalBetId: 'bet_at_end',
      playerId: 'player_b',
      amount: 200,
      createdAt: endsAt,
    }).expect(201);

    expect((await readLeaderboard(testApp, tournament.id)).total).toBe(2);
  });

  it('does not count a bet one millisecond outside the window', async () => {
    const startsAt = iso(0);
    const endsAt = iso(10000);
    const tournament = await createTournament(testApp, { startsAt, endsAt });

    const before = await postBet(testApp, {
      externalBetId: 'bet_before',
      playerId: 'player_a',
      amount: 100,
      createdAt: iso(-1, Date.parse(startsAt)),
    }).expect(201);
    const after = await postBet(testApp, {
      externalBetId: 'bet_after',
      playerId: 'player_b',
      amount: 100,
      createdAt: iso(1, Date.parse(endsAt)),
    }).expect(201);

    expect(betBody(before).tournaments).toEqual([]);
    expect(betBody(after).tournaments).toEqual([]);
    expect((await readLeaderboard(testApp, tournament.id)).total).toBe(0);
  });

  it('counts one bet toward two overlapping tournaments but not a non-overlapping one', async () => {
    const now = Date.now();
    const first = await createTournament(testApp, {
      startsAt: iso(-10000, now),
      endsAt: iso(10000, now),
    });
    const overlapping = await createTournament(testApp, {
      startsAt: iso(-5000, now),
      endsAt: iso(20000, now),
    });
    const later = await createTournament(testApp, {
      startsAt: iso(100000, now),
      endsAt: iso(200000, now),
    });

    const response = await postBet(testApp, {
      externalBetId: 'bet_shared',
      playerId: 'player_multi',
      amount: 300,
      createdAt: iso(0, now),
    }).expect(201);

    expect(betBody(response).tournaments).toEqual(
      expect.arrayContaining([
        { tournamentId: first.id, status: 'counted' },
        { tournamentId: overlapping.id, status: 'counted' },
      ]),
    );
    expect(betBody(response).tournaments).toHaveLength(2);
    expect((await readLeaderboard(testApp, first.id)).players).toEqual([
      { placement: 1, playerId: 'player_multi', score: 300 },
    ]);
    expect((await readLeaderboard(testApp, overlapping.id)).players).toEqual([
      { placement: 1, playerId: 'player_multi', score: 300 },
    ]);
    expect((await readLeaderboard(testApp, later.id)).total).toBe(0);
  });

  it('does not count a replay toward a tournament created after the first request', async () => {
    const createdAt = iso(0);
    const bet = { externalBetId: 'bet_early', playerId: 'player_a', amount: 100, createdAt };
    await postBet(testApp, bet).expect(201);
    const tournament = await createTournament(testApp, {
      startsAt: iso(-5000),
      endsAt: iso(60000),
    });

    const replay = await postBet(testApp, bet).expect(200);

    expect(betBody(replay).tournaments).toEqual([]);
    expect((await readLeaderboard(testApp, tournament.id)).total).toBe(0);
  });
});
