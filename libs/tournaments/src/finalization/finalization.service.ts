import { Injectable, Logger } from '@nestjs/common';
import { TransactionClient, TransactionRunner } from '@app/platform/database/transaction-runner';
import { logEvent } from '@app/platform/logging/log-event';
import { insertFinalPlacements } from './final-placement.repository';
import { LiveLeaderboardService } from '../leaderboard/live-board/live-leaderboard.service';
import {
  lockTournamentForFinalization,
  markTournamentFinalized,
} from '../tournament/tournament.repository';

/**
 * 24h of cleanup headroom for the frozen live board; reads switch to
 * final_placements as soon as finalized_at is set.
 */
const FINAL_LEADERBOARD_RETENTION_SECONDS = 86400;

/**
 * Prisma's interactive-transaction default is 5s; one ranked INSERT over a
 * large tournament can outlast it, and a rollback there would retry forever.
 */
const FINALIZATION_TX_TIMEOUT_MS = 60000;

type FinalizationOutcome = 'finalized' | 'already_finalized';

/**
 * Closes a tournament: ranks its Postgres ledger into final_placements and
 * sets finalized_at in one transaction. Called by the snapshot job and the sweep.
 */
@Injectable()
export class FinalizationService {
  private readonly logger = new Logger(FinalizationService.name);

  constructor(
    private readonly transactions: TransactionRunner,
    private readonly liveLeaderboard: LiveLeaderboardService,
  ) {}

  /**
   * Final standings come from the Postgres ledger, never from Redis. The 24h
   * board expiry is set even when already finalized: a previous attempt may
   * have committed and then failed before setting it.
   */
  async finalize(tournamentId: string): Promise<void> {
    this.logger.log(logEvent('tournament.finalization_started', { tournamentId }));
    const outcome = await this.transactions.run(
      (tx) => this.writeFinalStandings(tx, tournamentId),
      { timeoutMs: FINALIZATION_TX_TIMEOUT_MS },
    );
    await this.liveLeaderboard.expire(tournamentId, FINAL_LEADERBOARD_RETENTION_SECONDS);
    this.logger.log(logEvent(`tournament.${outcome}`, { tournamentId }));
  }

  /**
   * Idempotent: the FOR UPDATE lock serializes against bet ingestion's FOR
   * SHARE, and a crashed attempt rolls back whole. Throws when the row doesn't
   * exist yet (the job is added before the insert), so BullMQ's retry finds it.
   */
  private async writeFinalStandings(
    tx: TransactionClient,
    tournamentId: string,
  ): Promise<FinalizationOutcome> {
    const tournament = await lockTournamentForFinalization(tx, tournamentId);
    if (!tournament) throw new Error(`Tournament ${tournamentId} not found for finalization`);
    if (tournament.finalizedAt) return 'already_finalized';
    await insertFinalPlacements(tx, tournamentId);
    await markTournamentFinalized(tx, tournamentId);
    return 'finalized';
  }
}
