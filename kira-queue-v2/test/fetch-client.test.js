import test from 'node:test';
import assert from 'node:assert/strict';
import { createFetchClient, decodeResultBody, ORIGIN, SINGLE_FETCH_SCRIPT } from '../src/browser/fetch-client.js';
import { waitForClearance, requireClearance, PAGE_STATE_SCRIPT } from '../src/browser/cloudflare.js';
import { Lane, BrowserManager } from '../src/browser/lane.js';

const b64 = (s) => Buffer.from(s).toString('base64');
const ok = (body = 'abc') => ({ ok: true, status: 200, contentType: 'application/x-protobuf', challenge: false, bodyLen: 3, body: b64(body) });

/** Fake page: evaluate answers page-state probes with `states` and fetch scripts with `fetchResults`. */
function fakePage({ states = ['ready'], fetchResults = [ok()], closed = false, reloadError = null } = {}) {
  const calls = { evaluate: [], waits: [], reloads: 0 };
  const s = [...states];
  const f = [...fetchResults];
  return {
    calls,
    isClosed: () => closed,
    // Patchright 1.64.3 signature: evaluate(fn, arg, options, isolatedContext = true); non-object options throws.
    async evaluate(script, arg, options, isolated = true) {
      if (options !== undefined && (typeof options !== 'object' || options === null || Array.isArray(options))) {
        throw new Error('Too many arguments. If you need to pass more than 1 argument to the function wrap them in an object.');
      }
      calls.evaluate.push({ script, arg, isolated });
      if (script === PAGE_STATE_SCRIPT) return s.length > 1 ? s.shift() : s[0];
      const next = f.length > 1 ? f.shift() : f[0];
      if (next instanceof Error) throw next;
      return next;
    },
    async waitForTimeout(ms) { calls.waits.push(ms); },
    async reload() {
      calls.reloads += 1;
      if (reloadError) throw reloadError;
    },
  };
}

const client = createFetchClient({ verificationTimeoutMs: 2000, acceptLanguage: 'en-US' });

test('fetchOptional returns decoded body and evaluates in the main world', async () => {
  const page = fakePage();
  const body = await client.fetchOptional(page, 'https://api/x');
  assert.equal(body.toString(), 'abc');
  const fetchCall = page.calls.evaluate.find((c) => c.script === SINGLE_FETCH_SCRIPT);
  assert.equal(fetchCall.isolated, false);
  assert.deepEqual(fetchCall.arg, { url: 'https://api/x', referer: ORIGIN, origin: ORIGIN, acceptLanguage: 'en-US' });
});

test('fetchOptional pre-waits 200 ms', async () => {
  const page = fakePage();
  await client.fetchOptional(page, 'u');
  assert.equal(page.calls.waits[0], 200);
});

test('decodeResultBody error codes', () => {
  const code = (r) => { try { decodeResultBody('u', r); } catch (e) { return [e.message.split(':')[0], e.status]; } return null; };
  assert.deepEqual(code({ challenge: true }), ['AISCORE_VERIFICATION_REQUIRED', 503]);
  assert.deepEqual(code({ mitigated: 'challenge' }), ['AISCORE_VERIFICATION_REQUIRED', 503]);
  for (const s of [403, 429, 503]) assert.deepEqual(code({ status: s }), ['AISCORE_UPSTREAM_UNAVAILABLE', 503]);
  assert.deepEqual(code({ status: 200, contentType: 'Text/HTML; charset=utf-8' }), ['AISCORE_UNEXPECTED_RESPONSE', 502]);
  assert.equal(decodeResultBody('u', { ok: false, status: 500, contentType: '' }), null);
  assert.equal(decodeResultBody('u', { ok: true, status: 200, contentType: '', body: '' }), null);
  assert.equal(decodeResultBody('u', { ok: true, status: 200, contentType: '', body: '***' }), null);
});

test('challenge once: reloads, waits for clearance, retries and succeeds', async () => {
  const page = fakePage({ fetchResults: [{ challenge: true, status: 200 }, ok('xyz')] });
  const body = await client.fetchOptional(page, 'u');
  assert.equal(body.toString(), 'xyz');
  assert.equal(page.calls.reloads, 1);
});

test('challenge twice: verification error propagates after exactly one retry', async () => {
  const page = fakePage({ fetchResults: [{ challenge: true }] });
  await assert.rejects(client.fetchOptional(page, 'u'), /^BusinessException: AISCORE_VERIFICATION_REQUIRED/);
  assert.equal(page.calls.reloads, 1);
});

