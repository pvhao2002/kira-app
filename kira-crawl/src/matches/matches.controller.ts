import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MatchesService } from './matches.service';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({
    summary: 'List matches for a given date',
    description:
      'Crawls AiScore /matches and returns mapped league, team, event, and result data. ' +
      'Includes the raw decoded AiScore protobuf payload in `aiscoreRaw`.',
  })
  @ApiQuery({ name: 'date', required: false, example: '20180101', description: 'Match date in YYYYMMDD format (default: 20180101)' })
  @ApiQuery({ name: 'sport_id', required: false, example: '1', description: 'Sport ID (default: 1 = football)' })
  @ApiQuery({ name: 'lang', required: false, example: '2', description: 'Language ID (default: 2)' })
  @ApiQuery({ name: 'tz', required: false, example: '07:00', description: 'Timezone offset, e.g. 07:00 (default: 07:00)' })
  @ApiQuery({ name: 'match_id', required: false, example: '', description: 'Filter response to a single match' })
  @ApiQuery({ name: 'raw', required: false, example: 'true', description: 'Return raw decoded protobuf instead of mapped response' })
  @ApiOkResponse({ description: 'Mapped match list with aiscoreRaw' })
  findMatches(@Query() query: Record<string, string | undefined>) {
    return this.matchesService.findMatches('matches', query);
  }

  @Get('odds')
  @ApiOperation({
    summary: 'Crawl odds for a single match',
    description:
      'Fetches odds detail from AiScore using a public match page URL. ' +
      'Returns mapped snapshot `odds`, full `oddsTimeline`, and raw decoded payloads in `aiscoreRaw`.',
  })
  @ApiQuery({
    name: 'event_link',
    required: true,
    example: 'https://www.aiscore.com/match-home-away/g6763i4gwvvso7r',
    description: 'AiScore public match page URL',
  })
  @ApiOkResponse({ description: 'Odds snapshots, full timeline, and raw AiScore responses' })
  @ApiBadRequestResponse({ description: 'event_link query parameter is missing or invalid' })
  findMatchOdds(@Query('event_link') eventLink: string | undefined) {
    if (!eventLink) {
      throw new BadRequestException('event_link query parameter is required');
    }

    return this.matchesService.findMatchOdds('odds', eventLink);
  }
}
