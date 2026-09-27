import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkersModule } from './workers.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkersModule);
  app.enableShutdownHooks();
  Logger.log('Workers app started (finalization queue)', 'Bootstrap');
}

bootstrap();
