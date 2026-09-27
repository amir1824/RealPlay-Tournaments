import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { logEvent } from '@app/platform/logging/log-event';
import { PeriodicTask, startPeriodicTask } from '@app/platform/timing/periodic-task';
import { FinalizationSweep } from './finalization/finalization.sweep';
import { LiveBoardReplay } from './leaderboard/live-board/live-board-replay.service';

const FINALIZATION_SWEEP_INTERVAL_MS = 60000;
const LIVE_BOARD_REPLAY_INTERVAL_MS = 10000;

/**
 * The workers app's timers: the finalization sweep and the live board replay.
 * In-process timers, not BullMQ schedules, so they keep running when Redis
 * loses its data, one of the failures they recover from. Every replica runs
 * them; both are idempotent, so that is safe.
 */
@Injectable()
export class TournamentsBackgroundTasks
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(TournamentsBackgroundTasks.name);
  private tasks: PeriodicTask[] = [];

  constructor(
    private readonly sweep: FinalizationSweep,
    private readonly replay: LiveBoardReplay,
  ) {}

  onApplicationBootstrap(): void {
    this.tasks = [
      startPeriodicTask({
        intervalMs: FINALIZATION_SWEEP_INTERVAL_MS,
        run: () => this.sweep.finalizeOverdue(),
        onError: (error) => this.logFailure('finalization_sweep', error),
      }),
      startPeriodicTask({
        intervalMs: LIVE_BOARD_REPLAY_INTERVAL_MS,
        run: () => this.replay.replay(),
        onError: (error) => this.logFailure('live_board_replay', error),
      }),
    ];
  }

  /** Before Prisma and Redis disconnect in onApplicationShutdown. */
  async beforeApplicationShutdown(): Promise<void> {
    await Promise.all(this.tasks.map((task) => task.stop()));
  }

  private logFailure(task: string, error: unknown): void {
    this.logger.error(logEvent('background_task.failed', { task, error: String(error) }));
  }
}
