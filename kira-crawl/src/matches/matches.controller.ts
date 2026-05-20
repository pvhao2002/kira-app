import { Controller, Get, Query } from '@nestjs/common';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  findMatches(@Query() query: Record<string, string | undefined>) {
    return this.matchesService.findMatches(query);
  }
}
