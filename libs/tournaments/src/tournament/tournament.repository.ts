import { Injectable } from '@nestjs/common';
import { Tournament } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '@app/platform/database/prisma.service';
import { parseFirstQueryRow, parseQueryRows } from '@app/platform/database/parse-query-rows';
import { TransactionClient } from '@app/platform/database/transaction-runner';
import { CreateTournamentInput } from './tournament.types';

const openTournamentSchema = z.object({ tournamentId: z.string(), endsAt: z.date() });

export type OpenTournament = z.infer<typeof openTournamentSchema>;

const lockedTournamentSchema = z.object({
  endsAt: z.date(),
  finalizedAt: z
    .date()
    .nullable()
    .transform((finalizedAt) => finalizedAt ?? undefined),
});

export type LockedTournament = z.infer<typeof lockedTournamentSchema>;

/**
 * The open tournaments whose window holds the bet's event time. FOR SHARE
 * until commit: finalization's FOR UPDATE can't slip in between this read and
 * the tournament_bets insert. Served by idx_tournaments_open_ends_at.
 */
export async function lockOpenTournamentsAt(
  tx: TransactionClient,
  betCreatedAt: Date,
): Promise<OpenTournament[]> {
  const rows: unknown = await tx.$queryRaw`
    SELECT id AS "tournamentId", ends_at AS "endsAt" FROM tournaments
    WHERE starts_at <= ${betCreatedAt}::timestamptz AND ends_at >= ${betCreatedAt}::timestamptz
      AND finalized_at IS NULL
    FOR SHARE`;
  return parseQueryRows(rows, openTournamentSchema, 'lockOpenTournamentsAt');
}

/** FOR UPDATE: waits for every in-flight bet that share-locked this tournament. */
export async function lockTournamentForFinalization(
  tx: TransactionClient,
  tournamentId: string,
): Promise<LockedTournament | undefined> {
  const rows: unknown = await tx.$queryRaw`
    SELECT ends_at AS "endsAt", finalized_at AS "finalizedAt"
    FROM tournaments WHERE id = ${tournamentId}::uuid FOR UPDATE`;
  return parseFirstQueryRow(rows, lockedTournamentSchema, 'lockTournamentForFinalization');
}

export async function markTournamentFinalized(
  tx: TransactionClient,
  tournamentId: string,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE tournaments SET finalized_at = now() WHERE id = ${tournamentId}::uuid`;
}

/** Queries that stand alone, outside any caller's transaction. */
@Injectable()
export class TournamentRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateTournamentInput & { id: string }): Promise<Tournament> {
    return this.prisma.tournament.create({ data: input });
  }

  async findById(tournamentId: string): Promise<Tournament | undefined> {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    return tournament ?? undefined;
  }

  /** Served by the partial index idx_tournaments_open_ends_at. */
  async findUnfinalizedEndedBefore(cutoff: Date): Promise<string[]> {
    const overdue = await this.prisma.tournament.findMany({
      where: { finalizedAt: null, endsAt: { lt: cutoff } },
      select: { id: true },
    });
    return overdue.map((tournament) => tournament.id);
  }
}
