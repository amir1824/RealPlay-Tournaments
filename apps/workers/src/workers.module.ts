import { Module } from '@nestjs/common';
import { PlatformModule } from '@app/platform/platform.module';
import { TournamentsWorkersModule } from '@app/tournaments/tournaments-workers.module';

@Module({
  imports: [PlatformModule, TournamentsWorkersModule],
})
export class WorkersModule {}
