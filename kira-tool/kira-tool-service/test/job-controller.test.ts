import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {as, owner, startApp} from './helpers.ts';
import {transition} from '../src/jobs.ts';

const D1 = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS1/view';
const D2 = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS2/view';
const D3 = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS3/view';
const D4 = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS4/view';
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

const json = {'content-type': 'application/json'};

test('current URL is owner-only and terminal jobs keep the last URL', async (t) => {
  const {base, jobs} = await startApp(t);
  const id = jobs.submit(owner('owner'), D1).job.id;
  jobs.markRunning(id);
  jobs.navigation(id, D1);
  for (const unsafe of ['javascript:alert(1)', 'data:text/html,test', 'https://secret:password@scribd.com/', 'bad url']) {
    jobs.navigation(id, unsafe);
  }
  jobs.fail(id, 'PROVIDER_BLOCKED');
  jobs.navigation(id, D2);
  const detail = await (await fetch(`${base}/api/v1/jobs/${id}`, {headers: as('owner')})).json();
  assert.equal(detail.currentUrl, D1);
  const list = await (await fetch(`${base}/api/v1/jobs`, {headers: as('owner')})).json();
  assert.equal(list[0].currentUrl, D1);
  assert.equal((await fetch(`${base}/api/v1/jobs/${id}`, {headers: as('intruder')})).status, 404);
  assert.deepEqual(await (await fetch(`${base}/api/v1/jobs`, {headers: as('intruder')})).json(), []);
});
const submit = (base: string, user: string, url: string, ip?: string) => fetch(`${base}/api/v1/jobs`, {
  method: 'POST', headers: {...as(user, {csrf: true, ip}), ...json}, body: JSON.stringify({url}),
});

test('submit is 202 then idempotent 200', async (t) => {
  const {base} = await startApp(t);
  const first = await submit(base, 'u1', D1);
  assert.equal(first.status, 202);
  const body = await first.json();
  assert.equal(body.status, 'QUEUED');
  assert.equal(body.provider, 'DRIVE');
  assert.deepEqual(Object.keys(body), ['id', 'provider', 'status', 'stage', 'progress', 'errorCode', 'attempts',
    'retryable', 'displayName', 'fileSize', 'createdAt', 'updatedAt', 'finishedAt', 'expiresAt', 'hasScreenshot', 'currentUrl']);
  const second = await submit(base, 'u1', D1);
  assert.equal(second.status, 200);
  assert.equal((await second.json()).id, body.id);
});

test('invalid url is 400 problem detail without stack trace', async (t) => {
  const {base} = await startApp(t);
  const res = await submit(base, 'u2', 'http://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS1/view');
  assert.equal(res.status, 400);
  assert.match(res.headers.get('content-type')!, /^application\/problem\+json/);
  const text = await res.text();
  assert.equal(JSON.parse(text).code, 'INVALID_URL');
  for (const leak of ['trace', 'Error', 'at ', 'drive.google.com', 'src/']) assert.ok(!text.includes(leak), leak);
});

test("other owner's job is 404", async (t) => {
  const {base, jobs} = await startApp(t);
  const id = jobs.submit(owner('owner'), D1).job.id;
  const get = await fetch(`${base}/api/v1/jobs/${id}`, {headers: as('intruder')});
  assert.equal(get.status, 404);
  assert.equal((await get.json()).code, 'JOB_NOT_FOUND');
  const del = await fetch(`${base}/api/v1/jobs/${id}`, {method: 'DELETE', headers: as('intruder', {csrf: true})});
  assert.equal(del.status, 404);
  assert.equal((await fetch(`${base}/api/v1/jobs/${id}/file`, {headers: as('intruder')})).status, 404);
  assert.deepEqual(await (await fetch(`${base}/api/v1/jobs`, {headers: as('intruder')})).json(), []);
});

test('only the owner can preview a failed job screenshot, which is removed with the job', async (t) => {
  const {base, jobs, files} = await startApp(t);
  const id = jobs.submit(owner('owner'), D1).job.id;
  const url = `${base}/api/v1/jobs/${id}/screenshot`;
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  jobs.markRunning(id);
  files.rememberScreenshot(id, jpeg);
  assert.equal((await fetch(url, {headers: as('owner')})).status, 404);
  jobs.fail(id, 'PROVIDER_EXTRACTION_FAILED');
  const listed = await (await fetch(`${base}/api/v1/jobs`, {headers: as('owner')})).json();
  assert.equal(listed[0].hasScreenshot, true);
  assert.equal((await fetch(url, {headers: as('intruder')})).status, 404);
  const preview = await fetch(url, {headers: as('owner')});
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get('content-type'), 'image/jpeg');
  assert.match(preview.headers.get('cache-control')!, /no-store/);
  assert.deepEqual(new Uint8Array(await preview.arrayBuffer()), jpeg);
  jobs.remove(owner('owner'), id);
  assert.equal(files.screenshot(id), null);
});

