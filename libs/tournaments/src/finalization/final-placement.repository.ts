import { Injectable } from '@nestjs/common';
import { FinalPlacement } from '@prisma/client';
import { PrismaService } from '@app/platform/database/prisma.service';
import { TransactionClient } from '@app/platform/database/transaction-runner';

/**
 * Ranked in SQL so no player set sits in worker memory under the lock;
 * COLLATE "C" matches the byte-order tie-break of the Redis live board.
 */
export async function insertFinalPlacements(
  tx: TransactionClient,
  tournamentId: string,
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO final_placements (tournament_id, player_id, score, placement)
    SELECT ${tournamentId}::uuid, player_id, SUM(amount),
           row_number() OVER (ORDER BY SUM(amount) DESC, player_id COLLATE "C" ASC)
    FROM tournament_bets
    WHERE tournament_id = ${tournamentId}::uuid
    GROUP BY player_id`;
}

@Injectable()
export class FinalPlacementRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPage(tournamentId: string, limit: number, offset: number): Promise<FinalPlacement[]> {
    return this.prisma.finalPlacement.findMany({
      where: { tournamentId },
      orderBy: { placement: 'asc' },
      skip: offset,
      take: limit,
    });
  }

  count(tournamentId: string): Promise<number> {
    return this.prisma.finalPlacement.count({ where: { tournamentId } });
  }
}
