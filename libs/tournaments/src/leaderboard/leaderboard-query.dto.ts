import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { POSTGRES_INT_MAX } from '@app/platform/database/postgres-limits';

const DEFAULT_LEADERBOARD_LIMIT = 20;
const MAX_LEADERBOARD_LIMIT = 100;

export class LeaderboardQueryDto {
  /** Page size, 1 to 100. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LEADERBOARD_LIMIT)
  limit: number = DEFAULT_LEADERBOARD_LIMIT;

  /** Players to skip; placements stay absolute across pages. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(POSTGRES_INT_MAX)
  offset: number = 0;
}
