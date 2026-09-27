import { Injectable, Logger } from '@nestjs/common';
import { TransactionClient, TransactionRunner } from '@app/platform/database/transaction-runner';
import { logEvent } from '@app/platform/logging/log-event';
import { findBetByExternalId, insertBetIfAbsent } from './bet.repository';
import { BetIngestionResponse, IngestBetInput, StoredBet } from './bet.types';
import { findCountedTournaments, insertTournamentBets } from './tournament-bet.repository';
import { LiveLeaderboardService } from '../leaderboard/live-board/live-leaderboard.service';
import { CountedBet } from '../leaderboard/leaderboard.types';
import { OpenTournament, lockOpenTournamentsAt } from '../tournament/tournament.repository';

interface InsertedOrReplayedBet {
  bet: StoredBet;
  duplicate: boolean;
}

interface RecordedBet extends InsertedOrReplayedBet {
  /** Every tournament the bet counts toward, finalized ones included. */
  countedTournamentIds: string[];
  /** The open ones among them: what the live board needs. */
  liveTournaments: OpenTournament[];
}

/**
 * Stores a bet and counts it toward every open tournament whose window holds
 * its event time. Idempotency lives in Postgres (unique constraints plus
 * ON CONFLICT DO NOTHING), never in a check-then-insert; see README > How it works.
 */
@Injectable()
export class BetIngestionService {
  private readonly logger = new Logger(BetIngestionService.name);

  constructor(
    private readonly transactions: TransactionRunner,
    private readonly liveLeaderboard: LiveLeaderboardService,
  ) {}

  async ingest(input: IngestBetInput): Promise<BetIngestionResponse> {
    const recorded = await this.transactions.run((tx) => this.recordBet(tx, input));
    const { bet, duplicate, countedTournamentIds } = recorded;
    this.logger.log(
      logEvent('bet.ingested', {
        externalBetId: bet.externalBetId,
        duplicate,
        tournaments: countedTournamentIds.length,
      }),
    );
    await this.updateLiveLeaderboard(bet, recorded.liveTournaments);
    return toIngestionResult(recorded);
  }

  /**
   * The fast path to the live board. A Redis failure doesn't fail the request:
   * the bet is stored, and the workers' ledger replay (LiveBoardReplay) puts it
   * on the board within one run. A duplicate re-applies its open tournaments
   * too; the Lua applied set skips what already landed.
   */
  private async updateLiveLeaderboard(
    bet: StoredBet,
    tournaments: OpenTournament[],
  ): Promise<void> {
    const countedBets = tournaments.map((tournament) => toCountedBet(bet, tournament));
    await this.liveLeaderboard.applyMany(countedBets).catch((error: unknown) =>
      this.logger.warn(
        logEvent('leaderboard.update_deferred', {
          externalBetId: bet.externalBetId,
          error: String(error),
        }),
      ),
    );
  }

  private async recordBet(tx: TransactionClient, input: IngestBetInput): Promise<RecordedBet> {
    const { bet, duplicate } = await this.insertBetOrFindReplay(tx, input);
    if (duplicate) return recordReplay(tx, bet);
    const openTournaments = await lockOpenTournamentsAt(tx, bet.createdAt);
    const openTournamentIds = openTournaments.map((tournament) => tournament.tournamentId);
    await insertTournamentBets(tx, bet, openTournamentIds);
    return {
      bet,
      duplicate,
      countedTournamentIds: openTournamentIds,
      liveTournaments: openTournaments,
    };
  }

  /**
   * Inserts the bet, or returns the stored one when this externalBetId was
   * already seen. The first stored bet wins: a duplicate with different fields
   * is still a success, logged so the caller's bug stays visible.
   */
  private async insertBetOrFindReplay(
    tx: TransactionClient,
    input: IngestBetInput,
  ): Promise<InsertedOrReplayedBet> {
    const inserted = await insertBetIfAbsent(tx, input);
    if (inserted) return { bet: inserted, duplicate: false };

    const existing = await findBetByExternalId(tx, input.externalBetId);
    if (!existing) {
      throw new Error(`Bet ${input.externalBetId} conflicted on insert but was not found`);
    }
    if (!isSamePayload(existing, input)) {
      this.logger.warn(logEvent('bet.duplicate_mismatch', { externalBetId: input.externalBetId }));
    }
    return { bet: existing, duplicate: true };
  }
}

function isSamePayload(bet: StoredBet, input: IngestBetInput): boolean {
  return (
    bet.playerId === input.playerId &&
    bet.amount === input.amount &&
    bet.currency === input.currency &&
    bet.createdAt.getTime() === input.createdAt.getTime()
  );
}

/**
 * A duplicate never counts again, not even toward a tournament created since
 * its first request: it only reads that request's rows from the ledger.
 */
async function recordReplay(tx: TransactionClient, bet: StoredBet): Promise<RecordedBet> {
  const counted = await findCountedTournaments(tx, bet.id);
  return {
    bet,
    duplicate: true,
    countedTournamentIds: counted.map((tournament) => tournament.tournamentId),
    liveTournaments: counted.filter((tournament) => !tournament.finalized),
  };
}

function toCountedBet(bet: StoredBet, tournament: OpenTournament): CountedBet {
  return {
    tournamentId: tournament.tournamentId,
    tournamentEndsAt: tournament.endsAt,
    playerId: bet.playerId,
    amount: bet.amount,
    externalBetId: bet.externalBetId,
  };
}

function toIngestionResult(recorded: RecordedBet): BetIngestionResponse {
  const status = recorded.duplicate ? 'already_counted' : 'counted';
  return {
    betId: recorded.bet.id,
    externalBetId: recorded.bet.externalBetId,
    duplicate: recorded.duplicate,
    tournaments: recorded.countedTournamentIds.map((tournamentId) => ({ tournamentId, status })),
  };
}
