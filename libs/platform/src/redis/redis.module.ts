import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { APP_CONFIG } from '../config/config.module';
import { AppConfig } from '../config/config';
import { logEvent } from '../logging/log-event';
import { REDIS_CLIENT } from './redis-client';

function createRedisClient(config: AppConfig): Redis {
  const logger = new Logger('Redis');
  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    commandTimeout: config.redisCommandTimeoutMs,
  });
  client.on('error', (error: unknown) =>
    logger.warn(logEvent('redis.connection_error', { error: String(error) })),
  );
  return client;
}

@Global()
@Module({
  providers: [{ provide: REDIS_CLIENT, inject: [APP_CONFIG], useFactory: createRedisClient }],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  /**
   * disconnect(), not quit(): quit waits for a server reply, which stalls
   * shutdown for as long as Redis is unreachable.
   */
  onApplicationShutdown(): void {
    this.client.disconnect();
  }
}
