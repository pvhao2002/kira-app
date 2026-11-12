import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadConfig, parseDuration} from '../src/config.ts';

test('defaults match application.yml', () => {
  assert.deepEqual(loadConfig({}), {
    port: 1407, dataDir: './data', storageDir: './storage', retentionDays: 7, workers: 2, queueSize: 20,
    jobTimeoutMs: 600_000, headless: true, maxFileBytes: 104_857_600, cookieSecure: true, forwardHeaders: 'native',
  });
});

test('env overrides and relaxed booleans', () => {
  const c = loadConfig({TOOL_PORT: '9000', TOOL_COOKIE_SECURE: 'FALSE', TOOL_HEADLESS: 'off', TOOL_FORWARD_HEADERS: 'NONE',
    TOOL_JOB_TIMEOUT: 'PT1H30M', TOOL_WORKERS: '4'});
  assert.equal(c.port, 9000);
  assert.equal(c.cookieSecure, false);
  assert.equal(c.headless, false);
  assert.equal(c.forwardHeaders, 'none');
  assert.equal(c.jobTimeoutMs, 5_400_000);
  assert.equal(c.workers, 4);
  assert.throws(() => loadConfig({TOOL_WORKERS: 'two'}), /TOOL_WORKERS/);
  assert.throws(() => loadConfig({TOOL_COOKIE_SECURE: 'maybe'}), /TOOL_COOKIE_SECURE/);
  assert.throws(() => loadConfig({TOOL_FORWARD_HEADERS: 'framework'}), /TOOL_FORWARD_HEADERS/);
});

test('iso-8601 durations', () => {
  assert.equal(parseDuration('PT10M'), 600_000);
  assert.equal(parseDuration('pt30s'), 30_000);
  assert.equal(parseDuration('PT1.5S'), 1500);
  assert.equal(parseDuration('PT2H'), 7_200_000);
  for (const bad of ['10m', 'PT', 'P1D', '', 'PT-1M']) assert.throws(() => parseDuration(bad), /TOOL_JOB_TIMEOUT/, bad);
});
