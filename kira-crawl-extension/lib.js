// Pure helpers shared by the service worker and node tests. No chrome.* here.

const HCM_TZ = 'Asia/Ho_Chi_Minh';

/** yyyyMMdd of `now` in Asia/Ho_Chi_Minh. */
export function hcmDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HCM_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(now));
  const get = (t) => parts.find((p) => p.type === t).value;
  return get('year') + get('month') + get('day');
}

/** True when eventDateIso is within +/- windowMs of now (inclusive). */
export function inWindow(eventDateIso, now = new Date(), windowMs = 3600e3) {
  const t = Date.parse(eventDateIso);
  if (Number.isNaN(t)) return false;
  return Math.abs(t - new Date(now).getTime()) <= windowMs;
}

/** rps clamped to 1..10; junk falls back to 1. */
export function clampRps(rps) {
  const n = Number(rps);
  if (!Number.isFinite(n)) return 1;
  return Math.min(10, Math.max(1, n));
}

/**
 * Shared limiter: keeps at least minIntervalMs between request START times.
 * Default 1000ms = 1 req/s. Call `await limiter()` right before each AiScore request.
 */
export function createLimiter(minIntervalMs = 1000) {
  let nextAt = 0;
  return async function limiter() {
    const now = Date.now();
    const startAt = Math.max(now, nextAt);
    nextAt = startAt + minIntervalMs;
    if (startAt > now) await new Promise((r) => setTimeout(r, startAt - now));
  };
}

/**
 * Port of CloudflareSupport.requireUsableApiResponse. Returns 'ok' | 'challenge' | 'upstream' | 'html'.
 * `sample` = first ~8KB of the body as text (only needed for HTML responses).
 */
export function classifyResponse({ status, contentType = '', mitigated = '', sample = '' }) {
  if (String(mitigated).toLowerCase() === 'challenge') return 'challenge';
  // Challenge text before status: a real Cloudflare challenge is usually 403 + text/html "Just a moment".
  const html = /text\/html|application\/xhtml\+xml/i.test(contentType);
  const s = html ? String(sample).toLowerCase() : '';
  if (s.includes('just a moment') || s.includes('verify you are human') || s.includes('cf-chl-')) return 'challenge';
  // 0 = fetch threw (network error / CORS-blocked page); any other non-2xx is unusable too.
  if (!(status >= 200 && status < 300)) return 'upstream';
  return html ? 'html' : 'ok';
}

/**
 * Port of PAGE_STATE_SCRIPT. Injected into the tab, so it MUST stay self-contained.
 * Returns 'loading' | 'challenge' | 'ready'.
 */
export function pageState() {
  if (!['aiscore.com', 'www.aiscore.com'].includes(location.hostname)
      || document.readyState === 'loading' || !document.body) return 'loading';
  const text = ((document.title || '') + '\n' + (document.body.innerText || '')).toLowerCase();
  if (text.includes('just a moment') || text.includes('checking your browser')
      || text.includes('performing security verification')
      || text.includes('verify you are human')
      || text.includes('enable javascript and cookies')
      || text.includes('cf-chl-')
      || document.querySelector('#challenge-running, #challenge-stage, #challenge-form')) {
    return 'challenge';
  }
  return 'ready';
}
