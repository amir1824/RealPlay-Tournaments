import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BetIngestionService } from './bets/bet-ingestion.service';
import { FinalPlacementRepository } from './finalization/final-placement.repository';
import { FINALIZATION_QUEUE } from './finalization/finalization.queue';
import { FinalizationService } from './finalization/finalization.service';
import { FinalizationSweep } from './finalization/finalization.sweep';
import { LedgerReplayRepository } from './leaderboard/ledger-replay.repository';
import { LiveBoardCursor } from './leaderboard/live-board/live-board-cursor';
import { LiveBoardReplay } from './leaderboard/live-board/live-board-replay.service';
import { LiveLeaderboardService } from './leaderboard/live-board/live-leaderboard.service';
import { LeaderboardQueryService } from './leaderboard/leaderboard-query.service';
import { TournamentRepository } from './tournament/tournament.repository';
import { FinalizationScheduler } from './finalization/finalization.scheduler';
import { TournamentsService } from './tournament/tournaments.service';

/**
 * Domain core, shared by both adapters. Expects PlatformModule (config,
 * Prisma, Redis, BullMQ root) to be imported by the host app.
 */
@Module({
  imports: [BullModule.registerQueue({ name: FINALIZATION_QUEUE })],
  providers: [
    TournamentRepository,
    FinalizationScheduler,
    FinalPlacementRepository,
    TournamentsService,
    BetIngestionService,
    LiveLeaderboardService,
    LedgerReplayRepository,
    LiveBoardCursor,
    LiveBoardReplay,
    LeaderboardQueryService,
    FinalizationService,
    FinalizationSweep,
  ],
  exports: [
    BullModule,
    TournamentsService,
    BetIngestionService,
    LeaderboardQueryService,
    FinalizationService,
    FinalizationSweep,
    LiveBoardReplay,
  ],
})
export class TournamentsModule {}
