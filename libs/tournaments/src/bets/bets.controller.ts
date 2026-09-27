import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { BetIngestionResponse } from './bet.types';
import { BetIngestionService } from './bet-ingestion.service';
import { CreateBetDto } from './create-bet.dto';

@Controller()
export class BetsController {
  constructor(private readonly betIngestionService: BetIngestionService) {}

  /**
   * Stores a bet and counts it toward every open tournament whose window holds
   * its createdAt. 201 for a new bet, 200 for a duplicate externalBetId (the
   * first stored bet wins, and no score changes).
   */
  @Post('bet')
  async ingest(
    @Body() dto: CreateBetDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<BetIngestionResponse> {
    const result = await this.betIngestionService.ingest({
      ...dto,
      createdAt: new Date(dto.createdAt),
    });
    reply.status(result.duplicate ? HttpStatus.OK : HttpStatus.CREATED);
    return result;
  }
}
