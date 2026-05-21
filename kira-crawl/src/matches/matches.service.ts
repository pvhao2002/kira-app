import {BadGatewayException, BadRequestException, Injectable} from '@nestjs/common';
import {chromium, type CDPSession, type Page} from 'playwright';
import {resolveAiscoreUserDataDir} from '../aiscore-browser.util';
import {AiscoreProtobufService} from './aiscore-protobuf.service';

type MatchQuery = {
    date?: string;
    sport_id?: string;
    lang?: string;
    tz?: string;
    match_id?: string;
    raw?: string;
};

type DecodedRecord = Record<string, unknown>;
type MatchOddsDetails = {
    asia?: DecodedRecord;
    eu?: DecodedRecord;
    bs?: DecodedRecord;
    corner?: DecodedRecord;
};
type OddsDetailType = keyof MatchOddsDetails;
type OddsSnapshotType = 'open' | 'pre-match' | 'half-time';
type OddsTimelineMarket = 'hdc' | 'eu' | 'ou' | 'corner';
type OddsTimelineItem = {
    market: OddsTimelineMarket;
    line: string;
    priceA: string;
    priceB: string;
    matchMinute?: string;
    crawledAt?: string;
    score?: string;
    statusId?: number;
};
type MatchPageInfo = {
    status?: string;
    statusId?: number;
    homeScores: number[];
    awayScores: number[];
};
type NetworkBodyCapture = {
    promises: Map<string, Promise<Buffer>>;
    dispose: () => void;
};

@Injectable()
export class MatchesService {
    private readonly defaultTimeout = 80000;
    private readonly apiBaseUrl = 'https://api.aiscore.com/v1/web/api/matches';
    private readonly oddsListApiBaseUrl = 'https://api.aiscore.com/v1/web/api/match/odds_list';
    private readonly oddsDetailApiBaseUrl = 'https://api.aiscore.com/v1/web/api/match/odds/detail';
    private readonly teamStatsApiBaseUrl = 'https://api.aiscore.com/v1/web/api/match/team_stats';

    constructor(private readonly protobufService: AiscoreProtobufService) {
    }

    async findMatches(api: string, query: MatchQuery) {
        const params = this.normalizeQuery(query);
        const apiUrl = this.buildApiUrl(params);
        const publicPageUrl = this.buildPublicPageUrl(apiUrl);

        return this.withBrowserPage(api, publicPageUrl, async (page, timeout) => {
            const [body] = await this.captureApiResponseBodies(page, [apiUrl], publicPageUrl, timeout);
            const decoded = this.protobufService.decodeMatches(body);

            if (params.raw) {
                return {
                    query: params,
                    data: decoded,
                };
            }

            const matches = this.asArray(decoded.matches);
            const filteredMatches = params.match_id
                ? matches.filter((match) => this.asRecord(match).id === params.match_id)
                : matches;

            const events = filteredMatches.map((match) => this.mapDatabaseEvent(match, decoded));

            return {
                date: params.date,
                sportId: Number(params.sport_id),
                lang: Number(params.lang),
                tz: params.tz,
                total: filteredMatches.length,
                events,
                aiscoreRaw: decoded,
            };
        });
    }

    async findMatchOdds(api: string, eventLink: string) {
        const publicPageUrl = this.parseAndValidateEventLink(eventLink).toString();
        const oddsPublicPageUrl = this.buildOddsPublicPageUrl(publicPageUrl);
        const matchId = this.extractMatchIdFromEventLink(publicPageUrl);
        const oddsListApiUrl = this.buildOddsListApiUrl(matchId);
        const teamStatsApiUrl = this.buildTeamStatsApiUrl(matchId);

        return this.withBrowserPage(api, oddsPublicPageUrl, async (page, timeout) => {
            const [oddsListBody] = await this.captureApiResponseBodies(page, [oddsListApiUrl], oddsPublicPageUrl, timeout);
            const oddsList = this.protobufService.decodeMatchOdds(oddsListBody);
            if (!this.hasBet365Company(oddsList)) {
                return {};
            }


            const oddsDetails = await this.captureWebOddsDetailBody(page, matchId, timeout);
            const timelineOdds = this.mapOddsTimelineForDatabase(oddsDetails);
            const pageInfo = await this.readMatchPageInfo(page, timeout);
            const teamStatsBody = await this.captureOptionalApiBody(page, teamStatsApiUrl, publicPageUrl, timeout);
            const eventResult = teamStatsBody
                ? this.mapEventResultForDatabase(
                    pageInfo.homeScores,
                    pageInfo.awayScores,
                    this.protobufService.decodeMatchTeamStats(teamStatsBody),
                )
                : {};
            const aiscoreRaw = {
                oddsList,
                asia: oddsDetails.asia ?? null,
                eu: oddsDetails.eu ?? null,
                bs: oddsDetails.bs ?? null,
                corner: oddsDetails.corner ?? null,
                teamStats: teamStatsBody ? this.protobufService.decodeMatchTeamStats(teamStatsBody) : null,
            };

            return {
                matchId,
                event: {
                    status: pageInfo.status ?? '-',
                    statusId: pageInfo.statusId,
                },
                eventResult,
                odds: timelineOdds.length > 0 ? this.mapOddsForDatabase(oddsDetails) : this.mapOddsListForDatabase(oddsList),
                oddsTimeline: this.groupOddsTimelineForResponse(timelineOdds),
                aiscoreRaw,
            };
        });
    }

    private normalizeQuery(query: MatchQuery) {
        return {
            date: query.date ?? '20180101',
            sport_id: query.sport_id ?? '1',
            lang: query.lang ?? '2',
            tz: query.tz ?? '07:00',
            match_id: query.match_id,
            raw: query.raw === 'true',
        };
    }

