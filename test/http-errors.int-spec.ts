import { LiveLeaderboardService } from '@app/tournaments/leaderboard/live-board/live-leaderboard.service';
import { errorBody, getLeaderboard, openTournament } from './support/requests';
import { useTestApp } from './support/test-app';

describe('HTTP errors', () => {
  const testApp = useTestApp();

  it('answers 503 with the request id when a dependency is down', async () => {
    const tournament = await openTournament(testApp);
    jest
      .spyOn(testApp.get(LiveLeaderboardService), 'readPage')
      .mockRejectedValueOnce(new Error('Connection is closed.'));

    const response = await getLeaderboard(testApp, tournament.id)
      .set('x-request-id', 'trace-123')
      .expect(503);

    expect(errorBody(response)).toMatchObject({
      message: 'redis unavailable',
      requestId: 'trace-123',
    });
  });

  it('answers 500 without internals for an unexpected error', async () => {
    const tournament = await openTournament(testApp);
    jest
      .spyOn(testApp.get(LiveLeaderboardService), 'readPage')
      .mockRejectedValueOnce(new TypeError('boom'));

    const response = await getLeaderboard(testApp, tournament.id).expect(500);

    expect(errorBody(response).message).toBe('Internal server error');
    expect(JSON.stringify(response.body)).not.toContain('boom');
  });
});
