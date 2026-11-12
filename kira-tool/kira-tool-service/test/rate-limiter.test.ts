import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {RateLimiter} from '../src/rate-limiter.ts';

test('limits per key and resets after window', async () => {
  const limiter = new RateLimiter(2, 50);
  assert.equal(limiter.tryAcquire('a'), true);
  assert.equal(limiter.tryAcquire('a'), true);
  assert.equal(limiter.tryAcquire('a'), false);
  assert.equal(limiter.tryAcquire('b'), true);
  await sleep(80);
  assert.equal(limiter.tryAcquire('a'), true);
});
