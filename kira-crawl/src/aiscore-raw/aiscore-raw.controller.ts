import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiBadGatewayResponse,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import { AiscoreRawService } from './aiscore-raw.service';

@ApiTags('aiscore-raw')
@Controller('aiscore')
export class AiscoreRawController {
    constructor(private readonly aiscoreRawService: AiscoreRawService) {}

    @Get('raw')
    @ApiOperation({
        summary: 'Fetch AiScore API and return decoded protobuf JSON',
        description:
            'Opens an AiScore public page in Playwright, captures the requested AiScore API response from network traffic, ' +
            'decodes the protobuf response body, and returns the decoded JSON payload directly.',
    })
    @ApiQuery({
        name: 'publicPageUrl',
        required: true,
        example: 'https://www.aiscore.com/20180101',
        description: 'AiScore public page URL that triggers the API request (must be https://www.aiscore.com/...)',
    })
    @ApiQuery({
        name: 'apiUrl',
        required: true,
        example: 'https://api.aiscore.com/v1/web/api/matches?lang=2&sport_id=1&date=20180101&tz=07%3A00',
        description: 'Full AiScore API URL (must be https://api.aiscore.com/...)',
    })
    @ApiOkResponse({
        description: 'Decoded protobuf JSON payload from AiScore upstream response.',
        schema: {
            type: 'object',
            additionalProperties: true,
        },
    })
    @ApiBadRequestResponse({ description: 'publicPageUrl/apiUrl parameter missing, invalid, or not allowed' })
    @ApiBadGatewayResponse({ description: 'Upstream AiScore request failed' })
    fetchRaw(
        @Query('publicPageUrl') publicPageUrl: string | undefined,
        @Query('apiUrl') apiUrl: string | undefined,
    ) {
        if (!publicPageUrl) {
            throw new BadRequestException('publicPageUrl query parameter is required');
        }

        if (!apiUrl) {
            throw new BadRequestException('apiUrl query parameter is required');
        }

        return this.aiscoreRawService.fetchRaw(publicPageUrl, apiUrl);
    }
}