    private buildApiUrl(params: ReturnType<MatchesService['normalizeQuery']>): string {
        const url = new URL(this.apiBaseUrl);
        url.search = new URLSearchParams({
            lang: params.lang,
            sport_id: params.sport_id,
            date: params.date,
            tz: params.tz,
        }).toString();

        return url.toString();
    }

    private parseAndValidateEventLink(rawUrl: string): URL {
        let url: URL;
        try {
            url = new URL(rawUrl);
        } catch {
            throw new BadRequestException(`Invalid event_link: "${rawUrl}"`);
        }

        if (url.protocol !== 'https:') {
            throw new BadRequestException(`event_link protocol must be "https:", got "${url.protocol}"`);
        }

        if (!['aiscore.com', 'www.aiscore.com'].includes(url.hostname)) {
            throw new BadRequestException(`event_link host must be "aiscore.com" or "www.aiscore.com", got "${url.hostname}"`);
        }

        return url;
    }

    private extractMatchIdFromEventLink(eventLink: string): string {
        const pathSegments = new URL(eventLink).pathname.split('/').filter(Boolean);
        const matchId = pathSegments.at(-1);
        if (!matchId) {
            throw new BadRequestException('event_link must include an AiScore match ID in the last path segment');
        }

        return matchId;
    }

    private buildOddsPublicPageUrl(eventLink: string): string {
        const url = new URL(eventLink);
        const pathSegments = url.pathname.split('/').filter(Boolean);
        if (pathSegments.at(-1) !== 'odds') {
            pathSegments.push('odds');
        }
        url.pathname = `/${pathSegments.join('/')}`;

        return url.toString();
    }

    private buildOddsListApiUrl(matchId: string): string {
        const url = new URL(this.oddsListApiBaseUrl);
        url.search = new URLSearchParams({
            match_id: matchId,
            code: '76',
        }).toString();

        return url.toString();
    }

    private buildOddsDetailApiUrl(matchId: string, oddsType: OddsDetailType): string {
        const url = new URL(this.oddsDetailApiBaseUrl);
        const params = new URLSearchParams({
            match_id: matchId,
            odds_type: oddsType,
            'cid': '2'
        });

        url.search = params.toString();

        return url.toString();
    }

    private buildTeamStatsApiUrl(matchId: string): string {
        const url = new URL(this.teamStatsApiBaseUrl);
        url.search = new URLSearchParams({
            match_id: matchId,
        }).toString();

        return url.toString();
    }

    private hasBet365Company(oddsList: DecodedRecord): boolean {
        return this.asArray(oddsList.companies).some((value) => {
            return this.isBet365Company(this.asRecord(value));
        });
    }

    private isBet365Company(company: DecodedRecord): boolean {
        const companyId = this.numberValue(company.id);
        const companyName = this.stringValue(company.name)?.replace(/\s+/g, '').toLowerCase();

        return companyId === 2 || companyName === 'bet365';
    }

    private decodeOddsDetailBody(body: Buffer, type: 'web' | 'match'): DecodedRecord | undefined {
        const decoded =
            type === 'web'
                ? this.protobufService.decodeWebMatchOddsDetail(body)
                : this.protobufService.decodeMatchOddsDetail(body);
        return Object.keys(decoded).length > 0 ? decoded : undefined;
    }

    private async readMatchPageInfo(page: Page, timeout: number): Promise<MatchPageInfo> {
        await page.waitForFunction(
            () => {
                const detail = (window as unknown as {
                    $nuxt?: {
                        $store?: {
                            state?: {
                                football?: {
                                    detail?: {
                                        WebMatchData?: {
                                            match?: unknown;
                                        };
                                    };
                                };
                            };
                        };
                    };
                }).$nuxt?.$store?.state?.football?.detail;

                return !!detail?.WebMatchData?.match;
            },
            undefined,
            {timeout},
        );

        const match = await page.evaluate(() => {
            const detail = (window as unknown as {
                $nuxt?: {
                    $store?: {
                        state?: {
                            football?: {
                                detail?: {
                                    WebMatchData?: {
                                        match?: Record<string, unknown>;
                                    };
                                };
                            };
                        };
                    };
                };
            }).$nuxt?.$store?.state?.football?.detail;

            return detail?.WebMatchData?.match ?? null;
        });

        const matchRecord = this.asRecord(match);
        return {
            status: this.mapEventStatus(matchRecord),
            statusId: this.numberValue(matchRecord.statusId),
            homeScores: this.numberArray(matchRecord.homeScores),
            awayScores: this.numberArray(matchRecord.awayScores),
        };
    }

    private async captureOptionalApiBody(
        page: Page,
        apiUrl: string,
        publicPageUrl: string,
        timeout: number,
    ): Promise<Buffer | undefined> {
        try {
            const [body] = await this.captureApiResponseBodies(page, [apiUrl], publicPageUrl, timeout);
            return body;
        } catch (error) {
            if (
                error instanceof BadGatewayException &&
                typeof error.getResponse === 'function'
            ) {
                const response = error.getResponse();
                const payload = typeof response === 'object' && response !== null ? (response as Record<string, unknown>) : {};
                if (payload.message === 'AiScore API response was not found in page network traffic') {
                    return undefined;
                }
            }
            throw error;
        }
    }

