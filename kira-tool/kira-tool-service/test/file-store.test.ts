import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {FileStore} from '../src/file-store.ts';
import {ToolError} from '../src/errors.ts';

function tempDir(t: {after: (fn: () => void) => void}): string {
  const dir = mkdtempSync(join(tmpdir(), 'tool-fs-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  return dir;
}

test('path is derived from uuid only', (t) => {
  const dir = tempDir(t);
  const store = new FileStore(dir, 1000);
  const id = randomUUID();
  assert.equal(store.pathFor(id), join(resolve(dir), `${id}.pdf`));
  assert.throws(() => store.pathFor('../../etc/passwd'));
});

test('write is atomic and readable', async (t) => {
  const dir = tempDir(t);
  const store = new FileStore(dir, 1000);
  const id = randomUUID();
  assert.equal(await store.write(id, new Uint8Array([1, 2, 3])), 3);
  assert.ok(store.find(id));
  assert.deepEqual([...readFileSync(store.find(id)!)], [1, 2, 3]);
  assert.deepEqual(readdirSync(dir), [`${id}.pdf`]);
});

test('oversize rejected and nothing written', async (t) => {
  const dir = tempDir(t);
  const store = new FileStore(dir, 2);
  const id = randomUUID();
  await assert.rejects(store.write(id, new Uint8Array(3)), (e: unknown) => e instanceof ToolError && e.code === 'FILE_TOO_LARGE');
  assert.equal(store.find(id), null);
  assert.deepEqual(readdirSync(dir), []);
});

test('delete removes file and is idempotent', async (t) => {
  const store = new FileStore(tempDir(t), 1000);
  const id = randomUUID();
  await store.write(id, new Uint8Array(1));
  store.delete(id);
  store.delete(id);
  assert.equal(store.find(id), null);
});

test('screenshots expire in memory without creating files or touching PDFs', async (t) => {
  const dir = tempDir(t);
  const store = new FileStore(dir, 1000);
  const id = randomUUID();
  const bytes = new Uint8Array([1]);
  await store.write(id, bytes);
  store.rememberScreenshot(id, bytes);
  assert.deepEqual(store.screenshot(id), Buffer.from(bytes));
  assert.deepEqual(readdirSync(dir), [`${id}.pdf`]);
  store.expireScreenshots(Date.now() + 16 * 60_000);
  assert.equal(store.screenshot(id), null);
  assert.ok(store.find(id));
});

test('io failure throws and leaves no tmp', async (t) => {
  const dir = tempDir(t);
  const blocker = join(dir, 'blocker');
  writeFileSync(blocker, '');
  const store = new FileStore(blocker, 1000); // root is a regular file: mkdir fails
  await assert.rejects(store.write(randomUUID(), new Uint8Array(1)), (e: unknown) => !(e instanceof ToolError));
  assert.deepEqual(readdirSync(dir), ['blocker']);
});

test('rewrite same id replaces content', async (t) => {
  const store = new FileStore(tempDir(t), 1000);
  const id = randomUUID();
  await store.write(id, new Uint8Array([1]));
  await store.write(id, new Uint8Array([2, 3]));
  assert.deepEqual([...readFileSync(store.find(id)!)], [2, 3]);
});

test('delete failure is swallowed', (t) => {
  const store = new FileStore(tempDir(t), 1000);
  const id = randomUUID();
  const occupied = store.pathFor(id); // non-empty dir: unlink throws
  mkdirSync(occupied, {recursive: true});
  writeFileSync(join(occupied, 'x'), '');
  assert.doesNotThrow(() => store.delete(id));
  assert.ok(existsSync(occupied));
});
