import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FINALIZATION_QUEUE } from '@app/tournaments/finalization/finalization.queue';
import { errorBody, postTournament } from './support/requests';
import { useTestApp } from './support/test-app';
import { iso } from './support/time';

describe('Tournaments API', () => {
  const testApp = useTestApp();

  it('rejects invalid input with a 400 and creates nothing', async () => {
    const window = { startsAt: iso(0), endsAt: iso(60000) };

    await postTournament(testApp, { ...window, endsAt: window.startsAt }).expect(400);
    await postTournament(testApp, { ...window, startsAt: '2026-02-31T00:00:00Z' }).expect(400);
    await postTournament(testApp, { ...window, name: 'Cup\u0000' }).expect(400);

    expect(await testApp.prisma.tournament.count()).toBe(0);
  });

  it('returns 503 and creates nothing when the snapshot job cannot be scheduled', async () => {
    const queue = testApp.get<Queue>(getQueueToken(FINALIZATION_QUEUE));
    jest.spyOn(queue, 'add').mockReturnValueOnce(new Promise<never>(() => undefined));

    const response = await postTournament(testApp, { startsAt: iso(0), endsAt: iso(60000) }).expect(
      503,
    );

    expect(errorBody(response).message).toBe('redis unavailable');
    expect(await testApp.prisma.tournament.count()).toBe(0);
  });
});
