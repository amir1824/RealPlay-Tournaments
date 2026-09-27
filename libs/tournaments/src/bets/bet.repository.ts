import { z } from 'zod';
import { parseFirstQueryRow } from '@app/platform/database/parse-query-rows';
import { TransactionClient } from '@app/platform/database/transaction-runner';
import { IngestBetInput, StoredBet } from './bet.types';

const storedBetSchema = z.object({
  id: z.string(),
  externalBetId: z.string(),
  playerId: z.string(),
  amount: z.number(),
  currency: z.string(),
  createdAt: z.date(),
});

/**
 * Idempotency lives in the unique constraint, never in a check-then-insert:
 * undefined means this externalBetId was already stored.
 */
export async function insertBetIfAbsent(
  tx: TransactionClient,
  input: IngestBetInput,
): Promise<StoredBet | undefined> {
  const rows: unknown = await tx.$queryRaw`
    INSERT INTO bets (external_bet_id, player_id, amount, currency, created_at)
    VALUES (${input.externalBetId}, ${input.playerId}, ${input.amount}, ${input.currency}, ${input.createdAt}::timestamptz)
    ON CONFLICT (external_bet_id) DO NOTHING
    RETURNING id, external_bet_id AS "externalBetId", player_id AS "playerId", amount, currency,
      created_at AS "createdAt"`;
  return parseFirstQueryRow(rows, storedBetSchema, 'insertBetIfAbsent');
}

export async function findBetByExternalId(
  tx: TransactionClient,
  externalBetId: string,
): Promise<StoredBet | undefined> {
  const bet = await tx.bet.findUnique({
    where: { externalBetId },
    select: {
      id: true,
      externalBetId: true,
      playerId: true,
      amount: true,
      currency: true,
      createdAt: true,
    },
  });
  return bet ?? undefined;
}
