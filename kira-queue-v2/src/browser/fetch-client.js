import { BusinessException } from '../util.js';
import { log } from '../log.js';
import { requireClearance, requireClearanceAfterApiChallenge } from './cloudflare.js';

export const ORIGIN = 'https://www.aiscore.com';

export const SINGLE_FETCH_SCRIPT = `async ({ url, referer, origin, acceptLanguage }) => {
  const toBase64 = (buf) => {
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };
  try {
    const res = await fetch(url, {
      headers: {
        referer,
        origin,
        'accept-language': acceptLanguage,
      },
      credentials: 'include',
    });
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || '';
    const mitigated = res.headers.get('cf-mitigated') || '';
    const challengeText = contentType.toLowerCase().includes('text/html')
      ? new TextDecoder().decode(buf.slice(0, 8192)).toLowerCase()
      : '';
    const challenge = mitigated.toLowerCase() === 'challenge'
      || challengeText.includes('just a moment')
      || challengeText.includes('verify you are human')
      || challengeText.includes('cf-chl-');
    return {
      ok: res.ok,
      status: res.status,
      contentType,
      mitigated,
      challenge,
      bodyLen: buf.byteLength,
      body: res.ok && buf.byteLength > 0 ? toBase64(buf) : null,
      error: res.ok ? null : ('status ' + res.status),
    };
  } catch (err) {
    return { ok: false, status: 0, bodyLen: 0, body: null, challenge: false, error: String(err) };
  }
}`;

const toInt = (v) => (typeof v === 'number' ? Math.trunc(v) : 0);
export const isVerificationRequired = (e) => e instanceof BusinessException && e.message?.startsWith('AISCORE_VERIFICATION_REQUIRED');

export function decodeResultBody(apiUrl, result) {
  const status = toInt(result.status);
  const bodyLen = toInt(result.bodyLen);

  if (result.challenge === true || String(result.mitigated).toLowerCase() === 'challenge') {
    throw new BusinessException('AISCORE_VERIFICATION_REQUIRED: AiScore API returned a Cloudflare challenge. Crawl stopped.', 503);
  }
  if (status === 403 || status === 429 || status === 503) {
    throw new BusinessException(`AISCORE_UPSTREAM_UNAVAILABLE: AiScore API returned HTTP ${status}. Crawl stopped.`, 503);
  }
  const contentType = String(result.contentType).toLowerCase();
  if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
    throw new BusinessException('AISCORE_UNEXPECTED_RESPONSE: AiScore returned HTML instead of odds data. Crawl stopped.', 502);
  }
  if (result.ok !== true) {
    log.warn(`AiScore API fetch failed url=${apiUrl} status=${status} bodyLen=${bodyLen} error=${result.error ?? null}`);
    return null;
  }
  const encoded = result.body;
  if (typeof encoded !== 'string' || encoded.trim() === '') {
    log.warn(`AiScore API fetch returned empty body url=${apiUrl} status=${status} bodyLen=${bodyLen}`);
    return null;
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    log.warn(`AiScore API fetch decode failed url=${apiUrl} status=${status} bodyLen=${bodyLen}`);
    return null;
  }
  const body = Buffer.from(encoded, 'base64');
  log.info(`AiScore API fetch ok url=${apiUrl} status=${status} bodyLen=${bodyLen}`);
  return body;
}

/** Fetches AiScore protobuf APIs through in-page fetch() on a lane page (main world, so cf_clearance is sent). */
export function createFetchClient({ verificationTimeoutMs, acceptLanguage }) {
  // Patchright 1.64 signature: evaluate(fn, arg, options, isolatedContext). isolatedContext=false runs in the
  // main world so the page's cookies/fingerprint are used. Passing `false` as the 3rd arg throws "Too many arguments".
  const evaluate = (page, script, arg) => page.evaluate(script, arg, undefined, false);

  /** Java fetchOptional(page, url): 200 ms pre-wait, ORIGIN referer. */
  async function fetchOptional(page, apiUrl) {
    await page.waitForTimeout(200);
    await requireClearance(page, verificationTimeoutMs);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await evaluate(page, SINGLE_FETCH_SCRIPT, { url: apiUrl, referer: ORIGIN, origin: ORIGIN, acceptLanguage });
        const body = decodeResultBody(apiUrl, result);
        if (body === null) log.warn(`AiScore API fetch context url=${apiUrl} referer=${ORIGIN}`);
        return body;
      } catch (e) {
        if (e instanceof BusinessException) {
          if (attempt === 0 && isVerificationRequired(e)) {
            await requireClearanceAfterApiChallenge(page, verificationTimeoutMs);
            continue;
          }
          throw e;
        }
        log.warn(`AiScore API fetch error url=${apiUrl} referer=${ORIGIN}: ${e?.message}`);
        return null;
      }
    }
    throw new BusinessException('AISCORE_VERIFICATION_REQUIRED: AiScore API challenge was not cleared.', 503);
  }

  return { fetchOptional };
}
