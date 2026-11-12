import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Page, type Request } from 'patchright';
import { ToolError } from './errors.ts';
import { allow, requireAllowedMainFrame } from './provider.ts';
import type { NavigationSink, ScreenshotSink } from './runner.ts';

export const DEFAULT_TIMEOUT_MS = 60_000;

/** Only a top-frame navigation must stay on the provider allowlist; everything else just needs a public host. */
export function allowRequest(url: string, navigation: boolean, topFrame: boolean): boolean {
  return allow(url, navigation && topFrame);
}

function allowed(req: Request): boolean {
  try {
    return allowRequest(req.url(), req.isNavigationRequest(), req.frame().parentFrame() === null);
  } catch {
    return false; // service-worker requests have no frame (and are blocked anyway)
  }
}

// ---- bot-challenge detection ----
// We never try to solve or evade a challenge: seeing one fails the job fast with PROVIDER_BLOCKED.
// ponytail: marker list (URLs, titles, iframes, phrases) is heuristic; extend it when a provider changes its page.
const GOOGLE_HOST = /^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/;
const CHALLENGE_TITLE = /^(?:just a moment\.*|attention required! \| cloudflare|access denied|verifying you are human\.*)$/i;
const CHALLENGE_TEXT = /unusual traffic from your computer network|verify(?:ing)? you are (?:a )?human|are you a robot|checking your browser before accessing|checking if the site connection is secure/i;
const SCRIBD_CHALLENGE_TEXT = /^\s*(?:\[?scribd\]?\s*)?is verifying your browser[.\u2026]*\s*$/i;
const CHALLENGE_FRAME = /^https:\/\/(?:challenges\.cloudflare\.com\/|[a-z0-9.-]*hcaptcha\.com\/captcha\/|(?:www\.)?(?:google\.com|recaptcha\.net)\/recaptcha\/(?:api2|enterprise)\/(?:anchor|bframe))/i;

export function isChallengeUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return (GOOGLE_HOST.test(u.hostname) && u.pathname.startsWith('/sorry/'))
    || u.pathname.startsWith('/cdn-cgi/challenge-platform/');
}

export function looksLikeChallenge(p: { url: string; title: string; frameUrls: string[]; text: string }): boolean {
  return isChallengeUrl(p.url)
    || CHALLENGE_TITLE.test(p.title.trim())
    || (/^https:\/\/(?:www\.)?scribd\.com\//i.test(p.url)
      && (p.title.trim().toLowerCase() === 'client challenge' || SCRIBD_CHALLENGE_TEXT.test(p.text)))
    || p.frameUrls.some((f) => CHALLENGE_FRAME.test(f) && !/[?&]size=invisible\b/.test(f))
    || CHALLENGE_TEXT.test(p.text);
}

/** Throws PROVIDER_BLOCKED when the loaded page is a captcha / bot-challenge page. */
export async function requireNoChallenge(page: Page): Promise<void> {
  const text = await page.evaluate(() => (document.body?.innerText ?? '').slice(0, 3000)).catch(() => '');
  const title = await page.title().catch(() => '');
  const frameUrls = page.frames().map((f) => f.url());
  if (looksLikeChallenge({ url: page.url(), title, frameUrls, text })) throw new ToolError('PROVIDER_BLOCKED');
}

export async function openDocument(page: Page, url: string): Promise<void> {
  const status = (await page.goto(url))?.status();
  if (status === 403 || status === 429) throw new ToolError('PROVIDER_BLOCKED');
  await requireNoChallenge(page);
  requireAllowedMainFrame(page.url());
  if (status !== undefined && status >= 400) throw new ToolError('PROVIDER_EXTRACTION_FAILED');
  await actLikeReader(page);
}

const between = (min: number, max: number) => min + Math.floor(Math.random() * (max - min));

/** A few gliding mouse moves inside the 1280x720 window and a short pause, so the page is not scraped instantly. */
async function actLikeReader(page: Page): Promise<void> {
  for (let i = between(3, 6); i > 0; i--) {
    await page.mouse.move(between(100, 1180), between(100, 620), { steps: between(8, 25) });
    await page.waitForTimeout(between(100, 400));
  }
  await page.waitForTimeout(between(800, 2000));
}

/**
 * One browser per job, closed on every path (page, context, profile dir in finally). Errors propagate so the runner
 * can map them to an error code. Chrome uses its default user agent and headers (no spoofing).
 */
export async function withPage<T>(headless: boolean, task: (page: Page) => Promise<T>,
  screenshot?: ScreenshotSink, navigation?: NavigationSink): Promise<T> {
  let blocked = false;
  let challenged = false;
  // patchright's recommended setup: a persistent (non-incognito) profile, real Chrome, no viewport emulation.
  // The profile is a fresh temp dir per job, so jobs never share cookies or lock each other's profile.
  const profileDir = await mkdtemp(join(tmpdir(), 'kira-tool-profile-'));
  try {
    // Service workers can serve/issue requests that bypass context.route, so they are blocked outright.
    // ponytail: hostname-only guard; a public DNS name resolving to a private IP still passes. Add a
    // resolving proxy / egress firewall if the service ever shares a network with sensitive hosts.
    // The window keeps Playwright's old 1280x720 viewport size so extractor layout does not change.
    const context = await chromium.launchPersistentContext(profileDir, {
      headless, channel: 'chrome', viewport: null, args: ['--window-size=1280,720'],
      timezoneId: 'Asia/Ho_Chi_Minh', serviceWorkers: 'block',
    });
    try {
      context.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
      // Route handlers only see the first URL of a redirect chain. Hops are checked here; a forbidden hop
      // has already been sent, so from then on every request is aborted and the job fails.
      context.on('request', (req) => {
        if (req.isNavigationRequest() && isChallengeUrl(req.url())) challenged = true;
        if (req.redirectedFrom() && !allowed(req)) blocked = true;
      });
      await context.route('**/*', (route) =>
        !blocked && allowed(route.request()) ? route.continue() : route.abort());
      const page = context.pages()[0] ?? await context.newPage();
      if (navigation) trackNavigation(page, navigation);
      try {
        await page.route('**/*', async (route) => {
          await route.continue({
            headers: {
              ...route.request().headers(),
              'sec-ch-ua': '"Chromium";v="157", "Not(A:Brand";v="24", "Google Chrome";v="157"',
              'sec-ch-ua-mobile': '?0',
              'sec-ch-ua-platform': '"Windows"',
            },
          });
        });
        const result = await task(page);
        if (challenged) throw new ToolError('PROVIDER_BLOCKED');
        if (blocked) throw new ToolError('PROVIDER_EXTRACTION_FAILED');
        return result;
      } catch (e) {
        if (screenshot && !blocked && allow(page.url(), true)) {
          const image = await page.screenshot({ type: 'jpeg', quality: 70, timeout: 2000 }).catch(() => undefined);
          if (image && !blocked && allow(page.url(), true)) screenshot(image);
        }
        if (challenged) throw new ToolError('PROVIDER_BLOCKED');
        if (blocked) throw new ToolError('PROVIDER_EXTRACTION_FAILED');
        throw e;
      } finally {
        await page.close().catch(() => { });
      }
    } finally {
      await context.close().catch(() => { });
    }
  } finally {
    await rm(profileDir, { recursive: true, force: true }).catch(() => { });
  }
}

/** Report top-level navigation, including attempted loads, redirects and same-document URL changes. */
export function trackNavigation(page: Page, navigation: NavigationSink): void {
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigation(request.url());
  });
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigation(frame.url());
  });
}
