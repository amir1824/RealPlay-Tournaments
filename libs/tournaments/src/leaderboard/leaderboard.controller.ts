import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { LeaderboardQueryDto } from './leaderboard-query.dto';
import { LeaderboardQueryService } from './leaderboard-query.service';
import { LeaderboardResponse } from './leaderboard.types';

@Controller('tournaments/:id/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardQueryService: LeaderboardQueryService) {}

  /**
   * One page of placements, score DESC with ties by playerId. Live from Redis
   * until the tournament is finalized, then from final_placements.
   */
  @Get()
  async getLeaderboard(
    @Param('id', ParseUUIDPipe) tournamentId: string,
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardResponse> {
    return this.leaderboardQueryService.getLeaderboard({ tournamentId, ...query });
  }
}
