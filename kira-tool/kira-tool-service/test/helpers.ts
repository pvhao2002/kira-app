import {createHash} from 'node:crypto';
import {mkdtempSync, rmSync} from 'node:fs';
import type {AddressInfo} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/app.ts';
import {FileStore} from '../src/file-store.ts';
import {JobRepository, JobService, openDb} from '../src/jobs.ts';

/** App on port 0 with in-memory DB and a no-op queue: jobs stay QUEUED, no browser is ever started. */
export async function startApp(t: {after: (fn: () => unknown) => void}, cookieSecure = true) {
  const dir = mkdtempSync(join(tmpdir(), 'tool-http-'));
  const files = new FileStore(dir, 104_857_600);
  const repo = new JobRepository(openDb(':memory:'));
  const jobs = new JobService(repo, {enqueue: () => {}}, files, () => new Date(), 7);
  const app = createApp({jobs, files, cookieSecure, forwardHeaders: 'native'});
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(() => {
    server.closeAllConnections();
    server.close();
    rmSync(dir, {recursive: true, force: true});
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/tool-service`;
  return {base, port: (server.address() as AddressInfo).port, jobs, files, repo};
}

/** Test user name -> stable anonymous owner id (UUID v3, like Java's UUID.nameUUIDFromBytes). */
export function owner(user: string): string {
  const h = createHash('md5').update(user, 'utf8').digest();
  h[6] = (h[6] & 0x0f) | 0x30;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

function javaHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/** Each test user is its own browser (owner cookie) on its own client address (rate limits are per IP). */
export function as(user: string, opts: {csrf?: boolean; ip?: string} = {}): Record<string, string> {
  const h = javaHash(user);
  const headers: Record<string, string> = {
    cookie: `tool_owner=${owner(user)}` + (opts.csrf ? '; TOOL-XSRF-TOKEN=test-token' : ''),
    'x-forwarded-for': opts.ip ?? `10.1.${h & 0xff}.${(h >> 8) & 0xff}`,
  };
  if (opts.csrf) headers['x-tool-xsrf-token'] = 'test-token';
  return headers;
}

export const setCookies = (res: Response): string[] => res.headers.getSetCookie();
