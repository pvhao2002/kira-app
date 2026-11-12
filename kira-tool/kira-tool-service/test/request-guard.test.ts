import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allow, requireAllowedMainFrame} from '../src/provider.ts';
import {ToolError} from '../src/errors.ts';

test('allows public subresources and allowlisted navigation', () => {
  assert.equal(allow('https://lh3.googleusercontent.com/x', false), true);
  assert.equal(allow('https://drive.google.com/file/d/abc/view', true), true);
  assert.equal(allow('https://www.scribd.com/embeds/123/content', true), true);
});

test('blocks off-allowlist main frame navigation', () => {
  assert.equal(allow('https://accounts.google.com/signin', true), false);
  assert.equal(allow('https://accounts.google.com/signin', false), true);
});

test('blocks non-http, IP literals and localhost', () => {
  for (const u of ['file:///etc/passwd', 'ftp://example.com/x', 'http://127.0.0.1/', 'http://[::1]/',
    'http://2130706433/', 'http://0x7f.0.0.1/', 'http://localhost:8080/', 'http://a.localhost/',
    'http://169.254.169.254/latest/meta-data', 'not a url', 'http://localhost./',
    'data:text/html,hi', 'blob:https://drive.google.com/abc']) {
    assert.equal(allow(u, false), false, u);
  }
});

test('allows unescaped query chars and uppercase', () => {
  assert.equal(allow('https://fonts.googleapis.com/css?family=A|B', false), true);
  assert.equal(allow('https://x.example.com/a?q={1}^', false), true);
  assert.equal(allow('HTTPS://DRIVE.GOOGLE.COM/file/d/abc/view', true), true);
});

test('main frame host matches allowlist exactly', () => {
  assert.equal(allow('https://de.scribd.com/document/123', true), true);
  assert.equal(allow('https://drive.google.com.evil.com/', true), false);
  assert.equal(allow('https://scribd.com.evil.com/', true), false);
});

test('requireAllowedMainFrame rejects off-allowlist final url', () => {
  requireAllowedMainFrame('https://www.scribd.com/embeds/123/content');
  assert.throws(() => requireAllowedMainFrame('https://accounts.google.com/signin'),
    (e: unknown) => e instanceof ToolError && e.code === 'PROVIDER_EXTRACTION_FAILED');
});

test('blocks internal-only pseudo TLDs', () => {
  for (const u of ['http://metadata.google.internal/computeMetadata/v1/', 'http://printer.local/',
    'http://nas.lan/', 'http://host.localdomain/', 'http://router.home.arpa/', 'http://wiki.corp/',
    'http://portal.intranet/', 'http://METADATA.GOOGLE.INTERNAL./']) {
    assert.equal(allow(u, false), false, u);
  }
  assert.equal(allow('https://internal.example.com/x', false), true);
});
