import { hcmDate, inWindow, clampRps, createLimiter, classifyResponse, pageState } from './lib.js';
import { aiscoreFetch } from './aiscore-fetch.js';

const AISCORE_HOME = 'https://www.aiscore.com/';
const API = 'https://api.aiscore.com/v1/web/api';
const WINDOW_MS = 3600e3;

// Serial chain so loop A and loop B never overlap (a failing job must not break the chain).
let chain = Promise.resolve();
const enqueue = (job) => (chain = chain.then(job, job));

// ponytail: rps is read once per service-worker start; a new rate applies after the SW restarts (idle or reload).
let limiterPromise;
async function limiter() {
  limiterPromise ??= settings().then((s) => createLimiter(1000 / clampRps(s.rps)));
  return (await limiterPromise)();
}

async function settings() {
  const s = await chrome.storage.local.get({ baseUrl: '', token: '', rps: 1 });
  return { ...s, rps: clampRps(s.rps), baseUrl: String(s.baseUrl).replace(/\/+$/, '') };
}

class StopRun extends Error {}

// ---- tab / page-state guard -------------------------------------------------

async function getTab() {
  const [existing] = await chrome.tabs.query({ url: 'https://www.aiscore.com/*' });
  if (existing) {
    // a discarded tab cannot run scripts: reload it, the next tick sees it ready
    if (existing.discarded) await chrome.tabs.reload(existing.id);
    return existing;
  }
  const tab = await chrome.tabs.create({ url: AISCORE_HOME, active: false });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if ((await chrome.tabs.get(tab.id)).status === 'complete') break;
  }
  return tab;
}

// in-memory mirror of storage `paused`; undefined after SW start so the first successful fetch syncs it
let paused;
async function setPaused(value) {
  paused = value;
  await chrome.storage.local.set({ paused: value });
  await chrome.action.setBadgeText({ text: value ? '!' : '' });
}

async function pauseForChallenge(reason) {
  const { paused: wasPaused } = await chrome.storage.local.get({ paused: false });
  await setPaused(true);
  if (!wasPaused) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      title: 'Kira crawl paused',
      message: 'AiScore needs a manual Cloudflare check (' + reason + '). Solve it in the aiscore.com tab.',
    });
  }
}

/** Returns the tab id when the page is ready, else null (run must stop). */
async function ensureReadyTab() {
  const tab = await getTab();
  let state = 'loading';
  try {
    [{ result: state }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pageState });
  } catch (_) { /* tab navigating */ }
  if (state === 'challenge') {
    await pauseForChallenge('page');
    return null;
  }
  if (state !== 'ready') {
    console.warn('aiscore tab not ready:', state);
    return null;
  }
  // paused is cleared only by a successful API fetch (aiscoreGet), so an API-only challenge
  // does not re-notify on every tick after the tab reload.
  return tab.id;
}

// ---- AiScore fetch (all through the shared limiter) --------------------------

async function aiscoreGet(tabId, url) {
  await limiter();
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'ISOLATED', func: aiscoreFetch, args: [url],
  });
  const kind = classifyResponse(result);
  if (kind === 'challenge') {
    await pauseForChallenge('api');
    // like requireClearanceAfterApiChallenge: reload so Cloudflare shows its challenge to the operator
    try { await chrome.tabs.reload(tabId); } catch (_) { /* ignore */ }
    throw new StopRun('challenge');
  }
  if (kind !== 'ok') throw new StopRun(kind + ' ' + result.status); // kind + status only, never body/error
  if (paused !== false) await setPaused(false);
  return result.body; // base64, or null when empty
}

// ---- backend ------------------------------------------------------------------

async function backend(path, { method = 'GET', json } = {}) {
  const s = await settings();
  if (!s.baseUrl || !s.token) throw new StopRun('backend not configured');
  const res = await fetch(s.baseUrl + path, {
    method,
    headers: { Authorization: 'Bearer ' + s.token, ...(json ? { 'Content-Type': 'application/json' } : {}) },
    body: json ? JSON.stringify(json) : undefined,
  });
  // bad/revoked token or backend down: stop the run instead of spending AiScore requests for nothing
  if (res.status === 401 || res.status === 403 || res.status >= 500) throw new StopRun('backend HTTP ' + res.status);
  if (!res.ok) throw new Error('backend HTTP ' + res.status);
  return res.json();
}

// ---- loops ------------------------------------------------------------------

async function loopA() {
  const tabId = await ensureReadyTab();
  if (tabId == null) return;
  const date = hcmDate(new Date());
  const body = await aiscoreGet(tabId, `${API}/matches?lang=2&sport_id=1&date=${date}&tz=07:00`);
  if (!body) return;
  const list = await backend(`/ext/dates/${date}/matches`, { method: 'POST', json: { body } });
  const events = {};
  for (const e of list) events[e.externalId] = e;
  // single key: replaces any other day's cache
  await chrome.storage.local.set({ cache: { date, fetchedAt: Date.now(), events } });
}

async function loopB() {
  const tabId = await ensureReadyTab();
  if (tabId == null) return;
  const date = hcmDate(new Date());
  const { cache } = await chrome.storage.local.get('cache');
  if (!cache || cache.date !== date) return; // today's list not fetched yet; loop A will fill it
  const candidates = await backend(`/ext/odds/candidates?date=${date}`);
  const now = Date.now();
  for (const id of candidates) {
    const ev = cache.events[id];
    if (!ev || !ev.hasOdds || !inWindow(ev.eventDate, now, WINDOW_MS)) continue;
    const oddsList = await aiscoreGet(tabId, `${API}/match/odds_list?match_id=${id}&code=195`);
    if (!oddsList) continue;
    const details = {};
    let complete = true;
    for (const type of ev.hasOddsCorner ? ['asia', 'bs', 'corner'] : ['asia', 'bs']) {
      details[type] = await aiscoreGet(tabId, `${API}/match/odds/detail?match_id=${id}&cid=2&odds_type=${type}`);
      if (!details[type]) { complete = false; break; }
    }
    if (!complete) continue;
    try {
      await backend(`/ext/events/${id}/odds`, { method: 'POST', json: { oddsList, details } });
    } catch (e) {
      if (e instanceof StopRun) throw e;
      console.warn('odds post failed', id, e.message); // never log payloads
    }
  }
}

function run(name, fn) {
  return enqueue(async () => {
    try {
      await fn();
    } catch (e) {
      // StopRun = challenge/upstream: wait for the next tick. Message only, no payloads.
      console.warn(name, 'stopped:', e.message);
    }
  });
}

// ---- wiring -----------------------------------------------------------------

function ensureAlarms() {
  // first loop A soon after install/startup so loop B has today's cache
  chrome.alarms.create('loopA', { delayInMinutes: 0.1, periodInMinutes: 10 });
  chrome.alarms.create('loopB', { periodInMinutes: 5 });
}
chrome.runtime.onInstalled.addListener(ensureAlarms);
chrome.runtime.onStartup.addListener(ensureAlarms);
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'loopA') run('loopA', loopA);
  if (a.name === 'loopB') run('loopB', loopB);
});
