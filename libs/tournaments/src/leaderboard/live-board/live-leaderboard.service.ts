import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { z } from 'zod';
import { REDIS_CLIENT } from '@app/platform/redis/redis-client';
import { logEvent } from '@app/platform/logging/log-event';
import { appliedBetsKey, leaderboardKey } from '../leaderboard.keys';
import { CountedBet } from '../leaderboard.types';

/** MULTI replies [error, result] per command; a failed command fails the parse. */
const pageRepliesSchema = z.tuple([
  z.tuple([z.null(), z.array(z.string())]),
  z.tuple([z.null(), z.number()]),
]);

interface LiveBoardPage {
  total: number;
  players: Array<{ playerId: string; score: number }>;
}

/** ZRANGE ... WITHSCORES replies [member, score, member, score, ...]. */
const WITHSCORES_STRIDE = 2;

/**
 * KEYS: leaderboard, applied set. ARGV: externalBetId, amount, playerId,
 * safety expiry (epoch ms). Returns 1 when applied, 0 when this externalBetId
 * was already applied. PEXPIREAT ... NX (Redis 7) gives a key its expiry on
 * the first write and leaves any later one, such as finalization's, alone.
 */
const APPLY_BET_LUA = `
  if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then return 0 end
  redis.call('ZINCRBY', KEYS[1], -tonumber(ARGV[2]), ARGV[3])
  redis.call('SADD', KEYS[2], ARGV[1])
  redis.call('PEXPIREAT', KEYS[1], ARGV[4], 'NX')
  redis.call('PEXPIREAT', KEYS[2], ARGV[4], 'NX')
  return 1
`;
const APPLY_BET_KEY_COUNT = 2;

/**
 * Finalization shortens a board's expiry to 24h, but its EXPIRE is a no-op on
 * keys that don't exist yet, and a write landing after it (a bet that
 * committed first, or a replay) would create keys that never expire. Every
 * write therefore sets this safety expiry, 7 days past endsAt.
 */
const BOARD_EXPIRY_AFTER_END_MS = 604800000;

/**
 * The Redis live leaderboard: a ZSET of negated scores, so a plain ascending
 * ZRANGE reads "score DESC, playerId ASC" with no sort in the app.
 *
 * Applies are idempotent through a per-tournament applied set. Redis doesn't
 * roll back a script that fails midway, so the Lua script marks a bet only
 * after its ZINCRBY succeeded. Postgres stays the durable idempotency record.
 */
@Injectable()
export class LiveLeaderboardService {
  private readonly logger = new Logger(LiveLeaderboardService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async applyMany(countedBets: CountedBet[]): Promise<void> {
    await Promise.all(countedBets.map((countedBet) => this.applyBet(countedBet)));
  }

  private async applyBet(countedBet: CountedBet): Promise<void> {
    const { tournamentId } = countedBet;
    const appliedNow = await this.redis.eval(
      APPLY_BET_LUA,
      APPLY_BET_KEY_COUNT,
      leaderboardKey(tournamentId),
      appliedBetsKey(tournamentId),
      countedBet.externalBetId,
      countedBet.amount,
      countedBet.playerId,
      countedBet.tournamentEndsAt.getTime() + BOARD_EXPIRY_AFTER_END_MS,
    );
    if (appliedNow === 0) return;
    this.logger.log(
      logEvent('leaderboard.projected', {
        tournamentId,
        playerId: countedBet.playerId,
        externalBetId: countedBet.externalBetId,
      }),
    );
  }

  /**
   * One page and the board's size in a single MULTI, so a bet landing between
   * the two reads can't make the total disagree with the page.
   */
  async readPage(tournamentId: string, offset: number, limit: number): Promise<LiveBoardPage> {
    const key = leaderboardKey(tournamentId);
    const replies = await this.redis
      .multi()
      .zrange(key, offset, offset + limit - 1, 'WITHSCORES')
      .zcard(key)
      .exec();
    const [[, raw], [, total]] = pageRepliesSchema.parse(replies);
    const players = raw
      .filter((_, index) => index % WITHSCORES_STRIDE === 0)
      .map((playerId, position) => ({
        playerId,
        score: -Number(raw[position * WITHSCORES_STRIDE + 1]),
      }));
    return { total, players };
  }

  /**
   * Finalized boards are read from final_placements, so Redis only needs to
   * keep the live copy for a bounded time.
   */
  async expire(tournamentId: string, seconds: number): Promise<void> {
    await this.redis
      .multi()
      .expire(leaderboardKey(tournamentId), seconds)
      .expire(appliedBetsKey(tournamentId), seconds)
      .exec();
  }
}
