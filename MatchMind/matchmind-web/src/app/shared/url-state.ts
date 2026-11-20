import { ActivatedRoute, ParamMap, Params, Router } from '@angular/router';

/** The values the URL carries for `keys`; a key that is absent stays absent (so page defaults still apply). */
export function fromQuery<K extends string>(q: ParamMap, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const k of keys) if (q.has(k)) out[k] = q.get(k) ?? '';
  return out;
}

/** Writes queued by `toQuery` in this tick, per router; one navigation carries them all. */
const queued = new WeakMap<Router, Record<string, string | null>>();

/**
 * Puts filter values in the query string so a filtered view can be refreshed, bookmarked and shared. `null` drops a
 * key and '' keeps it empty (a cleared default date range). Replaces the history entry, so Back skips filter tweaks,
 * and leaves other query keys alone. Does nothing when the URL already says the same. Calls in the same tick (the
 * filter bar and the table paging both write) are merged into one navigation: two navigations would each merge into
 * the old URL and the second would erase the first.
 */
export function toQuery(router: Router, route: ActivatedRoute, values: Record<string, string | null>): void {
  const pending = queued.get(router);
  if (pending) { Object.assign(pending, values); return; }
  const batch = { ...values };
  queued.set(router, batch);
  queueMicrotask(() => {
    queued.delete(router);
    const now = route.snapshot.queryParamMap;
    if (Object.entries(batch).every(([k, v]) => (v === null ? !now.has(k) : now.get(k) === v))) return;
    const queryParams: Params = batch;
    void router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  });
}
