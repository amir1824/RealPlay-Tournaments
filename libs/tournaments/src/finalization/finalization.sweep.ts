import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG } from '@app/platform/config/config.module';
import { AppConfig } from '@app/platform/config/config';
import { logEvent } from '@app/platform/logging/log-event';
import { FinalizationService } from './finalization.service';
import { TournamentRepository } from '../tournament/tournament.repository';

/**
 * Safety net for a snapshot job that exhausted its retries or was lost with
 * Redis's data. Re-adding the job would be a no-op (a failed job keeps its id),
 * so the sweep calls the idempotent finalize() directly. See README > How it works.
 */
@Injectable()
export class FinalizationSweep {
  private readonly logger = new Logger(FinalizationSweep.name);

  constructor(
    private readonly tournaments: TournamentRepository,
    private readonly finalizationService: FinalizationService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async finalizeOverdue(): Promise<void> {
    const cutoff = new Date(Date.now() - this.config.finalizationGraceMs);
    const overdueIds = await this.tournaments.findUnfinalizedEndedBefore(cutoff);
    for (const tournamentId of overdueIds) {
      await this.finalizationService
        .finalize(tournamentId)
        .catch((error: unknown) =>
          this.logger.error(
            logEvent('tournament.sweep_failed', { tournamentId, error: String(error) }),
          ),
        );
    }
  }
}
