import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { BullmqRootModule } from './queue/bullmq-root.module';
import { RedisModule } from './redis/redis.module';

/**
 * Stand-in for the infrastructure an existing backend already provides:
 * typed config, Prisma, a Redis client and the BullMQ root connection.
 */
@Module({
  imports: [AppConfigModule, DatabaseModule, RedisModule, BullmqRootModule],
  exports: [AppConfigModule, DatabaseModule, RedisModule, BullmqRootModule],
})
export class PlatformModule {}
