import { FinalizationService } from '@app/tournaments/finalization/finalization.service';
import { leaderboardKey, replayCursorKey } from '@app/tournaments/leaderboard/leaderboard.keys';
import { LiveBoardCursor } from '@app/tournaments/leaderboard/live-board/live-board-cursor';
import { LiveBoardReplay } from '@app/tournaments/leaderboard/live-board/live-board-replay.service';
import {
  duringEndedTournament,
  endedTournament,
  openTournament,
  postBet,
  readLeaderboard,
} from './support/requests';
import { useTestApp } from './support/test-app';

const EARLIER_MS = 1000;
const LATER_MS = 2000;
const LATEST_MS = 3000;

describe('Live board replay (the durable retry)', () => {
  const testApp = useTestApp();
  let replay: LiveBoardReplay;

  beforeAll(() => {
    replay = testApp.get(LiveBoardReplay);
  });

  it('rebuilds the live board after Redis loses its data, and never counts twice', async () => {
    const tournament = await openTournament(testApp);
    await postBet(testApp, { externalBetId: 'r1', playerId: 'player_a', amount: 300 });
    await postBet(testApp, { externalBetId: 'r2', playerId: 'player_b', amount: 100 });
    await replay.replay();

    await testApp.redis.flushdb();
    await replay.replay();
    await replay.replay();

    expect((await readLeaderboard(testApp, tournament.id)).players).toEqual([
      { placement: 1, playerId: 'player_a', score: 300 },
      { placement: 2, playerId: 'player_b', score: 100 },
    ]);
  });

  it('moves the cursor only forward, and not at all after a mid-replay flush', async () => {
    const cursor = testApp.get(LiveBoardCursor);
    const started = await cursor.begin();

    await cursor.advance(started, new Date(LATER_MS));
    await cursor.advance(started, new Date(EARLIER_MS));
    expect((await cursor.begin()).replayedUntil).toEqual(new Date(LATER_MS));

    await testApp.redis.flushdb();
    await cursor.advance(started, new Date(LATEST_MS));
    expect(await testApp.redis.exists(replayCursorKey())).toBe(0);
  });

  it("leaves a finalized tournament's board alone", async () => {
    const tournament = await endedTournament(testApp);
    await postBet(testApp, {
      externalBetId: 'closed',
      playerId: 'player_a',
      amount: 100,
      createdAt: duringEndedTournament(),
    });
    await testApp.get(FinalizationService).finalize(tournament.id);
    await testApp.redis.flushdb();

    await replay.replay();

    expect(await testApp.redis.exists(leaderboardKey(tournament.id))).toBe(0);
  });
});
