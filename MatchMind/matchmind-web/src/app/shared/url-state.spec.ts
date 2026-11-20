import { convertToParamMap } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { fromQuery, toQuery } from './url-state';

/** `toQuery` navigates in a microtask so same-tick writes can merge. */
const flush = () => Promise.resolve();

describe('url-state', () => {
  it('reads only the keys that are in the URL', () => {
    const q = convertToParamMap({ league: 'EPL', from: '', other: 'x' });
    expect(fromQuery(q, ['league', 'from', 'to'] as const)).toEqual({ league: 'EPL', from: '' });
  });

  it('writes changed filters by merging into the query and replacing the history entry', async () => {
    const navigate = vi.fn().mockResolvedValue(true);
    const route = { snapshot: { queryParamMap: convertToParamMap({ league: 'EPL' }) } };
    toQuery({ navigate } as never, route as never, { league: null, search: 'arsenal' });
    await flush();
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { league: null, search: 'arsenal' }, queryParamsHandling: 'merge', replaceUrl: true,
    }));
  });

  it('does not navigate when the URL already matches', async () => {
    const navigate = vi.fn();
    const route = { snapshot: { queryParamMap: convertToParamMap({ league: 'EPL', from: '' }) } };
    toQuery({ navigate } as never, route as never, { league: 'EPL', search: null, from: '' });
    await flush();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('merges writes from the same tick into one navigation', async () => {
    const navigate = vi.fn().mockResolvedValue(true);
    const router = { navigate } as never;
    const route = { snapshot: { queryParamMap: convertToParamMap({ page: '3' }) } } as never;
    toQuery(router, route, { page: null });
    toQuery(router, route, { league: 'EPL' });
    await flush();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { page: null, league: 'EPL' } }));
  });
});
