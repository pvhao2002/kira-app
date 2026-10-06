/** Public IP as seen by ipify; null on any failure. Plain fetch on purpose: no interceptors, no credentials. */
export async function fetchPublicIp(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      credentials: 'omit',
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) return null;
    const {ip} = await res.json() as { ip?: unknown };
    return typeof ip === 'string' ? ip : null;
  } catch {
    return null;
  }
}
