import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedHost, parseProviderUrl} from '../src/provider.ts';
import {ToolError} from '../src/errors.ts';

const ID = '1AbCdEfGhIjKlMnOpQrSt';
const code = (fn: () => unknown, expected: string) =>
  assert.throws(fn, (e: unknown) => e instanceof ToolError && e.code === expected);

test('drive file url', () => {
  const p = parseProviderUrl(`https://drive.google.com/file/d/${ID}/view?usp=sharing`);
  assert.equal(p.provider, 'DRIVE');
  assert.equal(p.sourceId, ID);
  assert.equal(p.canonicalUrl, `https://drive.google.com/file/d/${ID}/view`);
});

test('scribd document and doc urls', () => {
  for (const path of ['/document/123456789/Some-Title', '/doc/123456789/Some-Title']) {
    const p = parseProviderUrl('https://www.scribd.com' + path);
    assert.equal(p.provider, 'SCRIBD');
    assert.equal(p.sourceId, '123456789');
    assert.equal(p.canonicalUrl, 'https://www.scribd.com/embeds/123456789/content');
  }
  assert.equal(parseProviderUrl('https://scribd.com/document/123456789/x').sourceId, '123456789');
  assert.equal(parseProviderUrl('https://vi.scribd.com/document/123456789/x').provider, 'SCRIBD');
});

for (const url of [
  'http://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view',
  'https://drive.google.com@evil.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view',
  'https://drive.google.com:8443/file/d/1AbCdEfGhIjKlMnOpQrSt/view',
  'file:///etc/passwd',
  'javascript:alert(1)',
  'https://drive.google.com/file/d/%2e%2e/view',
  'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt/../../x',
  'https://drive.google.com/other/path',
  'not a url', '', '   ',
]) {
  test(`invalid url ${JSON.stringify(url)}`, () => code(() => parseProviderUrl(url), 'INVALID_URL'));
}

for (const url of [
  'https://drive.google.com.evil.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view',
  'https://127.0.0.1/file/d/1AbCdEfGhIjKlMnOpQrSt/view',
  'https://[::1]/file/d/1AbCdEfGhIjKlMnOpQrSt/view',
  'https://evilscribd.com/document/123456789/x',
  'https://example.com/',
  'https://abc.scribd.com/document/123456789/x',
  'https://x.vi.scribd.com/document/123456789/x',
  'https://scribd.com.evil.com/document/123456789/x',
  'https://vi.scribd.com./document/123456789/x',
]) {
  test(`unsupported host ${url}`, () => code(() => parseProviderUrl(url), 'UNSUPPORTED_PROVIDER'));
}

test('case-insensitive scheme and host, embeds path and encoded slug', () => {
  const d = parseProviderUrl(`HTTPS://DRIVE.GOOGLE.COM/file/d/${ID}/view`);
  assert.equal(d.canonicalUrl, `https://drive.google.com/file/d/${ID}/view`);
  const s = parseProviderUrl('https://WWW.SCRIBD.COM/embeds/123456789/content');
  assert.equal(s.provider, 'SCRIBD');
  assert.equal(s.sourceId, '123456789');
  assert.equal(parseProviderUrl('https://vi.scribd.com/document/123456789/T%C3%A0i-Li%E1%BB%87u').canonicalUrl,
    'https://www.scribd.com/embeds/123456789/content');
});

test('isAllowedHost', () => {
  assert.equal(isAllowedHost('drive.google.com'), true);
  assert.equal(isAllowedHost('vi.scribd.com'), true);
  assert.equal(isAllowedHost('accounts.google.com'), false);
});

test('too long and null', () => {
  const long = `https://drive.google.com/file/d/${ID}/view?` + 'a'.repeat(2100);
  assert.throws(() => parseProviderUrl(long), ToolError);
  assert.throws(() => parseProviderUrl(null), ToolError);
});
