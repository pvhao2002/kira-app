import { BusinessException } from '../util.js';
import { log } from '../log.js';

export const PAGE_STATE_SCRIPT = `() => {
  if (!['aiscore.com', 'www.aiscore.com'].includes(location.hostname)
      || document.readyState === 'loading' || !document.body) return 'loading';
  const text = ((document.title || '') + '\\n' + (document.body.innerText || '')).toLowerCase();
  if (text.includes('just a moment') || text.includes('checking your browser')
      || text.includes('performing security verification')
      || text.includes('verify you are human')
      || text.includes('enable javascript and cookies')
      || text.includes('cf-chl-')
      || document.querySelector('#challenge-running, #challenge-stage, #challenge-form')) {
    return 'challenge';
  }
  return 'ready';
}`;

async function pageState(page) {
  try {
    return String(await page.evaluate(PAGE_STATE_SCRIPT));
  } catch {
    // A navigation or unreadable page must never count as successful verification.
    return 'loading';
  }
}

export async function waitForClearance(page, timeoutMs) {
  const timeout = Math.max(0, timeoutMs);
  const started = Date.now();
  let waitingLogged = false;
  for (;;) {
    if (!page || page.isClosed()) return false;
    const state = await pageState(page);
    if (state === 'ready') return true;
    if (state === 'challenge' && !waitingLogged) {
      log.warn('AiScore requires manual verification in the open browser. API requests are paused.');
      waitingLogged = true;
    }
    const remaining = timeout - (Date.now() - started);
    if (remaining <= 0) return false;
    await page.waitForTimeout(Math.min(500, remaining));
  }
}

export async function requireClearance(page, timeoutMs) {
  if (!(await waitForClearance(page, timeoutMs))) {
    throw new BusinessException(
      'AISCORE_VERIFICATION_REQUIRED: AiScore page is not ready or still requires verification. '
        + 'Complete verification manually in the open browser, then retry the crawl.',
      503,
    );
  }
}

/**
 * An API challenge can arrive while the visible tab still shows a normal page. Reload that
 * same tab so Cloudflare can present its challenge, then wait for the operator to complete it.
 */
export async function requireClearanceAfterApiChallenge(page, timeoutMs) {
  try {
    await page.reload({ timeout: Math.max(1, timeoutMs) });
  } catch {
    // requireClearance below turns a closed or unreadable page into the stable error code.
  }
  await requireClearance(page, timeoutMs);
}