test('eleventh submit in a minute is rate limited', async (t) => {
  const {base} = await startApp(t);
  for (let i = 0; i < 10; i++) assert.equal((await submit(base, 'spammer', 'https://example.com/x')).status, 400);
  const res = await submit(base, 'spammer', 'https://example.com/x');
  assert.equal(res.status, 429);
  assert.equal((await res.json()).code, 'RATE_LIMITED');
});

test('rate limit is per client address not per cookie', async (t) => {
  // A public tool: clearing cookies (new owner id) must not reset the submit limit.
  const {base} = await startApp(t);
  for (let i = 0; i < 10; i++) {
    assert.equal((await submit(base, `rot${i}`, 'https://example.com/x', '10.9.9.9')).status, 400);
  }
  const res = await submit(base, 'rot10', 'https://example.com/x', '10.9.9.9');
  assert.equal(res.status, 429);
  assert.equal((await res.json()).code, 'RATE_LIMITED');
});

test('fourth active job is 429', async (t) => {
  const {base} = await startApp(t);
  assert.equal((await submit(base, 'capped', D1)).status, 202);
  assert.equal((await submit(base, 'capped', D2)).status, 202);
  assert.equal((await submit(base, 'capped', D3)).status, 202);
  const res = await submit(base, 'capped', D4);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).code, 'TOO_MANY_ACTIVE_JOBS');
});

test('oversized body is 413', async (t) => {
  // Short URL plus padding: only the body-size cap can trigger, not the 2048-char URL limit.
  const {base} = await startApp(t);
  const res = await fetch(`${base}/api/v1/jobs`, {
    method: 'POST', headers: {...as('big', {csrf: true}), ...json},
    body: JSON.stringify({url: D1, pad: 'a'.repeat(4200)}),
  });
  assert.equal(res.status, 413);
  assert.equal((await res.json()).code, 'INVALID_REQUEST');
});

test('chunked submit without content-length is 411', async (t) => {
  const {port} = await startApp(t);
  const {status, body} = await new Promise<{status: number; body: string}>((resolve, reject) => {
    const req = request({host: '127.0.0.1', port, method: 'POST', path: '/tool-service/api/v1/jobs',
      headers: {...as('chunk', {csrf: true}), ...json, 'transfer-encoding': 'chunked'}}, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => resolve({status: res.statusCode!, body: b}));
    });
    req.on('error', reject);
    req.end(JSON.stringify({url: D1}));
  });
  assert.equal(status, 411);
  assert.equal(JSON.parse(body).code, 'INVALID_REQUEST');
});

test('blank, missing or too long url is invalid url', async (t) => {
  const {base} = await startApp(t);
  for (const url of ['', `https://drive.google.com/${'a'.repeat(2100)}`]) {
    const res = await submit(base, 'bad', url);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, 'INVALID_URL');
  }
  for (const body of ['{}', '{"url":null}', '{"url":123}']) {
    const res = await fetch(`${base}/api/v1/jobs`, {method: 'POST', headers: {...as('bad', {csrf: true}), ...json}, body});
    assert.equal(res.status, 400, body);
    assert.equal((await res.json()).code, 'INVALID_URL', body);
  }
});

test('malformed id and bad json are invalid request without stack trace', async (t) => {
  const {base} = await startApp(t);
  let res = await fetch(`${base}/api/v1/jobs/not-a-uuid`, {headers: as('mf')});
  assert.equal(res.status, 400);
  let text = await res.text();
  assert.equal(JSON.parse(text).code, 'INVALID_REQUEST');
  assert.ok(!text.includes('Error') && !text.includes('UUID'));
  for (const body of ['{not json', '', '[]', '"x"', '{"url":{}}']) {
    res = await fetch(`${base}/api/v1/jobs`, {method: 'POST', headers: {...as('mf', {csrf: true}), ...json}, body});
    assert.equal(res.status, 400, body);
    text = await res.text();
    assert.equal(JSON.parse(text).code, 'INVALID_REQUEST', body);
    assert.ok(!text.includes('Error') && !text.includes('JSON'), body);
  }
  res = await fetch(`${base}/api/v1/jobs`, {method: 'POST', headers: {...as('mf', {csrf: true}), 'content-type': 'text/plain'}, body: 'x'});
  assert.equal(res.status, 415);
  assert.equal((await res.json()).code, 'INVALID_REQUEST');
  res = await fetch(`${base}/api/v1/jobs`, {method: 'PUT', headers: as('mf', {csrf: true})});
  assert.equal(res.status, 405);
  assert.equal((await res.json()).code, 'INVALID_REQUEST');
});

