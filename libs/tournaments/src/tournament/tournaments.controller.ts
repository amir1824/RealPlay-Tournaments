import { Body, Controller, Post } from '@nestjs/common';
import { CreateTournamentDto } from './create-tournament.dto';
import { TournamentResponse } from './tournament.types';
import { TournamentsService } from './tournaments.service';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  /** Creates a tournament and schedules its final snapshot for endsAt + grace. */
  @Post()
  async create(@Body() dto: CreateTournamentDto): Promise<TournamentResponse> {
    return this.tournamentsService.create({
      ...dto,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
    });
  }
}
