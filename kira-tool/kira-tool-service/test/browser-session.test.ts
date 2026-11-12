import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import type {Page} from 'patchright';
import {allowRequest, isChallengeUrl, looksLikeChallenge, openDocument, trackNavigation} from '../src/browser.ts';

test('navigation tracks main-page requests and redirects but ignores assets and subframes', () => {
  const emitter = new EventEmitter();
  const main = {url: () => 'https://www.scribd.com/document/12345#page=2'};
  const child = {url: () => 'https://ads.example.com/'};
  const fake = Object.assign(emitter, {mainFrame: () => main});
  const seen: string[] = [];
  trackNavigation(fake as unknown as Page, (url) => seen.push(url));
  const request = (url: string, frame: object, navigation = true) => ({
    url: () => url, frame: () => frame, isNavigationRequest: () => navigation,
  });
  emitter.emit('request', request('https://www.scribd.com/document/12345', main));
  emitter.emit('request', request('https://www.scribd.com/redirected', main));
  emitter.emit('request', request('https://cdn.example.com/image.png', main, false));
  emitter.emit('request', request(child.url(), child));
  emitter.emit('framenavigated', child);
  emitter.emit('framenavigated', main);
  assert.deepEqual(seen, ['https://www.scribd.com/document/12345', 'https://www.scribd.com/redirected', main.url()]);
});

const OFF_ALLOWLIST = 'https://accounts.google.com/signin';

test('only top-frame navigation is held to the provider allowlist', () => {
  assert.equal(allowRequest(OFF_ALLOWLIST, true, true), false);
  assert.equal(allowRequest(OFF_ALLOWLIST, true, false), true);
  assert.equal(allowRequest(OFF_ALLOWLIST, false, true), true);
  assert.equal(allowRequest('https://drive.google.com/file/d/abcdefghij/view', true, true), true);
});

test('private targets are blocked in every frame', () => {
  assert.equal(allowRequest('http://169.254.169.254/latest/meta-data', false, false), false);
  assert.equal(allowRequest('http://localhost:1407/', true, false), false);
});

const page = (p: Partial<Parameters<typeof looksLikeChallenge>[0]>) =>
  looksLikeChallenge({url: 'https://www.scribd.com/embeds/1/content', title: 'Doc', frameUrls: [], text: '', ...p});

test('google sorry page and cloudflare challenge urls are challenges', () => {
  assert.equal(isChallengeUrl('https://www.google.com/sorry/index?continue=x'), true);
  assert.equal(isChallengeUrl('https://google.com.vn/sorry/index'), true);
  assert.equal(isChallengeUrl('https://www.scribd.com/cdn-cgi/challenge-platform/h/b/orchestrate'), true);
  assert.equal(isChallengeUrl('https://drive.google.com/file/d/abc/view'), false);
  assert.equal(isChallengeUrl('https://www.scribd.com/document/1/sorry-for-the-delay'), false);
  assert.equal(isChallengeUrl('not a url'), false);
});

test('challenge titles, iframes and text are detected', () => {
  assert.equal(page({title: 'Just a moment...'}), true);
  assert.equal(page({title: 'Attention Required! | Cloudflare'}), true);
  assert.equal(page({frameUrls: ['https://challenges.cloudflare.com/cdn-cgi/challenge-platform/turnstile']}), true);
  assert.equal(page({frameUrls: ['https://newassets.hcaptcha.com/captcha/v1/abc/static/hcaptcha.html#frame=checkbox']}), true);
  assert.equal(page({frameUrls: ['https://www.google.com/recaptcha/api2/anchor?k=x&size=normal']}), true);
  assert.equal(page({frameUrls: ['https://www.google.com/recaptcha/api2/bframe?k=x']}), true);
  assert.equal(page({text: 'Our systems have detected unusual traffic from your computer network.'}), true);
  assert.equal(page({url: 'https://www.google.com/sorry/index'}), true);
});

test('normal pages and invisible recaptcha are not challenges', () => {
  assert.equal(page({}), false);
  assert.equal(page({title: 'Just a moment in history - Scribd'}), false);
  assert.equal(page({frameUrls: ['https://www.google.com/recaptcha/api2/anchor?k=x&size=invisible']}), false);
  assert.equal(page({frameUrls: ['about:blank', 'https://www.youtube.com/embed/x']}), false);
  assert.equal(page({text: 'A report on traffic patterns in Hanoi.'}), false);
});

test('Scribd browser verification is detected before the CAPTCHA is visible', () => {
  assert.equal(page({title: 'Client Challenge'}), true);
  assert.equal(page({text: '[SCRIBD]\nis verifying your browser...'}), true);
  assert.equal(page({text: 'is verifying your browser...'}), true);
  assert.equal(page({text: 'This article explains why Scribd is verifying your browser.'}), false);
});

test('navigation stops at source errors and detects verification even with HTTP 200', async () => {
  const url = 'https://www.scribd.com/document/12345';
  const moves: [number, number][] = [];
  const browserPage = (status: number, title = 'Document') => ({
    goto: async () => ({status: () => status}),
    url: () => url,
    evaluate: async () => '',
    title: async () => title,
    frames: () => [],
    mouse: {move: async (x: number, y: number) => { moves.push([x, y]); }},
    waitForTimeout: async () => {},
  }) as unknown as Page;

  for (const status of [403, 429]) {
    await assert.rejects(openDocument(browserPage(status), url), {code: 'PROVIDER_BLOCKED'});
  }
  await assert.rejects(openDocument(browserPage(200, 'Client Challenge'), url), {code: 'PROVIDER_BLOCKED'});
  await assert.rejects(openDocument(browserPage(404), url), {code: 'PROVIDER_EXTRACTION_FAILED'});
  assert.equal(moves.length, 0, 'no user simulation on a failed load');
  await openDocument(browserPage(200), url);
  assert.ok(moves.length >= 3, 'mouse moves like a reader after the page loads');
  assert.ok(moves.every(([x, y]) => x >= 0 && x < 1280 && y >= 0 && y < 720), 'moves stay inside the window');
});
