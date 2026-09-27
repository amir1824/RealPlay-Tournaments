import { FinalizationService } from '@app/tournaments/finalization/finalization.service';
import { FinalizationSweep } from '@app/tournaments/finalization/finalization.sweep';
import {
  betBody,
  duringEndedTournament,
  endedTournament,
  postBet,
  readLeaderboard,
} from './support/requests';
import { useTestApp } from './support/test-app';

describe('Tournament finalization', () => {
  const testApp = useTestApp();
  let finalizationService: FinalizationService;
  let sweep: FinalizationSweep;

  beforeAll(() => {
    finalizationService = testApp.get(FinalizationService);
    sweep = testApp.get(FinalizationSweep);
  });

  it('writes final placements from the ledger, with ties broken by playerId', async () => {
    const tournament = await endedTournament(testApp);
    const createdAt = duringEndedTournament();
    await postBet(testApp, { externalBetId: 'f1', playerId: 'player_z', amount: 500, createdAt });
    await postBet(testApp, { externalBetId: 'f2', playerId: 'player_a', amount: 300, createdAt });
    await postBet(testApp, { externalBetId: 'f3', playerId: 'player_a', amount: 200, createdAt });
    await postBet(testApp, { externalBetId: 'f4', playerId: 'player_m', amount: 100, createdAt });

    await finalizationService.finalize(tournament.id);

    const board = await readLeaderboard(testApp, tournament.id);
    expect(board.source).toBe('final');
    expect(board.players).toEqual([
      { placement: 1, playerId: 'player_a', score: 500 },
      { placement: 2, playerId: 'player_z', score: 500 },
      { placement: 3, playerId: 'player_m', score: 100 },
    ]);
  });

  it('is idempotent: finalizing twice writes placements once', async () => {
    const tournament = await endedTournament(testApp);
    await postBet(testApp, {
      externalBetId: 'idem1',
      playerId: 'player_a',
      amount: 250,
      createdAt: duringEndedTournament(),
    });

    await finalizationService.finalize(tournament.id);
    await finalizationService.finalize(tournament.id);

    expect((await readLeaderboard(testApp, tournament.id)).players).toEqual([
      { placement: 1, playerId: 'player_a', score: 250 },
    ]);
  });

  it('does not count bets that arrive after finalization', async () => {
    const tournament = await endedTournament(testApp);
    const createdAt = duringEndedTournament();
    await postBet(testApp, {
      externalBetId: 'on_time',
      playerId: 'player_a',
      amount: 100,
      createdAt,
    });
    await finalizationService.finalize(tournament.id);

    const late = await postBet(testApp, {
      externalBetId: 'late',
      playerId: 'player_a',
      amount: 900,
      createdAt,
    }).expect(201);

    expect(betBody(late).tournaments).toEqual([]);
    expect((await readLeaderboard(testApp, tournament.id)).players).toEqual([
      { placement: 1, playerId: 'player_a', score: 100 },
    ]);
  });

  it('answers a replay after finalization from the ledger', async () => {
    const tournament = await endedTournament(testApp);
    const bet = {
      externalBetId: 'replayed_late',
      playerId: 'player_a',
      amount: 100,
      createdAt: duringEndedTournament(),
    };
    await postBet(testApp, bet).expect(201);
    await finalizationService.finalize(tournament.id);

    const replay = await postBet(testApp, bet).expect(200);

    expect(betBody(replay).tournaments).toEqual([
      { tournamentId: tournament.id, status: 'already_counted' },
    ]);
    expect((await readLeaderboard(testApp, tournament.id)).players).toEqual([
      { placement: 1, playerId: 'player_a', score: 100 },
    ]);
  });

  it('sweeps an ended tournament whose snapshot job never ran', async () => {
    const tournament = await endedTournament(testApp);
    await postBet(testApp, {
      externalBetId: 'swept',
      playerId: 'player_a',
      amount: 400,
      createdAt: duringEndedTournament(),
    }).expect(201);

    await sweep.finalizeOverdue();

    const board = await readLeaderboard(testApp, tournament.id);
    expect(board.source).toBe('final');
    expect(board.players).toEqual([{ placement: 1, playerId: 'player_a', score: 400 }]);
  });
});
