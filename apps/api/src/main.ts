import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { APP_CONFIG } from '@app/platform/config/config.module';
import { ApiModule } from './api.module';
import { configureApiApp, createApiAdapter } from './configure-api-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(ApiModule, createApiAdapter());
  configureApiApp(app);
  app.enableShutdownHooks();

  const config = app.get(APP_CONFIG);
  await app.listen(config.apiPort, '0.0.0.0');
  Logger.log(`API listening on port ${config.apiPort}`, 'Bootstrap');
}

bootstrap();
