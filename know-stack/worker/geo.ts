import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './db/schema';

const REFRESH_SEC = 30 * 24 * 3600;

/** False for loopback, private, link-local and unparseable addresses: ip-api can't geolocate them. */
export function isPublicIp(ip: string): boolean {
  if (ip.includes(':')) {
    const v6 = ip.toLowerCase();
    return !(v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80'));
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return !(a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
}

type IpApiResponse = {
  status: string; country?: string; countryCode?: string; region?: string; regionName?: string; city?: string;
  zip?: string; lat?: number; lon?: number; timezone?: string; isp?: string; org?: string; as?: string;
};

// shortcut: per-isolate memory, so separate isolates each learn the limit on their own; move to KV if 429s persist.
let pausedUntil = 0;
export const resetGeoRateLimit = () => {
  pausedUntil = 0;
};

/** null = transient failure (rate limit / network), so the caller doesn't cache it. */
export async function fetchGeo(ip: string, fetcher: typeof fetch = fetch): Promise<schema.GeoRow | null> {
  if (Date.now() < pausedUntil) return null;
  try {
    // Free tier of ip-api is HTTP only (HTTPS needs a paid key) and allows 45 req/min;
    // calling while limited extends the ban, so honour X-Rl (requests left) / X-Ttl (seconds to reset).
    const res = await fetcher(`http://ip-api.com/json/${encodeURIComponent(ip)}`);
    const ttl = Number(res.headers.get('X-Ttl')) || 60;
    if (res.status === 429 || res.headers.get('X-Rl') === '0') pausedUntil = Date.now() + ttl * 1000;
    if (!res.ok) return null;
    const g = (await res.json()) as IpApiResponse;
    return {
      ip, status: g.status, country: g.country ?? null, countryCode: g.countryCode ?? null, region: g.region ?? null,
      regionName: g.regionName ?? null, city: g.city ?? null, zip: g.zip ?? null, lat: g.lat ?? null, lon: g.lon ?? null,
      timezone: g.timezone ?? null, isp: g.isp ?? null, org: g.org ?? null, asName: g.as ?? null,
    };
  } catch {
    return null;
  }
}

/** Looks the IP up once and caches it; refreshed after 30 days. Never throws. */
export async function ensureGeo(db: DrizzleD1Database<typeof schema>, ip: string): Promise<void> {
  if (!isPublicIp(ip)) return;
  try {
    const [cached] = await db.select({ fetchedAt: schema.ipGeo.fetchedAt }).from(schema.ipGeo).where(eq(schema.ipGeo.ip, ip)).limit(1);
    if (cached && Date.now() / 1000 - cached.fetchedAt < REFRESH_SEC) return;
    const row = await fetchGeo(ip);
    if (!row) return;
    const fetchedAt = Math.floor(Date.now() / 1000);
    await db.insert(schema.ipGeo).values({ ...row, fetchedAt }).onConflictDoUpdate({ target: schema.ipGeo.ip, set: { ...row, fetchedAt } });
  } catch (e) {
    console.warn('geo lookup failed', (e as Error).message);
  }
}
