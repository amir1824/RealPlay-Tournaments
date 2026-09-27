import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '@app/platform/database/prisma.service';
import { parseFirstQueryRow, parseQueryRows } from '@app/platform/database/parse-query-rows';

const ledgerRowSchema = z.object({
  id: z.string(),
  insertedAt: z.date(),
  tournamentId: z.string(),
  tournamentEndsAt: z.date(),
  playerId: z.string(),
  amount: z.number(),
  externalBetId: z.string(),
});

const clockSchema = z.object({ now: z.date() });

export type LedgerRow = z.infer<typeof ledgerRowSchema>;

/** Keyset position in the ledger: rows sort by (inserted_at, id). */
export type LedgerPosition = Pick<LedgerRow, 'insertedAt' | 'id'>;

@Injectable()
export class LedgerReplayRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Rows after `position` and stamped no later than `until`, so a run ends even
   * while bets keep arriving. Served by idx_tournament_bets_inserted_at.
   * Finalized tournaments are skipped.
   */
  async findOpenRowsAfter(
    position: LedgerPosition,
    until: Date,
    limit: number,
  ): Promise<LedgerRow[]> {
    const rows: unknown = await this.prisma.$queryRaw`
      SELECT tb.id, tb.inserted_at AS "insertedAt", tb.tournament_id AS "tournamentId",
             t.ends_at AS "tournamentEndsAt",
             tb.player_id AS "playerId", tb.amount, tb.external_bet_id AS "externalBetId"
      FROM tournament_bets tb
      JOIN tournaments t ON t.id = tb.tournament_id
      WHERE t.finalized_at IS NULL
        AND (tb.inserted_at, tb.id) > (${position.insertedAt}::timestamptz, ${position.id}::uuid)
        AND tb.inserted_at <= ${until}::timestamptz
      ORDER BY tb.inserted_at, tb.id
      LIMIT ${limit}`;
    return parseQueryRows(rows, ledgerRowSchema, 'findOpenRowsAfter');
  }

  /** The database clock, the one inserted_at is stamped with. */
  async readClock(): Promise<Date> {
    const rows: unknown = await this.prisma.$queryRaw`SELECT now() AS "now"`;
    const clock = parseFirstQueryRow(rows, clockSchema, 'readClock');
    if (!clock) throw new Error('readClock returned no row');
    return clock.now;
  }
}
