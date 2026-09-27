import { Server } from 'http';
import { InjectionToken } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import Redis from 'ioredis';
import { ApiModule } from '../../apps/api/src/api.module';
import { configureApiApp, createApiAdapter } from '../../apps/api/src/configure-api-app';
import { PrismaService } from '@app/platform/database/prisma.service';
import { REDIS_CLIENT } from '@app/platform/redis/redis-client';

export interface TestApp {
  app: NestFastifyApplication;
  server: Server;
  prisma: PrismaService;
  redis: Redis;
  get<T>(token: InjectionToken<T>): T;
  resetDatabase(): Promise<void>;
  resetRedis(): Promise<void>;
  close(): Promise<void>;
}

/** Boots the real ApiModule in-process against real Postgres and Redis (the
 * *_test database and Redis db 1, via .env.test), with production's global
 * pipes. Specs drive it over HTTP, and reach internals (a service, Prisma, a
 * spy) only where a failure or a timer can't be produced from outside. */
export async function createTestApp(): Promise<TestApp> {
  const app = await NestFactory.create<NestFastifyApplication>(ApiModule, createApiAdapter(), {
    logger: false,
  });
  configureApiApp(app);

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const prisma = app.get(PrismaService);
  const redis = app.get(REDIS_CLIENT);

  const server = app.getHttpAdapter().getInstance().server as Server;
  server.setMaxListeners(50);

  return {
    app,
    server,
    prisma,
    redis,
    get: <T>(token: InjectionToken<T>) => app.get(token),
    resetDatabase: async () => {
      await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "tournament_bets", "final_placements", "bets", "tournaments" CASCADE',
      );
    },
    resetRedis: async () => {
      await redis.flushdb();
    },
    close: () => app.close(),
  };
}

/** Registers the per-file lifecycle: one app for the file, and a clean
 * database and Redis before each test. The object is filled in beforeAll. */
export function useTestApp(): TestApp {
  const testApp = {} as TestApp;
  beforeAll(async () => {
    Object.assign(testApp, await createTestApp());
  });
  afterAll(() => testApp.close());
  beforeEach(async () => {
    await testApp.resetDatabase();
    await testApp.resetRedis();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  return testApp;
}