test('upstream 429 is not retried', async () => {
  const page = fakePage({ fetchResults: [{ status: 429 }] });
  await assert.rejects(client.fetchOptional(page, 'u'), /AISCORE_UPSTREAM_UNAVAILABLE/);
  assert.equal(page.calls.reloads, 0);
});

test('reload failure after API challenge still yields the verification code', async () => {
  const page = fakePage({ states: ['ready', 'challenge'], fetchResults: [{ challenge: true }], reloadError: new Error('reload timeout') });
  const fast = createFetchClient({ verificationTimeoutMs: 0, acceptLanguage: 'en-US' });
  await assert.rejects(fast.fetchOptional(page, 'u'), /^BusinessException: AISCORE_VERIFICATION_REQUIRED/);
  assert.equal(page.calls.reloads, 1);
});

test('evaluate crash (non-business) yields null', async () => {
  const page = fakePage({ fetchResults: [new Error('boom')] });
  assert.equal(await client.fetchOptional(page, 'u'), null);
});

test('waitForClearance polls until ready, false on timeout or closed page', async () => {
  const page = fakePage({ states: ['loading', 'challenge', 'ready'] });
  assert.equal(await waitForClearance(page, 5000), true);
  assert.deepEqual(page.calls.waits, [500, 500]);
  assert.equal(await waitForClearance(fakePage({ states: ['challenge'] }), 0), false);
  assert.equal(await waitForClearance(fakePage({ closed: true }), 1000), false);
  await assert.rejects(requireClearance(fakePage({ states: ['challenge'] }), 0), /AISCORE_VERIFICATION_REQUIRED/);
});

test('Lane: launches persistent context with Patchright options, reinitializes closed page, closes on every path', async () => {
  const launches = [];
  const closed = [];
  const mkContext = () => {
    const page = { _closed: false, isClosed() { return this._closed; }, async goto() {}, async close() { this._closed = true; } };
    return { page, pages: () => [page], newPage: async () => page, close: async () => { closed.push(1); } };
  };
  let ctx;
  const browserType = { launchPersistentContext: async (dir, opts) => { launches.push({ dir, opts }); ctx = mkContext(); return ctx; } };
  const lane = new Lane('date', { headless: true, channel: 'chrome', profileBaseDir: '.p', profileInstanceId: 'port2323' }, browserType);
  const order = [];
  await Promise.all([
    lane.withPage(async () => { order.push('a1'); await new Promise((r) => setTimeout(r, 20)); order.push('a2'); }),
    lane.withPage(async () => { order.push('b'); }),
  ]);
  assert.deepEqual(order, ['a1', 'a2', 'b']); // serialized
  assert.equal(launches.length, 1);
  assert.match(launches[0].dir.replaceAll('\\', '/'), /\.p\/port2323\/date$/);
  assert.deepEqual(launches[0].opts, { headless: true, channel: 'chrome', viewport: null });
  ctx.page._closed = true;
  await lane.withPage(async () => {});
  assert.equal(launches.length, 2); // re-init
  await assert.rejects(lane.withPage(async () => { throw new Error('x'); }), /x/);
  await lane.withPage(async () => {}); // lane still usable after a failure
  await lane.close();
  assert.equal(closed.length, 2); // re-init closed the first context, close() the second
});

test('Lane: goto failure closes the half-open context and the next call relaunches', async () => {
  let launches = 0;
  let closes = 0;
  const browserType = {
    launchPersistentContext: async () => {
      launches += 1;
      const failGoto = launches === 1;
      const page = { isClosed: () => false, async goto() { if (failGoto) throw new Error('nav failed'); }, async close() {} };
      return { pages: () => [page], newPage: async () => page, close: async () => { closes += 1; } };
    },
  };
  const lane = new Lane('event', { headless: true, channel: 'chrome', profileBaseDir: '.p', profileInstanceId: 'p' }, browserType);
  await assert.rejects(lane.withPage(async () => 'unused'), /nav failed/);
  assert.equal(closes, 1);
  assert.equal(await lane.withPage(async () => 'ok'), 'ok');
  assert.equal(launches, 2);
});

test('BrowserManager returns stable named lanes', () => {
  const m = new BrowserManager({}, {});
  assert.equal(m.getLane('date'), m.getLane('date'));
  assert.notEqual(m.getLane('event'), m.getLane('date'));
});
