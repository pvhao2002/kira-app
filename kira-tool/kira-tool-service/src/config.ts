/** Same TOOL_* variables and defaults as the Java application.yml. Invalid values fail startup. */
export interface Config {
  port: number;
  dataDir: string;
  storageDir: string;
  retentionDays: number;
  workers: number;
  queueSize: number;
  jobTimeoutMs: number;
  headless: boolean;
  maxFileBytes: number;
  cookieSecure: boolean;
  forwardHeaders: 'native' | 'none';
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env): Config {
  const fwd = (env.TOOL_FORWARD_HEADERS ?? 'native').toLowerCase();
  if (fwd !== 'native' && fwd !== 'none') throw new Error('TOOL_FORWARD_HEADERS must be native or none');
  return {
    port: int(env, 'TOOL_PORT', 1407),
    dataDir: env.TOOL_DATA_DIR || './data',
    storageDir: env.TOOL_STORAGE_DIR || './storage',
    retentionDays: int(env, 'TOOL_RETENTION_DAYS', 7),
    workers: int(env, 'TOOL_WORKERS', 2),
    queueSize: 20,
    jobTimeoutMs: parseDuration(env.TOOL_JOB_TIMEOUT ?? 'PT10M'),
    headless: bool(env, 'TOOL_HEADLESS', true),
    maxFileBytes: 104_857_600,
    cookieSecure: bool(env, 'TOOL_COOKIE_SECURE', true),
    forwardHeaders: fwd,
  };
}

function int(env: Env, name: string, def: number): number {
  const v = env[name];
  if (v === undefined || v === '') return def;
  if (!/^\d+$/.test(v.trim())) throw new Error(`${name} must be a non-negative integer`);
  return Number(v.trim());
}

/** Spring-style relaxed booleans: true/on/yes/1 and false/off/no/0, case-insensitive. */
function bool(env: Env, name: string, def: boolean): boolean {
  const v = env[name]?.trim().toLowerCase();
  if (v === undefined || v === '') return def;
  if (['true', 'on', 'yes', '1'].includes(v)) return true;
  if (['false', 'off', 'no', '0'].includes(v)) return false;
  throw new Error(`${name} must be true or false`);
}

/** ISO-8601 time durations only (PTnHnMnS, seconds may be fractional), e.g. PT10M. */
export function parseDuration(v: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(v.trim());
  if (!m || (!m[1] && !m[2] && !m[3])) throw new Error('TOOL_JOB_TIMEOUT must be an ISO-8601 duration like PT10M');
  return Math.round(((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000);
}
