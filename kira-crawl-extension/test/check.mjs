import assert from 'node:assert/strict';
import { hcmDate, inWindow, clampRps, createLimiter, classifyResponse } from '../lib.js';

// hcmDate: HCM = UTC+7, day flips at 17:00Z
assert.equal(hcmDate(new Date('2026-01-01T16:59:59Z')), '20260101');
assert.equal(hcmDate(new Date('2026-01-01T17:00:00Z')), '20260102');
assert.equal(hcmDate(new Date('2026-12-31T17:00:00Z')), '20270101');

// inWindow boundaries +/-1h inclusive
const now = new Date('2026-01-01T12:00:00Z');
assert.equal(inWindow('2026-01-01T13:00:00Z', now, 3600e3), true);
assert.equal(inWindow('2026-01-01T13:00:01Z', now, 3600e3), false);
assert.equal(inWindow('2026-01-01T11:00:00Z', now, 3600e3), true);
assert.equal(inWindow('2026-01-01T10:59:59Z', now, 3600e3), false);
assert.equal(inWindow('2026-01-01T19:00:00+07:00', now, 3600e3), true); // 12:00Z
assert.equal(inWindow('garbage', now, 3600e3), false);

// clamp 1..10
assert.equal(clampRps(0), 1);
assert.equal(clampRps(-5), 1);
assert.equal(clampRps(99), 10);
assert.equal(clampRps(5), 5);
assert.equal(clampRps('abc'), 1);

// limiter default 1 req/s: 3 calls span >= 2s
const limit = createLimiter();
const t0 = Date.now();
await limit(); await limit(); await limit();
assert.ok(Date.now() - t0 >= 1990, 'limiter too fast: ' + (Date.now() - t0));

// classifyResponse
assert.equal(classifyResponse({ status: 200, mitigated: 'challenge' }), 'challenge');
assert.equal(classifyResponse({ status: 200, contentType: 'text/html', sample: '<title>Just a moment...</title>' }), 'challenge');
assert.equal(classifyResponse({ status: 200, contentType: 'text/html', sample: 'Verify you are human' }), 'challenge');
assert.equal(classifyResponse({ status: 200, contentType: 'text/html', sample: 'x cf-chl-abc' }), 'challenge');
for (const status of [403, 429, 503]) assert.equal(classifyResponse({ status }), 'upstream');
assert.equal(classifyResponse({ status: 403, contentType: 'text/html', sample: 'Just a moment' }), 'challenge');
assert.equal(classifyResponse({ status: 403, mitigated: 'challenge' }), 'challenge');
assert.equal(classifyResponse({ status: 403, contentType: 'text/html', sample: '<html>forbidden</html>' }), 'upstream');
for (const status of [0, 404, 500]) assert.equal(classifyResponse({ status }), 'upstream');
assert.equal(classifyResponse({ status: 200, contentType: 'text/html; charset=utf-8', sample: '<html>hi</html>' }), 'html');
assert.equal(classifyResponse({ status: 200, contentType: 'application/octet-stream' }), 'ok');

// validBaseUrl: https anywhere, http only for localhost, junk rejected
const { validBaseUrl } = await import('../options.js');
assert.equal(validBaseUrl('https://host.example/queue'), true);
assert.equal(validBaseUrl('http://localhost:2323/queue'), true);
assert.equal(validBaseUrl('http://127.0.0.1:2323/queue'), true);
assert.equal(validBaseUrl('http://host.example/queue'), false);
assert.equal(validBaseUrl('not a url'), false);

console.log('check.mjs OK');
