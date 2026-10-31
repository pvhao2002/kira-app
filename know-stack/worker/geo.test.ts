import { beforeEach, describe, expect, it } from 'vitest';
import { fetchGeo, isPublicIp, resetGeoRateLimit } from './geo';

const sample = {
  query: '24.48.0.1', status: 'success', country: 'Canada', countryCode: 'CA', region: 'QC',
  regionName: 'Quebec', city: 'Montreal', zip: 'H1K', lat: 45.6085, lon: -73.5493,
  timezone: 'America/Toronto', isp: 'Le Groupe Videotron Ltee', org: 'Videotron Ltee', as: 'AS5769 Videotron Ltee',
};

describe('isPublicIp', () => {
  it.each(['127.0.0.1', '::1', '10.0.0.1', '192.168.1.1', '172.16.0.1', '169.254.1.1', 'fd00::1', 'fe80::1', '', 'unknown'])(
    'treats %s as not public', (ip) => expect(isPublicIp(ip)).toBe(false),
  );
  it.each(['24.48.0.1', '8.8.8.8', '172.32.0.1', '2001:4860:4860::8888'])('treats %s as public', (ip) =>
    expect(isPublicIp(ip)).toBe(true),
  );
});

describe('fetchGeo', () => {
  beforeEach(() => resetGeoRateLimit());

  it('maps the ip-api response to a geo row', async () => {
    let calledUrl = '';
    const row = await fetchGeo('24.48.0.1', async (url) => {
      calledUrl = String(url);
      return Response.json(sample);
    });
    expect(calledUrl).toBe('http://ip-api.com/json/24.48.0.1');
    expect(row).toEqual({
      ip: '24.48.0.1', status: 'success', country: 'Canada', countryCode: 'CA', region: 'QC',
      regionName: 'Quebec', city: 'Montreal', zip: 'H1K', lat: 45.6085, lon: -73.5493,
      timezone: 'America/Toronto', isp: 'Le Groupe Videotron Ltee', org: 'Videotron Ltee', asName: 'AS5769 Videotron Ltee',
    });
  });

  it('keeps a fail status so reserved ranges get cached', async () => {
    const row = await fetchGeo('1.2.3.4', async () => Response.json({ status: 'fail', message: 'reserved range', query: '1.2.3.4' }));
    expect(row?.status).toBe('fail');
    expect(row?.country).toBeNull();
  });

  it('returns null when rate-limited', async () => {
    expect(await fetchGeo('1.2.3.4', async () => new Response('', { status: 429 }))).toBeNull();
  });

  it('returns null on network error', async () => {
    expect(await fetchGeo('1.2.3.4', async () => { throw new Error('offline'); })).toBeNull();
  });

  it('stops calling ip-api once X-Rl reaches 0, until X-Ttl passes', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return Response.json(sample, { headers: { 'X-Rl': '0', 'X-Ttl': '30' } });
    };
    expect((await fetchGeo('24.48.0.1', fetcher))?.city).toBe('Montreal');
    expect(await fetchGeo('8.8.8.8', fetcher)).toBeNull();
    expect(calls).toBe(1);
  });

  it('backs off after a 429', async () => {
    let calls = 0;
    const fetcher = async () => (calls++, new Response('', { status: 429 }));
    await fetchGeo('1.2.3.4', fetcher);
    await fetchGeo('1.2.3.5', fetcher);
    expect(calls).toBe(1);
  });
});
