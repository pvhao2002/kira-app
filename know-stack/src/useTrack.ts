import { useEffect } from 'react';
import { useLocation } from 'react-router';

let last: { path: string; at: number; visit: Promise<string | null> } = { path: '', at: 0, visit: Promise.resolve(null) };

/** Records one visit per route (geo is resolved server-side) and, on articles, time spent + scroll depth. Never throws. */
export function useTrack() {
  const { pathname } = useLocation();
  useEffect(() => {
    const articleSlug = /^\/articles\/([^/]+)/.exec(pathname)?.[1];
    const started = Date.now();
    let maxScroll = 0;
    let id: string | null = null;
    // StrictMode (dev) mounts effects twice: reuse the visit instead of logging the page twice.
    if (last.path !== pathname || Date.now() - last.at > 1000) {
      const visit = fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathname, articleSlug, referrer: document.referrer }),
      })
        .then((r) => r.json())
        .then((r: { id?: string }) => r.id ?? null)
        .catch(() => null);
      last = { path: pathname, at: Date.now(), visit };
    }
    last.visit.then((v) => (id = v));

    if (!articleSlug) return;
    const onScroll = () => {
      const el = document.documentElement;
      const pct = el.scrollHeight <= el.clientHeight ? 100 : ((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100;
      maxScroll = Math.max(maxScroll, Math.round(pct));
    };
    const end = () => {
      if (!id) return; // the server keeps the latest values, so repeats are fine
      const body = JSON.stringify({ seconds: Math.round((Date.now() - started) / 1000), scrollPct: maxScroll });
      navigator.sendBeacon(`/api/track/${id}/end`, new Blob([body], { type: 'application/json' }));
    };
    const onHide = () => document.visibilityState === 'hidden' && end();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', end);
    return () => {
      end();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', end);
    };
  }, [pathname]);
}
