import { Controller, Get, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { DependencyUnavailableError } from '@app/platform/errors/dependency-unavailable.error';
import { PrismaService } from '@app/platform/database/prisma.service';
import { REDIS_CLIENT } from '@app/platform/redis/redis-client';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * 503 on the first dependency down. AppExceptionFilter logs the cause; the
   * body names only the dependency, since health endpoints are often public.
   */
  @Get('health')
  async check(): Promise<{ status: 'ok'; postgres: 'ok'; redis: 'ok' }> {
    await probe('postgres', () => this.prisma.$queryRaw`SELECT 1`);
    await probe('redis', () => this.redis.ping());
    return { status: 'ok', postgres: 'ok', redis: 'ok' };
  }
}

async function probe(dependency: string, ping: () => Promise<unknown>): Promise<void> {
  await ping().catch((error: unknown) => {
    throw new DependencyUnavailableError(dependency, error);
  });
}
