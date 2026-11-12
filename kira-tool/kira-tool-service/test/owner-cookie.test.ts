import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setCookies, startApp} from './helpers.ts';

/** No login: every browser gets an anonymous owner id cookie, and jobs are scoped to it. */
const ownerCookie = (res: Response) => setCookies(res).find((c) => c.startsWith('tool_owner=')) ?? null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test('first visit without login gets hardened owner cookie', async (t) => {
  const {base} = await startApp(t);
  const res = await fetch(`${base}/api/v1/jobs`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
  const set = ownerCookie(res);
  assert.ok(set);
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/tool-service', 'Max-Age=2592000']) {
    assert.ok(set.includes(attr), attr);
  }
  const value = set.slice(set.indexOf('=') + 1, set.indexOf(';'));
  assert.match(value, UUID);
});

test('valid owner cookie is kept and not reissued', async (t) => {
  const {base} = await startApp(t);
  const res = await fetch(`${base}/api/v1/jobs`, {headers: {cookie: `tool_owner=${randomUUID()}`}});
  assert.equal(res.status, 200);
  assert.equal(ownerCookie(res), null);
});

test('forged non-uuid owner cookie is replaced', async (t) => {
  const {base} = await startApp(t);
  for (const forged of ['admin', '1-1-1-1-1', '', "' OR 1=1 --", randomUUID().toUpperCase()]) {
    const res = await fetch(`${base}/api/v1/jobs`, {headers: {cookie: `tool_owner=${forged}`}});
    assert.equal(res.status, 200, forged);
    const set = ownerCookie(res);
    assert.ok(set, forged);
    assert.ok(!set.startsWith(`tool_owner=${forged};`), forged);
  }
});

test('mutation without csrf is 403', async (t) => {
  const {base} = await startApp(t);
  const post = (headers: Record<string, string>) => fetch(`${base}/api/v1/jobs`, {
    method: 'POST', headers: {'content-type': 'application/json', ...headers},
    body: JSON.stringify({url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS1/view'}),
  });
  assert.equal((await post({})).status, 403);
  assert.equal((await post({cookie: 'TOOL-XSRF-TOKEN=a'})).status, 403);
  assert.equal((await post({'x-tool-xsrf-token': 'a'})).status, 403);
  const mismatch = await post({cookie: 'TOOL-XSRF-TOKEN=a', 'x-tool-xsrf-token': 'b'});
  assert.equal(mismatch.status, 403);
  assert.equal((await mismatch.json()).code, 'INVALID_REQUEST');
  assert.equal((await post({cookie: 'TOOL-XSRF-TOKEN=a', 'x-tool-xsrf-token': 'a'})).status, 202);
});

test('login endpoints are gone', async (t) => {
  const {base} = await startApp(t);
  assert.equal((await fetch(`${base}/api/v1/auth/me`)).status, 404);
});

test('csrf cookie and csp are hardened', async (t) => {
  const {base} = await startApp(t);
  const res = await fetch(`${base}/api/v1/jobs`);
  const csrf = setCookies(res).find((c) => c.startsWith('TOOL-XSRF-TOKEN='));
  assert.ok(csrf);
  assert.ok(csrf.includes('Secure'));
  assert.ok(csrf.includes('Path=/;'));
  assert.ok(csrf.includes('SameSite=Strict'));
  assert.ok(!csrf.includes('HttpOnly')); // the SPA must read it
  assert.ok(res.headers.get('content-security-policy')!.startsWith("default-src 'none'"));
  assert.equal(res.headers.get('content-security-policy'), "default-src 'none'; frame-ancestors 'none'");
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  // An existing token is not reissued.
  const again = await fetch(`${base}/api/v1/jobs`, {headers: {cookie: 'TOOL-XSRF-TOKEN=abc'}});
  assert.equal(setCookies(again).some((c) => c.startsWith('TOOL-XSRF-TOKEN=')), false);
});

test('cookie secure can be disabled for local http', async (t) => {
  const {base} = await startApp(t, false);
  const res = await fetch(`${base}/api/v1/jobs`);
  assert.equal(setCookies(res).length, 2);
  assert.ok(setCookies(res).every((c) => !c.includes('Secure')));
});
