import { Subject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { Page } from '../core/models';
import { PagedList } from './paged-list';

const page = (data: number[], total = data.length): Page<number> => ({ data, meta: { page: 0, size: 25, totalElements: total, totalPages: 1 } });

/** Runs pending resource effects and lets delivered values reach the signals. */
const settle = async () => { TestBed.tick(); await new Promise(r => setTimeout(r)); TestBed.tick(); };

/** The list reads and writes its page, size and sort in the query string; a stub route and router stand in for that. */
function setup(query: Record<string, string> = {}, navigate = vi.fn().mockResolvedValue(true)) {
  TestBed.configureTestingModule({ providers: [
    { provide: Router, useValue: { navigate } },
    { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } }] });
  const calls: { args: { page?: number; size?: number; sort?: string }; out: Subject<Page<number>> }[] = [];
  const list = TestBed.runInInjectionContext(() => new PagedList<number>(args => {
    const out = new Subject<Page<number>>();
    calls.push({ args, out });
    return out;
  }, { field: 'id', dir: 'desc' }));
  return { list, calls, navigate };
}

describe('PagedList', () => {
  it('fetches nothing until the page loads it, then once for a reload', async () => {
    const { list, calls } = setup();
    await settle();
    expect(calls).toHaveLength(0);
    list.reload();
    await settle();
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual({ page: 0, size: 25, sort: 'id,desc' });
    expect(list.loading()).toBe(true);
    calls[0].out.next(page([1, 2], 40));
    await settle();
    expect(list.rows()).toEqual([1, 2]);
    expect(list.total()).toBe(40);
    expect(list.loading()).toBe(false);
  });

  it('keeps the previous rows while the next page loads, and ignores a superseded response', async () => {
    const { list, calls } = setup();
    list.reload();
    await settle();
    calls[0].out.next(page([1, 2]));
    await settle();
    list.setPage({ page: 1, size: 25 });
    await settle();
    expect(list.rows()).toEqual([1, 2]);
    expect(list.loading()).toBe(true);
    list.setPage({ page: 2, size: 25 });
    await settle();
    expect(calls).toHaveLength(3);
    expect(calls[1].out.observed).toBe(false); // the page-1 request was cancelled
    calls[1].out.next(page([99])); // late answer is dropped
    calls[2].out.next(page([5]));
    await settle();
    expect(list.rows()).toEqual([5]);
  });

  it('clears the rows and shows the API message when the request fails', async () => {
    const { list, calls } = setup();
    list.reload();
    await settle();
    calls[0].out.next(page([1]));
    await settle();
    list.load();
    await settle();
    calls[1].out.error(new HttpErrorResponse({ status: 400, error: { code: 'BAD', message: 'bad range' } }));
    await settle();
    expect(list.rows()).toEqual([]);
    expect(list.total()).toBe(0);
    expect(list.error()).toBe('bad range');
  });

  it('restores page, size and sort from the URL and writes them back, omitting defaults', async () => {
    const navigate = vi.fn().mockResolvedValue(true);
    const { list, calls } = setup({ page: '3', size: '50', sort: 'league,asc' }, navigate);
    expect([list.page(), list.size(), list.sort()]).toEqual([2, 50, { field: 'league', dir: 'asc' }]);
    list.load();
    await settle();
    expect(calls[0].args).toEqual({ page: 2, size: 50, sort: 'league,asc' });
    list.setSort({ field: 'id', dir: 'desc' }); // back to the default sort and the first page
    list.setPage({ page: 0, size: 25 });
    await settle();
    expect(navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { page: null, size: null, sort: null } }));
  });

  it('ignores a malformed page, size or sort in the URL', () => {
    const { list } = setup({ page: 'x', size: '9999', sort: 'a;drop,asc' });
    expect([list.page(), list.size(), list.sort()]).toEqual([0, 25, { field: 'id', dir: 'desc' }]);
  });
});
