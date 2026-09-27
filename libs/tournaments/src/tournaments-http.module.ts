import { Module } from '@nestjs/common';
import { BetsController } from './bets/bets.controller';
import { LeaderboardController } from './leaderboard/leaderboard.controller';
import { TournamentsController } from './tournament/tournaments.controller';
import { TournamentsModule } from './tournaments.module';

@Module({
  imports: [TournamentsModule],
  controllers: [TournamentsController, BetsController, LeaderboardController],
})
export class TournamentsHttpModule {}
