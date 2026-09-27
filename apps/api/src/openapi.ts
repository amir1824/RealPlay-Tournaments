import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const OPENAPI_PATH = 'docs';
const API_TITLE = 'RealPlay Tournaments';
const API_DESCRIPTION = 'Bet ingestion, tournaments, and the live leaderboard.';
const API_VERSION = '1.0';

export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle(API_TITLE)
    .setDescription(API_DESCRIPTION)
    .setVersion(API_VERSION)
    .build();
  SwaggerModule.setup(OPENAPI_PATH, app, SwaggerModule.createDocument(app, config));
}
