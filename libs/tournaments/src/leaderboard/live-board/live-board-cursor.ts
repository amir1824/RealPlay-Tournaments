import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@app/platform/redis/redis-client';
import { replayCursorKey } from '../leaderboard.keys';

/**
 * Moves the cursor forward only, and only while its generation is unchanged.
 * Forward: two workers finishing out of order must not send it back. Same
 * generation: a Redis flush mid-replay deletes the key, so the advance is
 * dropped and the next run replays the whole open ledger into the empty boards.
 */
const ADVANCE_CURSOR_LUA = `
  local current = redis.call('GET', KEYS[1])
  local prefix = ARGV[1] .. ':'
  if not current or string.sub(current, 1, #prefix) ~= prefix then return 0 end
  if tonumber(ARGV[2]) <= tonumber(string.sub(current, #prefix + 1)) then return 0 end
  redis.call('SET', KEYS[1], prefix .. ARGV[2])
  return 1
`;
const ADVANCE_CURSOR_KEY_COUNT = 1;
const NEVER_REPLAYED_MS = 0;

export interface ReplayCursor {
  generation: string;
  replayedUntil: Date;
}

/**
 * Lives in Redis next to the boards it describes, so it is lost or restored
 * together with them: a missing cursor means a full replay, and one restored
 * from an older snapshot is exactly as old as the boards.
 */
@Injectable()
export class LiveBoardCursor {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** The current cursor, or a new generation from the start when Redis has none. */
  async begin(): Promise<ReplayCursor> {
    await this.redis.set(replayCursorKey(), `${randomUUID()}:${NEVER_REPLAYED_MS}`, 'NX');
    const value = await this.redis.get(replayCursorKey());
    if (!value) throw new Error('Replay cursor vanished right after it was set');
    const [generation = '', replayedUntilMs = ''] = value.split(':');
    return { generation, replayedUntil: new Date(Number(replayedUntilMs)) };
  }

  async advance(cursor: ReplayCursor, replayedUntil: Date): Promise<void> {
    await this.redis.eval(
      ADVANCE_CURSOR_LUA,
      ADVANCE_CURSOR_KEY_COUNT,
      replayCursorKey(),
      cursor.generation,
      replayedUntil.getTime(),
    );
  }
}
