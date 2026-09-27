import { Module } from '@nestjs/common';
import { FinalizationProcessor } from './finalization/finalization.processor';
import { TournamentsBackgroundTasks } from './tournaments-background-tasks';
import { TournamentsModule } from './tournaments.module';

@Module({
  imports: [TournamentsModule],
  providers: [FinalizationProcessor, TournamentsBackgroundTasks],
})
export class TournamentsWorkersModule {}
