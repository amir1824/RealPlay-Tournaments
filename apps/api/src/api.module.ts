import { Module } from '@nestjs/common';
import { PlatformModule } from '@app/platform/platform.module';
import { TournamentsHttpModule } from '@app/tournaments/tournaments-http.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PlatformModule, TournamentsHttpModule],
  controllers: [HealthController],
})
export class ApiModule {}
