import { Injectable } from '@nestjs/common';
import { LedgerPosition, LedgerReplayRepository } from '../ledger-replay.repository';
import { LiveBoardCursor } from './live-board-cursor';
import { LiveLeaderboardService } from './live-leaderboard.service';

const REPLAY_PAGE_SIZE = 500;
/**
 * A row is stamped when its transaction starts and visible only once it
 * commits, so each run re-reads this far behind the cursor. It must exceed the
 * longest bet transaction, which Prisma's 5s interactive timeout bounds.
 */
const REPLAY_OVERLAP_MS = 30000;
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * The durable retry behind the live board. Every run re-applies the ledger
 * rows written since the cursor, then advances it; re-applying a row that is
 * already on the board is a no-op (the Lua applied set). That covers a Redis
 * failure the client never retried, a crash between commit and Redis, and
 * Redis losing its data, with no marker written per bet.
 */
@Injectable()
export class LiveBoardReplay {
  constructor(
    private readonly ledger: LedgerReplayRepository,
    private readonly cursor: LiveBoardCursor,
    private readonly liveLeaderboard: LiveLeaderboardService,
  ) {}

  async replay(): Promise<void> {
    const startedAt = await this.ledger.readClock();
    const cursor = await this.cursor.begin();
    const from = new Date(cursor.replayedUntil.getTime() - REPLAY_OVERLAP_MS);
    await this.replayFrom({ insertedAt: from, id: ZERO_UUID }, startedAt);
    await this.cursor.advance(cursor, startedAt);
  }

  /** Rows stamped after `until` wait for the next run, which re-reads from `until` minus the overlap. */
  private async replayFrom(position: LedgerPosition, until: Date): Promise<void> {
    const rows = await this.ledger.findOpenRowsAfter(position, until, REPLAY_PAGE_SIZE);
    await this.liveLeaderboard.applyMany(rows);
    const lastOfFullPage = rows[REPLAY_PAGE_SIZE - 1];
    if (!lastOfFullPage) return;
    await this.replayFrom(lastOfFullPage, until);
  }
}
