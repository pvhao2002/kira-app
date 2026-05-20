import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { join } from 'node:path';
import { chromium, type Page, type Response } from 'playwright';
import { AiscoreProtobufService } from '../matches/aiscore-protobuf.service';

const ALLOWED_API_HOST = 'api.aiscore.com';
const ALLOWED_PUBLIC_HOSTS = ['aiscore.com', 'www.aiscore.com'];
const ALLOWED_PROTOCOL = 'https:';

@Injectable()
export class AiscoreRawService {
    constructor(private readonly protobufService: AiscoreProtobufService) {}

    async fetchRaw(rawPublicPageUrl: string, rawApiUrl: string): Promise<unknown> {
        const publicPageUrl = this.parseAndValidateUrl(rawPublicPageUrl, 'publicPageUrl', ALLOWED_PUBLIC_HOSTS).toString();
        const apiUrl = this.parseAndValidateUrl(rawApiUrl, 'apiUrl', [ALLOWED_API_HOST]).toString();

        return this.withBrowserPage(publicPageUrl, async (page, timeout) => {
            const apiResponsePromise = page
                .waitForResponse((response) => this.isSameApiRequest(response.url(), apiUrl), { timeout })
                .catch(() => undefined);

            await page.goto(publicPageUrl, {
                waitUntil: 'domcontentloaded',
                timeout,
            });
            await this.waitForCloudflareClearance(page, timeout);

            const response = await apiResponsePromise;
            if (!response) {
                throw new BadGatewayException({
                    message: 'AiScore API response was not found in Playwright network traffic',
                    publicPageUrl,
                    apiUrl,
                });
            }

            return this.parseProtobufResponse(response, apiUrl);
        });
    }

    private parseAndValidateUrl(rawUrl: string, parameterName: string, allowedHosts: string[]): URL {
        if (!rawUrl || !rawUrl.trim()) {
            throw new BadRequestException(`${parameterName} query parameter is required`);
        }

        let url: URL;
        try {
            url = new URL(rawUrl);
        } catch {
            throw new BadRequestException(`Invalid ${parameterName}: "${rawUrl}"`);
        }

        if (url.protocol !== ALLOWED_PROTOCOL) {
            throw new BadRequestException(
                `${parameterName} protocol must be "${ALLOWED_PROTOCOL}", got "${url.protocol}"`,
            );
        }

        if (!allowedHosts.includes(url.hostname)) {
            throw new BadRequestException(
                `${parameterName} host must be one of "${allowedHosts.join(', ')}", got "${url.hostname}"`,
            );
        }

        return url;
    }

    private async withBrowserPage<T>(publicPageUrl: string, handler: (page: Page, timeout: number) => Promise<T>): Promise<T> {
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

        try {
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

    private async waitForCloudflareClearance(page: Page, timeout: number): Promise<void> {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            const title = await page.title().catch(() => '');
            const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
            const isChallenge = title.includes('Just a moment') || bodyText.includes('Just a moment');
            if (!isChallenge) {
                return;
            }
            await page.waitForTimeout(2000);
        }
    }

    private async parseProtobufResponse(response: Response, apiUrl: string): Promise<unknown> {
        if (!response.ok()) {
            throw new BadGatewayException({
                message: 'AiScore upstream request failed',
                url: apiUrl,
                status: response.status(),
                statusText: response.statusText(),
            });
        }

        const body = await response.body();
        try {
            return this.decodeProtobufBody(body, apiUrl);
        } catch (err) {
            throw new BadGatewayException({
                message: 'AiScore upstream response could not be decoded as protobuf',
                url: apiUrl,
                status: response.status(),
                statusText: response.statusText(),
                cause: err instanceof Error ? err.message : String(err),
            });
        }
    }

    private decodeProtobufBody(body: Buffer, apiUrl: string): Record<string, unknown> {
        const url = new URL(apiUrl);
        if (url.pathname.endsWith('/v1/web/api/matches')) {
            return this.protobufService.decodeMatches(body);
        }

        if (url.pathname.endsWith('/v1/web/api/match/odds/detail')) {
            const oddsType = url.searchParams.get('odds_type');
            return oddsType === 'corner'
                ? this.protobufService.decodeMatchOddsDetail(body)
                : this.protobufService.decodeWebMatchOddsDetail(body);
        }

        throw new BadRequestException({
            message: 'Unsupported AiScore protobuf API URL',
            apiUrl,
            supportedPaths: [
                '/v1/web/api/matches',
                '/v1/web/api/match/odds/detail',
            ],
        });
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
