import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Tournament } from '@prisma/client';
import { logEvent } from '@app/platform/logging/log-event';
import { FinalizationScheduler } from '../finalization/finalization.scheduler';
import { TournamentRepository } from './tournament.repository';
import { CreateTournamentInput, TournamentResponse } from './tournament.types';

@Injectable()
export class TournamentsService {
  private readonly logger = new Logger(TournamentsService.name);

  constructor(
    private readonly tournaments: TournamentRepository,
    private readonly finalizationScheduler: FinalizationScheduler,
  ) {}

  /**
   * Schedules the snapshot job first, then inserts the row. If Redis is down
   * the request is a 503 and nothing was created, so retrying that 503 is safe,
   * and no database transaction is held across a Redis call.
   */
  async create(input: CreateTournamentInput): Promise<TournamentResponse> {
    const id = randomUUID();
    await this.finalizationScheduler.scheduleFinalization({ id, endsAt: input.endsAt });
    const tournament = await this.tournaments.create({ id, ...input });
    this.logger.log(
      logEvent('tournament.created', {
        tournamentId: tournament.id,
        startsAt: input.startsAt.toISOString(),
        endsAt: input.endsAt.toISOString(),
      }),
    );
    return toResponse(tournament);
  }
}

function toResponse(tournament: Tournament): TournamentResponse {
  return {
    id: tournament.id,
    name: tournament.name,
    startsAt: tournament.startsAt.toISOString(),
    endsAt: tournament.endsAt.toISOString(),
    createdAt: tournament.createdAt.toISOString(),
    finalizedAt: tournament.finalizedAt?.toISOString(),
  };
}
