import {BadGatewayException, Injectable} from '@nestjs/common';
import {join} from 'node:path';
import {chromium, type Page} from 'playwright';
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
    bs?: DecodedRecord;
    corner?: DecodedRecord;
};
type OddsDetailType = keyof MatchOddsDetails;
type OddsDetailRequest = {
    matchId: string;
    type: OddsDetailType;
    url: string;
};
type PageFetchResult = {
    ok: boolean;
    status: number;
    statusText: string;
    contentType: string | null;
    body: number[];
    bodyText?: string;
};

@Injectable()
export class MatchesService {
    private readonly apiBaseUrl = 'https://api.aiscore.com/v1/web/api/matches';
    private readonly oddsDetailApiBaseUrl = 'https://api.aiscore.com/v1/web/api/match/odds/detail';

    constructor(private readonly protobufService: AiscoreProtobufService) {
    }

    async findMatches(query: MatchQuery) {
        const params = this.normalizeQuery(query);
        const apiUrl = this.buildApiUrl(params);

        return this.withBrowserPage(apiUrl, async (page, timeout) => {
            const [body] = await this.captureApiResponseBodies(page, [apiUrl], apiUrl, timeout);
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

            const oddsDetails = await this.fetchOddsDetails(page, filteredMatches, apiUrl, timeout);

            const events = filteredMatches.map((match) => {
                const matchRecord = this.asRecord(match);
                const matchId = this.stringValue(matchRecord.id);

                return this.mapDatabaseEvent(match, decoded, matchId ? oddsDetails.get(matchId) : undefined);
            });

            return {
                date: params.date,
                sportId: Number(params.sport_id),
                lang: Number(params.lang),
                tz: params.tz,
                total: filteredMatches.length,
                events,
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

    private async fetchOddsDetails(
        page: Page,
        matches: unknown[],
        refererApiUrl: string,
        timeout: number,
    ): Promise<Map<string, MatchOddsDetails>> {
        const requests = this.buildOddsDetailRequests(matches);
        if (requests.length === 0) {
            return new Map();
        }

        const oddsApiUrls = requests.map((request) => request.url);
        const bodies = await this.captureApiResponseBodies(page, oddsApiUrls, refererApiUrl, timeout);
        const oddsDetails = new Map<string, MatchOddsDetails>();

        requests.forEach((request, index) => {
            const decoded = this.decodeOddsDetailBody(bodies[index], request.type === 'corner' ? 'match' : 'web');
            if (!decoded) {
                return;
            }

            const details = oddsDetails.get(request.matchId) ?? {};
            details[request.type] = decoded;
            oddsDetails.set(request.matchId, details);
        });

        return oddsDetails;
    }

    private buildOddsDetailRequests(matches: unknown[]): OddsDetailRequest[] {
        const requests: OddsDetailRequest[] = [];
        const requestedKeys = new Set<string>();

        for (const match of matches) {
            const matchRecord = this.asRecord(match);
            const matchId = this.stringValue(matchRecord.id);
            if (!matchId) {
                continue;
            }

            for (const type of this.availableOddsDetailTypes(matchRecord)) {
                const key = `${matchId}:${type}`;
                if (requestedKeys.has(key)) {
                    continue;
                }

                requestedKeys.add(key);
                requests.push({
                    matchId,
                    type,
                    url: this.buildOddsDetailApiUrl(matchId, type),
                });
            }
        }

        return requests;
    }

    private availableOddsDetailTypes(match: DecodedRecord): OddsDetailType[] {
        const oddsItems = this.asArray(this.asRecord(this.asRecord(match.ext).odds).oddItems)
            .map((item) => this.stringArray(this.asRecord(item).odd));
        const types: OddsDetailType[] = [];

        if (this.hasOddItem(oddsItems[0])) {
            types.push('asia');
        }

        if (this.hasOddItem(oddsItems[2])) {
            types.push('bs');
        }

        if (this.hasOddItem(oddsItems[3])) {
            types.push('corner');
        }

        return types;
    }

    private hasOddItem(odd?: string[]): boolean {
        return !!odd && odd.some((value) => value !== '');
    }

    private decodeOddsDetailBody(body: Buffer, type: 'web' | 'match'): DecodedRecord | undefined {
        const decoded =
            type === 'web'
                ? this.protobufService.decodeWebMatchOddsDetail(body)
                : this.protobufService.decodeMatchOddsDetail(body);
        return Object.keys(decoded).length > 0 ? decoded : undefined;
    }

    private async withBrowserPage<T>(refererApiUrl: string, handler: (page: Page, timeout: number) => Promise<T>): Promise<T> {
        const timeout = Number(process.env.AISCORE_BROWSER_TIMEOUT_MS ?? 60000);
        const userDataDir = process.env.AISCORE_USER_DATA_DIR ?? join(process.cwd(), '.playwright', 'aiscore-profile');
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
                referer: this.buildPublicPageUrl(refererApiUrl),
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
        refererApiUrl: string,
        timeout: number,
    ): Promise<Buffer[]> {
        const publicPageUrl = this.buildPublicPageUrl(refererApiUrl);
        const pageResponseBodies = new Map<string, Promise<Buffer | undefined>>();
        for (const apiUrl of apiUrls) {
            if (this.isMatchesApiUrl(apiUrl)) {
                pageResponseBodies.set(
                    apiUrl,
                    page
                        .waitForResponse((response) => this.isSameApiRequest(response.url(), apiUrl), {timeout})
                        .then((response) => (response.ok() ? response.body() : undefined))
                        .catch(() => undefined),
                );
            }
        }

        await page.goto(publicPageUrl, {
            waitUntil: 'networkidle',
            timeout,
        });
        await this.waitForCloudflareClearance(page, timeout);

        return this.mapWithConcurrency(apiUrls, 3, async (apiUrl) => {
            const pageResponseBody = await pageResponseBodies.get(apiUrl);
            if (pageResponseBody) {
                return pageResponseBody;
            }

            try {
                return await this.fetchApiBodyFromPage(page, apiUrl, publicPageUrl, timeout);
            } catch {
                return this.fetchApiBodyByNavigation(page, apiUrl, publicPageUrl, timeout);
            }
        });
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

    private async fetchApiBodyFromPage(page: Page, apiUrl: string, publicPageUrl: string, timeout: number): Promise<Buffer> {
        const response = await page.evaluate<PageFetchResult, { url: string; acceptLanguage: string; timeout: number }>(
            async ({url, acceptLanguage, timeout}) => {
                const controller = new AbortController();
                const timeoutId = window.setTimeout(() => controller.abort(), timeout);
                const response = await fetch(url, {
                    credentials: 'include',
                    headers: {
                        accept: 'application/octet-stream',
                        'accept-language': acceptLanguage,
                    },
                    signal: controller.signal,
                });
                const body = Array.from(new Uint8Array(await response.arrayBuffer()));
                window.clearTimeout(timeoutId);

                return {
                    ok: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                    contentType: response.headers.get('content-type'),
                    body,
                    bodyText:
                        response.ok || response.headers.get('content-type')?.includes('application/octet-stream')
                            ? undefined
                            : new TextDecoder().decode(new Uint8Array(body)).slice(0, 500),
                };
            },
            {
                url: apiUrl,
                acceptLanguage: process.env.AISCORE_ACCEPT_LANGUAGE ?? 'en-US,en;q=0.9',
                timeout,
            },
        );

        if (!response.ok) {
            throw new BadGatewayException({
                message: 'AiScore browser page fetch failed',
                publicPageUrl,
                apiUrl,
                status: response.status,
                statusText: response.statusText,
                contentType: response.contentType,
                body: response.bodyText,
            });
        }

        return Buffer.from(response.body);
    }

    private async fetchApiBodyByNavigation(
        page: Page,
        apiUrl: string,
        publicPageUrl: string,
        timeout: number,
    ): Promise<Buffer> {
        const apiPage = await page.context().newPage();
        try {
            await apiPage.setExtraHTTPHeaders({
                accept: 'application/octet-stream',
                referer: publicPageUrl,
                origin: 'https://www.aiscore.com',
                'accept-language': process.env.AISCORE_ACCEPT_LANGUAGE ?? 'en-US,en;q=0.9',
            });

            let response = await apiPage.goto(apiUrl, {
                waitUntil: 'domcontentloaded',
                timeout,
            });
            await this.waitForCloudflareClearance(apiPage, timeout);

            if (!response?.ok()) {
                response = await apiPage.goto(apiUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout,
                });
            }

            if (!response?.ok()) {
                const text = await apiPage.locator('body').innerText({timeout: 1000}).catch(() => '');
                throw new BadGatewayException({
                    message: 'AiScore browser navigation fallback failed',
                    publicPageUrl,
                    apiUrl,
                    status: response?.status(),
                    body: text.slice(0, 500),
                });
            }

            return response.body();
        } finally {
            await apiPage.close();
        }
    }

    private buildPublicPageUrl(apiUrl: string): string {
        const date = new URL(apiUrl).searchParams.get('date') ?? '20180101';
        return `https://www.aiscore.com/${date}`;
    }

    private isMatchesApiUrl(apiUrl: string): boolean {
        return new URL(apiUrl).pathname.endsWith('/v1/web/api/matches');
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

    private mapDatabaseEvent(value: unknown, decoded: DecodedRecord, oddsDetails?: MatchOddsDetails) {
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
                link: this.buildMatchLink(match, homeTeam, awayTeam),
            },
            result: this.mapResultForDatabase(homeScores, awayScores),
            odds: this.mapOddsForDatabase(oddsDetails),
            oddsTimeline: this.mapOddsTimelineForDatabase(oddsDetails),
        };
    }

    private mapTeamForDatabase(team: DecodedRecord) {
        return {
            externalId: this.stringValue(team.id),
            teamName: this.stringValue(team.name),
            logoUrl: this.fullLogoUrl(this.stringValue(team.logo), 'team'),
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

    private mapOddsForDatabase(oddsDetails?: MatchOddsDetails) {
        const timelineOdds = this.mapOddsTimelineForDatabase(oddsDetails);
        return [
            ...this.pickOddsSnapshotsByStatus(timelineOdds, 'open', 1, 'first'),
            ...this.pickOddsSnapshotsByStatus(timelineOdds, 'pre-match', 1, 'last'),
            ...this.pickOddsSnapshotsByStatus(timelineOdds, 'ht', 3, 'last'),
        ];
    }

    private mapOddsTimelineForDatabase(oddsDetails?: MatchOddsDetails) {
        if (!oddsDetails?.asia && !oddsDetails?.bs && !oddsDetails?.corner) {
            return [];
        }

        return [
            ...this.mapOddsDetailItems('hdc', this.asArray(oddsDetails.asia?.asia)),
            ...this.mapOddsDetailItems('ou', this.asArray(oddsDetails.bs?.bs)),
            ...this.mapOddsDetailItems('corner', this.cornerOddsItems(oddsDetails.corner)),
        ];
    }

    private cornerOddsItems(cornerOddsDetail?: DecodedRecord): unknown[] {
        if (!cornerOddsDetail) {
            return [];
        }

        return this.asArray(cornerOddsDetail.oddsDetail).flatMap((companyOddDetail) =>
            this.asArray(this.asRecord(companyOddDetail).details),
        );
    }

    private mapOddsDetailItems(market: 'hdc' | 'ou' | 'corner', items: unknown[]) {
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

    private pickOddsSnapshotsByStatus(
        timeline: Array<{
            market: 'hdc' | 'ou' | 'corner';
            line: string;
            priceA: string;
            priceB: string;
            matchMinute?: string;
            crawledAt?: string;
            statusId?: number;
        }>,
        type: 'open' | 'pre-match' | 'ht',
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

    private formatOddLine(market: 'hdc' | 'ou' | 'corner', line?: string): string | undefined {
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
