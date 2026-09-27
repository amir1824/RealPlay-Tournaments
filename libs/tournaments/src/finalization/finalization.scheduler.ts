import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Tournament } from '@prisma/client';
import { APP_CONFIG } from '@app/platform/config/config.module';
import { AppConfig } from '@app/platform/config/config';
import { DependencyUnavailableError } from '@app/platform/errors/dependency-unavailable.error';
import { withTimeout } from '@app/platform/timing/with-timeout';
import {
  FINALIZATION_QUEUE,
  FINALIZE_TOURNAMENT_JOB,
  FinalizeTournamentJobData,
  finalizationJobId,
} from './finalization.queue';

/** queue.add never settles while Redis is unreachable, so it gets a deadline. */
const SCHEDULING_TIMEOUT_MS = 2000;

@Injectable()
export class FinalizationScheduler {
  constructor(
    @InjectQueue(FINALIZATION_QUEUE)
    private readonly finalizationQueue: Queue<FinalizeTournamentJobData>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Throws DependencyUnavailableError when Redis can't take the job, so the
   * caller answers 503 before anything is created.
   */
  async scheduleFinalization(tournament: Pick<Tournament, 'id' | 'endsAt'>): Promise<void> {
    const runAtMs = tournament.endsAt.getTime() + this.config.finalizationGraceMs;
    const add = this.finalizationQueue.add(
      FINALIZE_TOURNAMENT_JOB,
      { tournamentId: tournament.id },
      { jobId: finalizationJobId(tournament.id), delay: Math.max(0, runAtMs - Date.now()) },
    );
    await withTimeout(add, SCHEDULING_TIMEOUT_MS, `Scheduling ${tournament.id} timed out`).catch(
      (error: unknown) => {
        throw new DependencyUnavailableError('redis', error);
      },
    );
  }
}
