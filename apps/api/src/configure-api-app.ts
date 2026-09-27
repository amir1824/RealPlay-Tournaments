import { randomUUID } from 'crypto';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { APP_CONFIG } from '@app/platform/config/config.module';
import { AppExceptionFilter } from '@app/platform/http/app-exception.filter';
import { setupOpenApi } from './openapi';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * A caller's x-request-id is kept, so one id follows a request across
 * services; otherwise a UUID, unique across replicas and restarts (Fastify's
 * default, req-1, req-2, …, restarts at 1 in every process).
 */
export function createApiAdapter(): FastifyAdapter {
  return new FastifyAdapter({ requestIdHeader: REQUEST_ID_HEADER, genReqId: () => randomUUID() });
}

export function configureApiApp(app: NestFastifyApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AppExceptionFilter());
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', async (request, reply) => {
      void reply.header(REQUEST_ID_HEADER, request.id);
    });
  if (!app.get(APP_CONFIG).openApiEnabled) return;
  setupOpenApi(app);
}