    private async captureWebOddsDetailBody(
        page: Page,
        matchId: string,
        timeout: number,
    ): Promise<MatchOddsDetails> {
        const detailConfigs: Array<{oddsType: OddsDetailType; field: OddsDetailType}> = [
            {oddsType: 'asia', field: 'asia'},
            {oddsType: 'bs', field: 'bs'},
            {oddsType: 'corner', field: 'corner'},
        ];
        const apiUrls = detailConfigs.map(({oddsType}) => this.buildOddsDetailApiUrl(matchId, oddsType));
        const bodies = await this.captureApiResponseBodiesAfterAction(
            page,
            apiUrls,
            timeout,
            async () => {
                for (const {oddsType} of detailConfigs) {
                    await this.requestOddsDetailFromPage(page, matchId, oddsType, timeout);
                }
            },
        );
        const result: MatchOddsDetails = {};
        bodies.forEach((body, index) => {
            const decoded = this.decodeOddsDetailBody(body, 'match');
            if (!decoded) {
                return;
            }
            const field = detailConfigs[index].field;
            result[field] = decoded;
        });

        return result;
    }

    private async withBrowserPage<T>(
        api: string,
        publicPageUrl: string,
        handler: (page: Page, timeout: number) => Promise<T>,
    ): Promise<T> {
        const timeout = Number(process.env.AISCORE_BROWSER_TIMEOUT_MS ?? this.defaultTimeout.toString());
        const userDataDir = resolveAiscoreUserDataDir(api);
        const userAgent =
            process.env.AISCORE_USER_AGENT ??
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0';
        const isHeadless = this.booleanEnv(process.env.PLAYWRIGHT_HEADLESS, true);
        const launchArgs = ['--disable-blink-features=AutomationControlled', '--no-first-run'];
        if (isHeadless) {
            launchArgs.push('--headless=new');
        }
        const context = await chromium.launchPersistentContext(userDataDir, {
            channel: process.env.PLAYWRIGHT_CHANNEL,
            headless: isHeadless,
            locale: 'en-US',
            timezoneId: 'Asia/Bangkok',
            userAgent,
            viewport: {
                width: 1494,
                height: 934,
            },
            args: launchArgs,
            extraHTTPHeaders: {
                'accept-language': process.env.AISCORE_ACCEPT_LANGUAGE ?? 'en-US,en;q=0.9',
            },
        });

        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });

        if (process.env.AISCORE_USER_AGENT) {
            await context.setExtraHTTPHeaders({
                'accept-language': process.env.AISCORE_ACCEPT_LANGUAGE ?? 'en-US,en;q=0.9',
                'user-agent': userAgent,
            });
        }

        try {
            if (process.env.AISCORE_COOKIE) {
                await context.addCookies(
                    process.env.AISCORE_COOKIE.split(';')
                        .map((cookie) => cookie.trim())
                        .filter(Boolean)
                        .map((cookie) => {
                            const [name, ...valueParts] = cookie.split('=');
                            return {
                                name,
                                value: valueParts.join('='),
                                domain: '.aiscore.com',
                                path: '/',
                            };
                        })
                        .filter((cookie) => cookie.name && cookie.value),
                );
            }

            const page = await context.newPage();
            await page.setExtraHTTPHeaders({
                referer: publicPageUrl,
                origin: 'https://www.aiscore.com',
                'accept-language': process.env.AISCORE_ACCEPT_LANGUAGE ?? 'en-US,en;q=0.9',
            });

            return await handler(page, timeout);
        } finally {
            await context.close();
        }
    }

    private async captureApiResponseBodies(
        page: Page,
        apiUrls: string[],
        publicPageUrl: string,
        timeout: number,
    ): Promise<Buffer[]> {
        const networkCapture = await this.captureNetworkResponseBodies(page, apiUrls, timeout);
        try {
            await page.goto(publicPageUrl, {
                waitUntil: 'domcontentloaded',
                timeout,
            });
            await this.waitForCloudflareClearance(page, timeout);

            return await Promise.all(
                apiUrls.map((apiUrl) => {
                    const body = networkCapture.promises.get(apiUrl);
                    if (!body) {
                        throw new BadGatewayException({
                            message: 'AiScore network response capture was not initialized',
                            publicPageUrl,
                            apiUrl,
                        });
                    }

                    return body;
                }),
            );
        } finally {
            networkCapture.dispose();
        }
    }

    private async captureApiResponseBodiesAfterAction(
        page: Page,
        apiUrls: string[],
        timeout: number,
        action: () => Promise<void>,
    ): Promise<Buffer[]> {
        const networkCapture = await this.captureNetworkResponseBodies(page, apiUrls, timeout);
        try {
            await action();

            return await Promise.all(
                apiUrls.map((apiUrl) => {
                    const body = networkCapture.promises.get(apiUrl);
                    if (!body) {
                        throw new BadGatewayException({
                            message: 'AiScore network response capture was not initialized',
                            apiUrl,
                        });
                    }

                    return body;
                }),
            );
        } finally {
            networkCapture.dispose();
        }
    }

    private async requestOddsDetailFromPage(
        page: Page,
        matchId: string,
        oddsType: OddsDetailType,
        timeout: number,
    ): Promise<void> {
        await page.waitForFunction(
            () => {
                const nuxt = (window as unknown as {
                    $nuxt?: {
                        $children?: unknown[];
                    };
                }).$nuxt;

                const queue = [...(nuxt?.$children ?? [])] as Array<{
                    $children?: unknown[];
                    $options?: {
                        methods?: {
                            getOddsDetail?: unknown;
                        };
                    };
                    $data?: {
                        activeTab?: unknown;
                    };
                }>;
                while (queue.length > 0) {
                    const vm = queue.shift();
                    if (!vm) {
                        continue;
                    }
                    if (
                        typeof vm.$options?.methods?.getOddsDetail === 'function' &&
                        vm.$data &&
                        Object.prototype.hasOwnProperty.call(vm.$data, 'activeTab')
                    ) {
                        return true;
                    }
                    queue.push(
                        ...((vm.$children ?? []) as Array<{
                            $children?: unknown[];
                            $options?: {
                                methods?: {
                                    getOddsDetail?: unknown;
                                };
                            };
                            $data?: {
                                activeTab?: unknown;
                            };
                        }>),
                    );
                }

                return false;
            },
            undefined,
            {timeout},
        );

        await page.evaluate(
            async ({id, type}) => {
                type OddsComponent = {
                    $children?: unknown[];
                    $options?: {
                        methods?: {
                            getOddsDetail?: unknown;
                        };
                    };
                    $data?: {
                        activeTab?: string;
                        countryId?: number;
                    };
                    activeTab?: string;
                    countryId?: number;
                    WebMatchData?: {
                        match?: {
                            id?: string;
                        };
                    };
                    getOddsDetail?: () => Promise<unknown>;
                };

                const nuxt = (window as unknown as {$nuxt?: OddsComponent}).$nuxt;
                const queue = [nuxt];
                const visited = new Set<number>();
                let target: OddsComponent | undefined;

                while (queue.length > 0) {
                    const vm = queue.shift();
                    if (!vm) {
                        continue;
                    }

                    const vmWithUid = vm as OddsComponent & {_uid?: number};
                    if (typeof vmWithUid._uid === 'number') {
                        if (visited.has(vmWithUid._uid)) {
                            continue;
                        }
                        visited.add(vmWithUid._uid);
                    }

                    const hasGetOddsDetail =
                        typeof vm.$options?.methods?.getOddsDetail === 'function' &&
                        (vm.$data ? Object.prototype.hasOwnProperty.call(vm.$data, 'activeTab') : false);
                    if (hasGetOddsDetail) {
                        target = vm;
                        break;
                    }

                    queue.push(...((vm.$children ?? []) as OddsComponent[]));
                }

                if (!target || typeof target.getOddsDetail !== 'function') {
                    throw new Error('Cannot find AiScore odds detail component to trigger tab request');
                }

                target.activeTab = type;
                target.countryId = 2;
                if (!target.WebMatchData?.match?.id) {
                    target.WebMatchData = {match: {id}};
                }
                await target.getOddsDetail();
            },
            {id: matchId, type: oddsType},
        );
    }

    private async captureNetworkResponseBodies(
        page: Page,
        apiUrls: string[],
        timeout: number,
    ): Promise<NetworkBodyCapture> {
        const session = await page.context().newCDPSession(page);
        await session.send('Network.enable');

        const matchedRequests = new Map<string, string>();
        const pendingBodies = new Map<
            string,
            {
                resolve: (body: Buffer) => void;
                reject: (error: Error) => void;
            }
        >();
        const timers: NodeJS.Timeout[] = [];
        const promises = new Map(
            apiUrls.map((apiUrl) => [
                apiUrl,
                new Promise<Buffer>((resolve, reject) => {
                    pendingBodies.set(apiUrl, {resolve, reject});
                    timers.push(
                        setTimeout(() => {
                            pendingBodies.delete(apiUrl);
                            reject(
                                new BadGatewayException({
                                    message: 'AiScore API response was not found in page network traffic',
                                    apiUrl,
                                }),
                            );
                        }, timeout),
                    );
                }),
            ]),
        );

        const responseReceived = (event: {
            requestId: string;
            response: {
                url: string;
                status: number;
            };
        }) => {
            const apiUrl = apiUrls.find((expectedUrl) => this.isSameApiRequest(event.response.url, expectedUrl));
            if (!apiUrl || !pendingBodies.has(apiUrl)) {
                return;
            }

            if (event.response.status < 200 || event.response.status >= 300) {
                pendingBodies.get(apiUrl)?.reject(
                    new BadGatewayException({
                        message: 'AiScore API response from network was not successful',
                        apiUrl,
                        status: event.response.status,
                    }),
                );
                pendingBodies.delete(apiUrl);
                return;
            }

            matchedRequests.set(event.requestId, apiUrl);
        };

        const loadingFinished = (event: {requestId: string}) => {
            void this.resolveNetworkBody(session, event.requestId, matchedRequests, pendingBodies);
        };

        const loadingFailed = (event: {requestId: string; errorText: string}) => {
            const apiUrl = matchedRequests.get(event.requestId);
            if (!apiUrl) {
                return;
            }

            pendingBodies.get(apiUrl)?.reject(
                new BadGatewayException({
                    message: 'AiScore API network request failed',
                    apiUrl,
                    error: event.errorText,
                }),
            );
            pendingBodies.delete(apiUrl);
            matchedRequests.delete(event.requestId);
        };

        session.on('Network.responseReceived', responseReceived);
        session.on('Network.loadingFinished', loadingFinished);
        session.on('Network.loadingFailed', loadingFailed);

        return {
            promises,
            dispose: () => {
                timers.forEach((timer) => clearTimeout(timer));
                session.off('Network.responseReceived', responseReceived);
                session.off('Network.loadingFinished', loadingFinished);
                session.off('Network.loadingFailed', loadingFailed);
                void session.detach().catch(() => undefined);
            },
        };
    }

    private async resolveNetworkBody(
        session: CDPSession,
        requestId: string,
        matchedRequests: Map<string, string>,
        pendingBodies: Map<string, {resolve: (body: Buffer) => void; reject: (error: Error) => void}>,
    ): Promise<void> {
        const apiUrl = matchedRequests.get(requestId);
        if (!apiUrl) {
            return;
        }

        try {
            const body = (await session.send('Network.getResponseBody', {requestId})) as {
                body: string;
                base64Encoded: boolean;
            };
            pendingBodies.get(apiUrl)?.resolve(Buffer.from(body.body, body.base64Encoded ? 'base64' : 'utf8'));
        } catch (error) {
            pendingBodies.get(apiUrl)?.reject(error instanceof Error ? error : new Error(String(error)));
        } finally {
            pendingBodies.delete(apiUrl);
            matchedRequests.delete(requestId);
        }
    }

    private async waitForCloudflareClearance(page: Page, timeout: number): Promise<void> {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            const title = await page.title().catch(() => '');
            const bodyText = await page.locator('body').innerText({timeout: 1000}).catch(() => '');
            const isChallenge = title.includes('Just a moment') || bodyText.includes('Just a moment');

            if (!isChallenge) {
                return;
            }

            await page.waitForTimeout(2000);
        }
    }

    private buildPublicPageUrl(apiUrl: string): string {
        const date = new URL(apiUrl).searchParams.get('date') ?? '20180101';
        return `https://www.aiscore.com/${date}`;
    }

    private isSameApiRequest(actualUrl: string, expectedUrl: string): boolean {
        const actual = new URL(actualUrl);
        const expected = new URL(expectedUrl);
        if (actual.origin !== expected.origin || actual.pathname !== expected.pathname) {
            return false;
        }

        for (const [key, value] of expected.searchParams.entries()) {
            if (actual.searchParams.get(key) !== value) {
                return false;
            }
        }

        return true;
    }

    private mapDatabaseEvent(value: unknown, decoded: DecodedRecord) {
        const match = this.asRecord(value);
        const competition = this.findById(decoded.competitions, this.entityId(match.competition));
        const homeTeam = this.findById(decoded.teams, this.entityId(match.homeTeam));
        const awayTeam = this.findById(decoded.teams, this.entityId(match.awayTeam));
        const homeScores = this.numberArray(match.homeScores);
        const awayScores = this.numberArray(match.awayScores);
        const homeName = this.stringValue(homeTeam.name);
        const awayName = this.stringValue(awayTeam.name);
        const eventDate = this.toGmt7DateTime(match.matchTime);

        return {
            league: {
                externalId: this.stringValue(competition.id),
                leagueName: this.stringValue(competition.name),
                logoUrl: this.fullLogoUrl(this.stringValue(competition.logo), 'competition'),
                country: this.stringValue(this.asRecord(competition.country).name),
                countryCodeShort: this.stringValue(this.asRecord(competition.country).iso),
                hasStats: this.numberValue(competition.hasStats),
                slug: this.stringValue(competition.slug),
                sportId: this.numberValue(competition.sportId),
                color: this.stringValue(competition.color),
            },
            homeTeam: this.mapTeamForDatabase(homeTeam),
            awayTeam: this.mapTeamForDatabase(awayTeam),
            event: {
                externalId: this.stringValue(match.id),
                leagueExternalId: this.stringValue(competition.id),
                homeExternalId: this.stringValue(homeTeam.id),
                awayExternalId: this.stringValue(awayTeam.id),
                eventName: homeName && awayName ? `${homeName} - ${awayName}` : undefined,
                eventDate,
                status: this.mapEventStatus(match),
                statusId: this.numberValue(match.statusId),
                link: this.buildMatchLink(match, homeTeam, awayTeam),
                matchStatus: match.matchStatus,
            },
            result: this.mapResultForDatabase(homeScores, awayScores),
        };
    }

    private mapTeamForDatabase(team: DecodedRecord) {
        return {
            externalId: this.stringValue(team.id),
            teamName: this.stringValue(team.name),
            logoUrl: this.fullLogoUrl(this.stringValue(team.logo), 'team'),
            sportId: this.numberValue(team.sportId),
        };
    }

    private mapResultForDatabase(homeScores: number[], awayScores: number[]) {
        const htHomeGoal = homeScores[1];
        const htAwayGoal = awayScores[1];
        const ftHomeGoal = homeScores[0];
        const ftAwayGoal = awayScores[0];

        return {
            htResult: this.matchOutcome(htHomeGoal, htAwayGoal),
            htGoalStr: this.goalString(htHomeGoal, htAwayGoal),
            ftResult: this.matchOutcome(ftHomeGoal, ftAwayGoal),
            ftGoalStr: this.goalString(ftHomeGoal, ftAwayGoal),
            htHomeGoal,
            htAwayGoal,
            ftHomeGoal,
            ftAwayGoal,
            htHomeCorner: null,
            htAwayCorner: null,
            ftHomeCorner: homeScores[4],
            ftAwayCorner: awayScores[4],
            htHomeYellowCard: null,
            htAwayYellowCard: null,
            ftHomeYellowCard: homeScores[3],
            ftAwayYellowCard: awayScores[3],
            htHomeFoul: null,
            htAwayFoul: null,
            ftHomeFoul: null,
            ftAwayFoul: null,
            htHomeOffside: null,
            htAwayOffside: null,
            ftHomeOffside: null,
            ftAwayOffside: null,
            htHomeTotalShot: null,
            htAwayTotalShot: null,
            ftHomeTotalShot: null,
            ftAwayTotalShot: null,
            htHomeShotOnTarget: null,
            htAwayShotOnTarget: null,
            ftHomeShotOnTarget: null,
            ftAwayShotOnTarget: null,
        };
    }

    private mapEventResultForDatabase(homeScores: number[], awayScores: number[], teamStats: DecodedRecord) {
        const fullTimeStats = this.asRecord(this.asRecord(teamStats.matchStats)['0']);
        const halfTimeStats = this.asRecord(this.asRecord(teamStats.matchStats)['1']);

        const htHomeGoal = homeScores[1];
        const htAwayGoal = awayScores[1];
        const ftHomeGoal = homeScores[0];
        const ftAwayGoal = awayScores[0];

        const htHomeCorner = this.statValue(halfTimeStats, '102', 0);
        const htAwayCorner = this.statValue(halfTimeStats, '102', 1);
        const ftHomeCorner = this.statValue(fullTimeStats, '102', 0);
        const ftAwayCorner = this.statValue(fullTimeStats, '102', 1);

        const htHomeYellowCard = this.statValue(halfTimeStats, '101', 0);
        const htAwayYellowCard = this.statValue(halfTimeStats, '101', 1);
        const ftHomeYellowCard = this.statValue(fullTimeStats, '101', 0);
        const ftAwayYellowCard = this.statValue(fullTimeStats, '101', 1);

        const htHomeFoul = this.statValue(halfTimeStats, '105', 0);
        const htAwayFoul = this.statValue(halfTimeStats, '105', 1);
        const ftHomeFoul = this.statValue(fullTimeStats, '105', 0);
        const ftAwayFoul = this.statValue(fullTimeStats, '105', 1);

        const htHomeOffside = this.statValue(halfTimeStats, '103', 0);
        const htAwayOffside = this.statValue(halfTimeStats, '103', 1);
        const ftHomeOffside = this.statValue(fullTimeStats, '103', 0);
        const ftAwayOffside = this.statValue(fullTimeStats, '103', 1);

        const htHomeTotalShot = this.statValue(halfTimeStats, '150', 0);
        const htAwayTotalShot = this.statValue(halfTimeStats, '150', 1);
        const ftHomeTotalShot = this.statValue(fullTimeStats, '150', 0);
        const ftAwayTotalShot = this.statValue(fullTimeStats, '150', 1);

        const htHomeShotOnTarget = this.statValue(halfTimeStats, '149', 0);
        const htAwayShotOnTarget = this.statValue(halfTimeStats, '149', 1);
        const ftHomeShotOnTarget = this.statValue(fullTimeStats, '149', 0);
        const ftAwayShotOnTarget = this.statValue(fullTimeStats, '149', 1);

        return {
            htResult: this.matchOutcome(htHomeGoal, htAwayGoal),
            htGoalStr: this.goalString(htHomeGoal, htAwayGoal),
            ftResult: this.matchOutcome(ftHomeGoal, ftAwayGoal),
            ftGoalStr: this.goalString(ftHomeGoal, ftAwayGoal),
            htHomeGoal: this.nullableNumber(htHomeGoal),
            htAwayGoal: this.nullableNumber(htAwayGoal),
            ftHomeGoal: this.nullableNumber(ftHomeGoal),
            ftAwayGoal: this.nullableNumber(ftAwayGoal),
            htTotalGoal: this.nullableNumber(this.sumStats(htHomeGoal, htAwayGoal)),
            ftTotalGoal: this.nullableNumber(this.sumStats(ftHomeGoal, ftAwayGoal)),
            htHomeCorner: this.nullableNumber(htHomeCorner),
            htAwayCorner: this.nullableNumber(htAwayCorner),
            ftHomeCorner: this.nullableNumber(ftHomeCorner),
            ftAwayCorner: this.nullableNumber(ftAwayCorner),
            htTotalCorner: this.nullableNumber(this.sumStats(htHomeCorner, htAwayCorner)),
            ftTotalCorner: this.nullableNumber(this.sumStats(ftHomeCorner, ftAwayCorner)),
            htHomeYellowCard: this.nullableNumber(htHomeYellowCard),
            htAwayYellowCard: this.nullableNumber(htAwayYellowCard),
            ftHomeYellowCard: this.nullableNumber(ftHomeYellowCard),
            ftAwayYellowCard: this.nullableNumber(ftAwayYellowCard),
            htTotalYellowCard: this.nullableNumber(this.sumStats(htHomeYellowCard, htAwayYellowCard)),
            ftTotalYellowCard: this.nullableNumber(this.sumStats(ftHomeYellowCard, ftAwayYellowCard)),
            htHomeFoul: this.nullableNumber(htHomeFoul),
            htAwayFoul: this.nullableNumber(htAwayFoul),
            ftHomeFoul: this.nullableNumber(ftHomeFoul),
            ftAwayFoul: this.nullableNumber(ftAwayFoul),
            htTotalFoul: this.nullableNumber(this.sumStats(htHomeFoul, htAwayFoul)),
            ftTotalFoul: this.nullableNumber(this.sumStats(ftHomeFoul, ftAwayFoul)),
            htHomeOffside: this.nullableNumber(htHomeOffside),
            htAwayOffside: this.nullableNumber(htAwayOffside),
            ftHomeOffside: this.nullableNumber(ftHomeOffside),
            ftAwayOffside: this.nullableNumber(ftAwayOffside),
            htTotalOffside: this.nullableNumber(this.sumStats(htHomeOffside, htAwayOffside)),
            ftTotalOffside: this.nullableNumber(this.sumStats(ftHomeOffside, ftAwayOffside)),
            htHomeTotalShot: this.nullableNumber(htHomeTotalShot),
            htAwayTotalShot: this.nullableNumber(htAwayTotalShot),
            ftHomeTotalShot: this.nullableNumber(ftHomeTotalShot),
            ftAwayTotalShot: this.nullableNumber(ftAwayTotalShot),
            htTotalShot: this.nullableNumber(this.sumStats(htHomeTotalShot, htAwayTotalShot)),
            ftTotalShot: this.nullableNumber(this.sumStats(ftHomeTotalShot, ftAwayTotalShot)),
            htHomeShotOnTarget: this.nullableNumber(htHomeShotOnTarget),
            htAwayShotOnTarget: this.nullableNumber(htAwayShotOnTarget),
            ftHomeShotOnTarget: this.nullableNumber(ftHomeShotOnTarget),
            ftAwayShotOnTarget: this.nullableNumber(ftAwayShotOnTarget),
            htTotalShotOnTarget: this.nullableNumber(this.sumStats(htHomeShotOnTarget, htAwayShotOnTarget)),
            ftTotalShotOnTarget: this.nullableNumber(this.sumStats(ftHomeShotOnTarget, ftAwayShotOnTarget)),
        };
    }

    private mapOddsForDatabase(oddsDetails?: MatchOddsDetails) {
        const timelineOdds = this.mapOddsTimelineForDatabase(oddsDetails);
        return [
            ...this.pickOddsSnapshotsByStatus(timelineOdds, 'open', 1, 'first'),
            ...this.pickOddsSnapshotsByStatus(timelineOdds, 'pre-match', 1, 'last'),
            ...this.pickOddsSnapshotsByStatus(timelineOdds, 'half-time', 3, 'last'),
        ];
    }

    private mapOddsListForDatabase(oddsList: DecodedRecord) {
        return [
            ...this.mapOddsListMarketForDatabase('hdc', this.asArray(oddsList.asia)),
            ...this.mapOddsListMarketForDatabase('ou', this.asArray(oddsList.bs)),
            ...this.mapOddsListMarketForDatabase('corner', this.asArray(oddsList.corner)),
        ];
    }

    private mapOddsListMarketForDatabase(market: OddsTimelineMarket, items: unknown[]) {
        const bet365Odds = items
            .map((item) => this.asRecord(item))
            .find((item) => this.isBet365Company(this.asRecord(item.company)));

        if (!bet365Odds) {
            return [];
        }

        return [
            this.mapOddsListItemForDatabase('open', market, bet365Odds.f),
            this.mapOddsListItemForDatabase('pre-match', market, bet365Odds.s),
            this.mapOddsListItemForDatabase('half-time', market, bet365Odds.l),
        ].filter((item) => item !== undefined);
    }

    private mapOddsListItemForDatabase(type: OddsSnapshotType, market: OddsTimelineMarket, value: unknown) {
        const odds = this.stringArray(this.asRecord(value).odd);
        const priceA = this.decimalString(odds[0]);
        const line = this.formatOddLine(market, odds[1]);
        const priceB = this.decimalString(odds[2]);

        if (!priceA || !line || !priceB) {
            return undefined;
        }

        return {
            type,
            market,
            line,
            priceA,
            priceB,
        };
    }

    private mapOddsTimelineForDatabase(oddsDetails?: MatchOddsDetails): OddsTimelineItem[] {
        if (!oddsDetails?.asia && !oddsDetails?.eu && !oddsDetails?.bs && !oddsDetails?.corner) {
            return [];
        }

        return [
            ...this.mapOddsDetailItems('hdc', this.oddsDetailItems(oddsDetails.asia)),
            ...this.mapOddsDetailItems('ou', this.oddsDetailItems(oddsDetails.bs)),
            ...this.mapOddsDetailItems('corner', this.oddsDetailItems(oddsDetails.corner)),
        ];
    }

    private oddsDetailItems(detailBody?: DecodedRecord): unknown[] {
        if (!detailBody) {
            return [];
        }

        return this.asArray(detailBody.oddsDetail).flatMap((companyOddDetail) =>
            this.asArray(this.asRecord(companyOddDetail).details),
        );
    }

    private mapOddsDetailItems(market: OddsTimelineMarket, items: unknown[]): OddsTimelineItem[] {
        return items
            .map((item) => {
                const detail = this.asRecord(item);
                const line = this.formatOddLine(market, this.stringValue(detail.d));
                const priceA = this.decimalString(this.stringValue(detail.w));
                const priceB = this.decimalString(this.stringValue(detail.l));

                if (!line || !priceA || !priceB) {
                    return undefined;
                }

                return {
                    market,
                    line,
                    priceA,
                    priceB,
                    matchMinute: this.stringValue(detail.time),
                    crawledAt: this.toGmt7DateTime(detail.updateTime),
                    score: this.stringValue(detail.score),
                    statusId: this.numberValue(detail.statusId),
                };
            })
            .filter((item) => item !== undefined);
    }

    private groupOddsTimelineForResponse(timeline: OddsTimelineItem[]) {
        return {
            hdc: timeline.filter((item) => item.market === 'hdc'),
            ou: timeline.filter((item) => item.market === 'ou'),
            corner: timeline.filter((item) => item.market === 'corner'),
        };
    }

    private pickOddsSnapshotsByStatus(
        timeline: Array<{
            market: OddsTimelineMarket;
            line: string;
            priceA: string;
            priceB: string;
            matchMinute?: string;
            crawledAt?: string;
            statusId?: number;
        }>,
        type: 'open' | 'pre-match' | 'half-time',
        statusId: number,
        position: 'first' | 'last',
    ) {
        const grouped = new Map<string, typeof timeline>();
        for (const item of timeline.filter((odd) => odd.statusId === statusId)) {
            grouped.set(item.market, [...(grouped.get(item.market) ?? []), item]);
        }

        return [...grouped.entries()]
            .map(([market, items]) => {
                const sortedItems = [...items].sort((a, b) => this.oddTimeValue(a.crawledAt) - this.oddTimeValue(b.crawledAt));
                const selected = position === 'first' ? sortedItems[0] : sortedItems.at(-1);
                return selected
                    ? {
                        type,
                        market,
                        line: selected.line,
                        priceA: selected.priceA,
                        priceB: selected.priceB,
                    }
                    : undefined;
            })
            .filter((item) => item !== undefined);
    }

    private oddTimeValue(value?: string): number {
        return value ? Date.parse(value) || 0 : 0;
    }

    private formatOddLine(market: OddsTimelineMarket, line?: string): string | undefined {
        if (market !== 'hdc') {
            return this.decimalString(line);
        }

        const handicap = this.numberFromString(line);
        if (handicap === undefined) {
            return undefined;
        }

        if (handicap === 0) {
            return '0#0';
        }

        const absHandicap = Math.abs(handicap);
        const homeSign = handicap > 0 ? '-' : '+';
        const awaySign = handicap > 0 ? '+' : '-';
        const formattedHandicap = this.formatAsianHandicap(absHandicap);

        return `${homeSign}${formattedHandicap}#${awaySign}${formattedHandicap}`;
    }

    private formatAsianHandicap(value: number): string {
        const rounded = Math.round(value * 4) / 4;
        const lowerHalf = Math.floor(rounded * 2) / 2;
        const upperHalf = Math.ceil(rounded * 2) / 2;

        if (lowerHalf === upperHalf) {
            return this.trimDecimal(lowerHalf);
        }

        return `${this.trimDecimal(lowerHalf)}/${this.trimDecimal(upperHalf)}`;
    }

    private trimDecimal(value: number): string {
        return Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, '');
    }

    private numberFromString(value?: string): number | undefined {
        if (!value || Number.isNaN(Number(value))) {
            return undefined;
        }

        return Number(value);
    }

    private statValue(periodStats: DecodedRecord, statId: string, teamIndex: number): number | undefined {
        const stat = this.asRecord(this.asRecord(periodStats.stats)[statId]);
        const values = this.stringArray(stat.values);
        const value = values[teamIndex];
        if (!value || Number.isNaN(Number(value))) {
            return undefined;
        }

        return Number(value);
    }

    private sumStats(home?: number, away?: number): number | undefined {
        if (home === undefined || away === undefined) {
            return undefined;
        }
        return home + away;
    }

    private nullableNumber(value?: number): number | null {
        return value ?? null;
    }

    private async mapWithConcurrency<T, R>(
        values: T[],
        concurrency: number,
        mapper: (value: T, index: number) => Promise<R>,
    ): Promise<R[]> {
        const results = new Array<R>(values.length);
        let nextIndex = 0;

        await Promise.all(
            Array.from({length: Math.min(concurrency, values.length)}, async () => {
                while (nextIndex < values.length) {
                    const index = nextIndex;
                    nextIndex += 1;
                    results[index] = await mapper(values[index], index);
                }
            }),
        );

        return results;
    }

    private findById(values: unknown, id?: string): DecodedRecord {
        return this.asRecord(this.asArray(values).find((value) => this.asRecord(value).id === id));
    }

    private entityId(value: unknown): string | undefined {
        return this.stringValue(this.asRecord(value).id);
    }

    private toGmt7DateTime(value: unknown): string | undefined {
        const seconds = this.numberValue(value);
        if (seconds === undefined) {
            return undefined;
        }

        const date = new Date((seconds + 7 * 60 * 60) * 1000);
        return `${date.toISOString().slice(0, 19)}+07:00`;
    }

    private fullLogoUrl(value: string | undefined, type: 'competition' | 'team'): string | undefined {
        if (!value) {
            return undefined;
        }

        if (value.startsWith('http://') || value.startsWith('https://')) {
            return value;
        }

        return `https://img0.aiscore.com/football/${type}/${value}`;
    }

    private buildMatchLink(match: DecodedRecord, homeTeam: DecodedRecord, awayTeam: DecodedRecord): string | undefined {
        const id = this.stringValue(match.id);
        if (!id) {
            return undefined;
        }

        const homeSlug = this.teamSlug(homeTeam);
        const awaySlug = this.teamSlug(awayTeam);
        if (!homeSlug || !awaySlug) {
            return `https://www.aiscore.com/match/${id}`;
        }

        return `https://www.aiscore.com/match-${homeSlug}-${awaySlug}/${id}`;
    }

    private teamSlug(team: DecodedRecord): string | undefined {
        return this.stringValue(team.slug) ?? this.slugify(this.stringValue(team.name));
    }

    private slugify(value?: string): string | undefined {
        if (!value) {
            return undefined;
        }

        const slug = value
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        return slug || undefined;
    }

    private mapEventStatus(match: DecodedRecord): string {
        const statusId = this.numberValue(match.statusId);
        if (statusId === 8) {
            return 'FT';
        }

        return String(statusId ?? this.numberValue(match.matchStatus) ?? '-');
    }

    private matchOutcome(home?: number, away?: number): 'H' | 'D' | 'A' | 'None' {
        if (home === undefined || away === undefined) {
            return 'None';
        }

        if (home > away) {
            return 'H';
        }

        if (home < away) {
            return 'A';
        }

        return 'D';
    }

    private goalString(home?: number, away?: number): string | undefined {
        return home === undefined || away === undefined ? undefined : `${home}-${away}`;
    }

    private decimalString(value?: string): string | undefined {
        if (!value || Number.isNaN(Number(value))) {
            return undefined;
        }

        return value;
    }

    private asArray(value: unknown): unknown[] {
        return Array.isArray(value) ? value : [];
    }

    private numberArray(value: unknown): number[] {
        return this.asArray(value).filter((item): item is number => typeof item === 'number');
    }

    private stringArray(value: unknown): string[] {
        return this.asArray(value).filter((item): item is string => typeof item === 'string');
    }

    private asRecord(value: unknown): DecodedRecord {
        return value && typeof value === 'object' && !Array.isArray(value) ? (value as DecodedRecord) : {};
    }

    private stringValue(value: unknown): string | undefined {
        return typeof value === 'string' ? value : undefined;
    }

    private numberValue(value: unknown): number | undefined {
        return typeof value === 'number' ? value : undefined;
    }

    private booleanEnv(value: string | undefined, defaultValue: boolean): boolean {
        if (value === undefined) {
            return defaultValue;
        }

        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
            return true;
        }

        if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
            return false;
        }

        return defaultValue;
    }
}
