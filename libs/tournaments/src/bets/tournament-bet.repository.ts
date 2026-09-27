import { z } from 'zod';
import { parseQueryRows } from '@app/platform/database/parse-query-rows';
import { TransactionClient } from '@app/platform/database/transaction-runner';
import { StoredBet } from './bet.types';

const countedTournamentSchema = z.object({
  tournamentId: z.string(),
  endsAt: z.date(),
  finalized: z.boolean(),
});

export type CountedTournament = z.infer<typeof countedTournamentSchema>;

/**
 * Adds a new bet to the tournament_bets ledger, the durable record that the
 * live board and final placements both derive from: one row per tournament,
 * in one statement. The unique (tournament_id, external_bet_id) pair backs it.
 */
export async function insertTournamentBets(
  tx: TransactionClient,
  bet: StoredBet,
  tournamentIds: string[],
): Promise<void> {
  if (tournamentIds.length === 0) return;
  await tx.$executeRaw`
    INSERT INTO tournament_bets (tournament_id, bet_id, external_bet_id, player_id, amount, created_at)
    SELECT tournament.id, ${bet.id}::uuid, ${bet.externalBetId}, ${bet.playerId}, ${bet.amount}, ${bet.createdAt}::timestamptz
    FROM unnest(${tournamentIds}::uuid[]) AS tournament(id)`;
}

/** Every tournament a stored bet counts toward, finalized ones included. */
export async function findCountedTournaments(
  tx: TransactionClient,
  betId: string,
): Promise<CountedTournament[]> {
  const rows: unknown = await tx.$queryRaw`
    SELECT tb.tournament_id AS "tournamentId", t.ends_at AS "endsAt",
           t.finalized_at IS NOT NULL AS finalized
    FROM tournament_bets tb
    JOIN tournaments t ON t.id = tb.tournament_id
    WHERE tb.bet_id = ${betId}::uuid`;
  return parseQueryRows(rows, countedTournamentSchema, 'findCountedTournaments');
}