test('download of queued job is 404', async (t) => {
  const {base, jobs} = await startApp(t);
  const id = jobs.submit(owner('q'), D1).job.id;
  const res = await fetch(`${base}/api/v1/jobs/${id}/file`, {headers: as('q')});
  assert.equal(res.status, 404);
  assert.equal((await res.json()).code, 'JOB_NOT_FOUND');
});

test('download of expired job is 410', async (t) => {
  const {base, jobs, files, repo} = await startApp(t);
  const id = jobs.submit(owner('exp'), D1).job.id;
  jobs.markRunning(id);
  jobs.succeed(id, 'report', await files.write(id, PDF));
  assert.equal(repo.cas(transition(jobs.get(owner('exp'), id), 'EXPIRED', new Date()), 'SUCCEEDED'), true);
  const res = await fetch(`${base}/api/v1/jobs/${id}/file`, {headers: as('exp')});
  assert.equal(res.status, 410);
  assert.equal((await res.json()).code, 'FILE_EXPIRED');
});

test('download headers are safe for quotes, control chars and unicode', async (t) => {
  const {base, jobs, files} = await startApp(t);
  const id = jobs.submit(owner('dl'), D1).job.id;
  jobs.markRunning(id);
  jobs.succeed(id, 're"port\r\nX-Evil: 1 é日本', await files.write(id, PDF));
  const res = await fetch(`${base}/api/v1/jobs/${id}/file`, {headers: as('dl')});
  assert.equal(res.status, 200);
  const cd = res.headers.get('content-disposition')!;
  assert.ok(cd.startsWith('attachment'));
  assert.ok(cd.includes("filename*=UTF-8''"));
  assert.ok(!cd.includes('\r') && !cd.includes('\n') && !cd.includes('"'));
  assert.equal(cd, "attachment; filename*=UTF-8''re%22portX-Evil%3A%201%20%C3%A9%E6%97%A5%E6%9C%AC.pdf");
  assert.equal(res.headers.get('x-evil'), null);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('cache-control')!.includes('no-store'));
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [...PDF]);
});

test('download of succeeded job with missing file is 410', async (t) => {
  const {base, jobs, files} = await startApp(t);
  const id = jobs.submit(owner('gone'), D1).job.id;
  jobs.markRunning(id);
  jobs.succeed(id, 'report', await files.write(id, PDF));
  files.delete(id);
  const res = await fetch(`${base}/api/v1/jobs/${id}/file`, {headers: as('gone')});
  assert.equal(res.status, 410);
  assert.equal((await res.json()).code, 'FILE_EXPIRED');
});

test('cancel then delete', async (t) => {
  const {base, jobs} = await startApp(t);
  const id = jobs.submit(owner('cd'), D1).job.id;
  const del = () => fetch(`${base}/api/v1/jobs/${id}`, {method: 'DELETE', headers: as('cd', {csrf: true})});
  assert.equal((await del()).status, 204);
  assert.equal((await (await fetch(`${base}/api/v1/jobs/${id}`, {headers: as('cd')})).json()).status, 'CANCELLED');
  assert.equal((await del()).status, 204);
  assert.equal((await fetch(`${base}/api/v1/jobs/${id}`, {headers: as('cd')})).status, 404);
});

test('retry on queued job is 409', async (t) => {
  const {base, jobs} = await startApp(t);
  const id = jobs.submit(owner('rt'), D1).job.id;
  const res = await fetch(`${base}/api/v1/jobs/${id}/retry`, {method: 'POST', headers: {...as('rt', {csrf: true}), ...json}, body: '{}'});
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'JOB_NOT_RETRYABLE');
});

test('retry of failed job is 202 and uppercase id resolves', async (t) => {
  const {base, jobs} = await startApp(t);
  const id = jobs.submit(owner('rt2'), D1).job.id;
  jobs.markRunning(id);
  jobs.fail(id, 'PROVIDER_BLOCKED');
  const view = await (await fetch(`${base}/api/v1/jobs/${id.toUpperCase()}`, {headers: as('rt2')})).json();
  assert.equal(view.errorCode, 'PROVIDER_BLOCKED');
  assert.equal(view.retryable, true);
  const res = await fetch(`${base}/api/v1/jobs/${id}/retry`, {method: 'POST', headers: {...as('rt2', {csrf: true}), ...json}, body: '{}'});
  assert.equal(res.status, 202);
  assert.equal((await res.json()).status, 'QUEUED');
});
