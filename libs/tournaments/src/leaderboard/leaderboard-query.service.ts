import { Injectable, NotFoundException } from '@nestjs/common';
import { LiveLeaderboardService } from './live-board/live-leaderboard.service';
import { FinalPlacementRepository } from '../finalization/final-placement.repository';
import { TournamentRepository } from '../tournament/tournament.repository';
import { LeaderboardPage, LeaderboardQuery, LeaderboardResponse } from './leaderboard.types';

@Injectable()
export class LeaderboardQueryService {
  constructor(
    private readonly tournaments: TournamentRepository,
    private readonly finalPlacements: FinalPlacementRepository,
    private readonly liveLeaderboard: LiveLeaderboardService,
  ) {}

  /**
   * Live standings come from Redis; once finalized, from final_placements,
   * which are authoritative and immutable. Reads use the stored id: the UUID
   * param matches in any case, but Redis keys are case-sensitive.
   */
  async getLeaderboard(requested: LeaderboardQuery): Promise<LeaderboardResponse> {
    const tournament = await this.tournaments.findById(requested.tournamentId);
    if (!tournament) {
      throw new NotFoundException(`Tournament ${requested.tournamentId} was not found`);
    }
    const query = { ...requested, tournamentId: tournament.id };
    const source = tournament.finalizedAt ? 'final' : 'live';
    const page = source === 'final' ? await this.finalPage(query) : await this.livePage(query);
    return { ...query, source, ...page };
  }

  private async livePage(query: LeaderboardQuery): Promise<LeaderboardPage> {
    const { total, players: entries } = await this.liveLeaderboard.readPage(
      query.tournamentId,
      query.offset,
      query.limit,
    );
    const players = entries.map((entry, index) => ({
      placement: query.offset + index + 1,
      ...entry,
    }));
    return { total, players };
  }

  private async finalPage(query: LeaderboardQuery): Promise<LeaderboardPage> {
    const [rows, total] = await Promise.all([
      this.finalPlacements.findPage(query.tournamentId, query.limit, query.offset),
      this.finalPlacements.count(query.tournamentId),
    ]);
    const players = rows.map((row) => ({
      placement: row.placement,
      playerId: row.playerId,
      score: Number(row.score),
    }));
    return { total, players };
  }
}
