import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module';
import { AppConfig } from '../config/config';

const RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 2000;
const KEEP_COMPLETED_JOBS = 1000;
const KEEP_FAILED_JOBS = 5000;

/**
 * BullMQ owns and closes these connections. Producers fail on the first
 * disconnected request; Workers create separate blocking connections and
 * override maxRetriesPerRequest to null internally.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        connection: { url: config.redisUrl, maxRetriesPerRequest: 0 },
        defaultJobOptions: {
          attempts: RETRY_ATTEMPTS,
          backoff: { type: 'exponential', delay: RETRY_BASE_DELAY_MS },
          removeOnComplete: KEEP_COMPLETED_JOBS,
          removeOnFail: KEEP_FAILED_JOBS,
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class BullmqRootModule {}
