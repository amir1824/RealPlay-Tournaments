import { BeforeApplicationShutdown, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { logEvent } from '@app/platform/logging/log-event';
import { FINALIZATION_QUEUE, parseFinalizeTournamentJob } from './finalization.queue';
import { FinalizationService } from './finalization.service';

@Processor(FINALIZATION_QUEUE)
export class FinalizationProcessor extends WorkerHost implements BeforeApplicationShutdown {
  private readonly logger = new Logger(FinalizationProcessor.name);

  constructor(private readonly finalizationService: FinalizationService) {
    super();
  }

  /**
   * @nestjs/bullmq closes workers in onApplicationShutdown, the same phase in
   * which Prisma and Redis disconnect, so an active job could lose them
   * mid-transaction. Draining here, one phase earlier, orders it first.
   */
  async beforeApplicationShutdown(): Promise<void> {
    await this.worker.close();
  }

  async process(job: Job<unknown>): Promise<void> {
    const { tournamentId } = parseFinalizeTournamentJob(job.data);
    await this.finalizationService.finalize(tournamentId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<unknown> | undefined, error: unknown): void {
    this.logger.error(
      logEvent('worker.job_failed', {
        queue: FINALIZATION_QUEUE,
        jobId: job?.id,
        jobName: job?.name,
        attemptsMade: job?.attemptsMade,
        error: String(error),
      }),
    );
  }
}
