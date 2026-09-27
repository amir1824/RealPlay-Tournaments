import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue, QueueEvents } from 'bullmq';
import { WorkersModule } from '../apps/workers/src/workers.module';
import {
  FINALIZATION_QUEUE,
  finalizationJobId,
} from '@app/tournaments/finalization/finalization.queue';
import { createTournament, postBet, readLeaderboard } from './support/requests';
import { useTestApp } from './support/test-app';
import { iso } from './support/time';

/** Generous, so a slow machine waits longer instead of failing; well under testTimeout. */
const SNAPSHOT_WAIT_MS = 15000;

describe('Workers application', () => {
  const api = useTestApp();
  let workers: INestApplicationContext | undefined;
  let events: QueueEvents;

  beforeEach(async () => {
    events = new QueueEvents(FINALIZATION_QUEUE, { connection: { url: process.env.REDIS_URL } });
    await events.waitUntilReady();
  });

  afterEach(async () => {
    await workers?.close();
    workers = undefined;
    await events.close();
  });

  it('runs the scheduled snapshot job after endsAt and serves final placements', async () => {
    const tournament = await createTournament(api, { startsAt: iso(-1000), endsAt: iso(1000) });
    await postBet(api, { externalBetId: 'workers-path', playerId: 'player_a', amount: 250 }).expect(
      201,
    );

    workers = await NestFactory.createApplicationContext(WorkersModule, { logger: false });
    const queue = api.get<Queue>(getQueueToken(FINALIZATION_QUEUE));
    const job = await queue.getJob(finalizationJobId(tournament.id));
    expect(job).toBeDefined();
    await job?.waitUntilFinished(events, SNAPSHOT_WAIT_MS);

    const board = await readLeaderboard(api, tournament.id);
    expect(board.source).toBe('final');
    expect(board.players).toEqual([{ placement: 1, playerId: 'player_a', score: 250 }]);
  });

  it('finalizes a tournament created after it ended, with the workers already running', async () => {
    workers = await NestFactory.createApplicationContext(WorkersModule, { logger: false });
    const tournament = await createTournament(api, { startsAt: iso(-20000), endsAt: iso(-10000) });

    const queue = api.get<Queue>(getQueueToken(FINALIZATION_QUEUE));
    const job = await queue.getJob(finalizationJobId(tournament.id));
    expect(job).toBeDefined();
    await job?.waitUntilFinished(events, SNAPSHOT_WAIT_MS);

    expect((await readLeaderboard(api, tournament.id)).source).toBe('final');
  });
});
