import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {Job} from '../../core/api/jobs.api';
import {JobsPage} from './jobs.page';

const LIST = '/tool-service/api/v1/jobs';

function job(over: Partial<Job> = {}): Job {
  return {
    id: 'j1', provider: 'DRIVE', status: 'QUEUED', stage: 'QUEUED', progress: 0, errorCode: null, attempts: 0,
    retryable: false, displayName: null, fileSize: null, createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z', finishedAt: null, expiresAt: null, ...over
  };
}

function setup() {
  TestBed.configureTestingModule({providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]});
  const fixture = TestBed.createComponent(JobsPage);
  fixture.detectChanges();
  return {fixture, http: TestBed.inject(HttpTestingController), el: fixture.nativeElement as HTMLElement};
}

describe('JobsPage', () => {
  it('shows the last accessed URL as a safe new-tab link on a failed job', () => {
    const {fixture, http, el} = setup();
    const currentUrl = 'https://www.scribd.com/document/12345?view=1';
    http.expectOne(LIST).flush([job({status: 'FAILED', currentUrl})]);
    fixture.detectChanges();
    const link = el.querySelector('.current-url a') as HTMLAnchorElement;
    expect(link?.textContent).toContain(currentUrl);
    expect(link?.href).toBe(currentUrl);
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noreferrer');
    http.verify();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const DRIVE_URL = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view';
  const GET = {method: 'GET', url: LIST};
  const POST = {method: 'POST', url: LIST};

  function button(el: HTMLElement, text: string): HTMLButtonElement {
    return Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === text) as HTMLButtonElement;
  }

  function typeAndSubmit(fixture: ReturnType<typeof setup>['fixture'], el: HTMLElement, value: string) {
    const input = el.querySelector('#url') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit', {cancelable: true}));
    fixture.detectChanges();
    return input;
  }

  it('submits the link, clears the input and refreshes the list', () => {
    const {fixture, http, el} = setup();
    http.expectOne(GET).flush([]);
    const input = typeAndSubmit(fixture, el, ` ${DRIVE_URL} `);
    const req = http.expectOne(POST);
    expect(req.request.body).toEqual({url: DRIVE_URL});
    req.flush(job());
    http.expectOne(GET).flush([job()]);
    fixture.detectChanges();
    expect(input.value).toBe('');
    expect(el.querySelector('[role="progressbar"]')).toBeTruthy();
  });

  it('maps a submit ProblemDetail code to the alert text', () => {
    const {fixture, http, el} = setup();
    http.expectOne(GET).flush([]);
    typeAndSubmit(fixture, el, DRIVE_URL);
    http.expectOne(POST).flush({status: 429, code: 'TOO_MANY_ACTIVE_JOBS'}, {status: 429, statusText: 'Too Many Requests'});
    fixture.detectChanges();
    expect(el.querySelector('form [role="alert"]')?.textContent).toContain('too many exports running');
    http.expectNone(GET);
  });

  it('shows the client-side error for an invalid link', () => {
    const {fixture, http, el} = setup();
    http.expectOne(GET).flush([]);
    typeAndSubmit(fixture, el, 'https://evil.com/x');
    expect(el.querySelector('form [role="alert"]')?.textContent).toContain('Only Google Drive and Scribd');
    http.expectNone(LIST);
  });

  it('loads a failed job screenshot when the user opens its preview', () => {
    const {fixture, http, el} = setup();
    http.expectOne(GET).flush([job({id: 'with-preview', status: 'FAILED', hasScreenshot: true}),
      job({id: 'without-preview', status: 'FAILED'})]);
    fixture.detectChanges();
    expect(el.querySelector('.failure-preview img')).toBeNull();
    expect(el.querySelectorAll('.failure-preview')).toHaveLength(1);
    button(el, 'Preview screenshot').click();
    fixture.detectChanges();
    expect(el.querySelector('.failure-preview img')?.getAttribute('src')).toBe(`${LIST}/with-preview/screenshot`);
  });

  it('labels Cancel for queued and Delete for finished jobs, and removes only after inline confirm', () => {
    const {fixture, http, el} = setup();
    http.expectOne(GET).flush([job({id: 'q', status: 'QUEUED'}), job({id: 'd', status: 'CANCELLED'})]);
    fixture.detectChanges();
    expect(button(el, 'Delete')).toBeTruthy();

    // First click only asks, inline (no blocking window.confirm).
    button(el, 'Cancel').click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Cancel this export?');
    http.expectNone({method: 'DELETE', url: `${LIST}/q`});

    // "Keep" backs out without a request.
    button(el, 'Keep').click();
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Cancel this export?');
    http.expectNone({method: 'DELETE', url: `${LIST}/q`});

    button(el, 'Cancel').click();
    fixture.detectChanges();
    button(el, 'Yes, cancel').click();
    http.expectOne({method: 'DELETE', url: `${LIST}/q`}).flush(null);
    http.expectOne(GET).flush([job({id: 'd', status: 'CANCELLED'})]);
  });

  it('closes the inline confirm with Escape', () => {
    const {fixture, http, el} = setup();
    http.expectOne(GET).flush([job({id: 'd', status: 'CANCELLED'})]);
    fixture.detectChanges();
    button(el, 'Delete').click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Delete this export and its file?');
    button(el, 'Yes, delete').dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Delete this export and its file?');
    http.expectNone({method: 'DELETE', url: `${LIST}/d`});
  });

  it('shows a visible confirmation after a successful submit', () => {
    const {fixture, http, el} = setup();
    http.expectOne(GET).flush([]);
    typeAndSubmit(fixture, el, DRIVE_URL);
    http.expectOne(POST).flush(job());
    http.expectOne(GET).flush([job()]);
    fixture.detectChanges();
    expect(el.querySelector('form [role="status"]')?.textContent).toContain('Export started');
  });

  it('shows when a job was added and when its file will be deleted', () => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(new Date('2026-01-08T00:00:00Z'));
    const {fixture, http, el} = setup();
    http.expectOne(GET).flush([job({
      status: 'SUCCEEDED', fileSize: 2_516_582, createdAt: '2026-01-07T23:57:00Z',
      finishedAt: '2026-01-07T23:58:00Z', expiresAt: '2026-01-14T00:00:00Z'
    })]);
    fixture.detectChanges();
    const meta = el.querySelector('.meta')?.textContent ?? '';
    expect(meta).toContain('3 minutes ago');
    expect(meta).toContain('2.4 MB');
    expect(meta).toContain('in 6 days');
  });

  it('shows a failed remove next to the list and re-syncs it', () => {
    const {fixture, http, el} = setup();
    http.expectOne(GET).flush([job({id: 'q', status: 'QUEUED'})]);
    fixture.detectChanges();
    button(el, 'Cancel').click();
    fixture.detectChanges();
    button(el, 'Yes, cancel').click();
    http.expectOne({method: 'DELETE', url: `${LIST}/q`}).flush({status: 409, code: 'JOB_RUNNING'}, {status: 409, statusText: 'Conflict'});
    http.expectOne(GET).flush([job({id: 'q', status: 'RUNNING'})]);
    fixture.detectChanges();
    expect(el.querySelector('form [role="alert"]')).toBeNull();
    expect(el.textContent).toContain('This export is running');
    expect(button(el, 'Cancel')).toBeUndefined();
  });

  it('retries a failed job via POST and refreshes', () => {
    const {fixture, http, el} = setup();
    http.expectOne(GET).flush([job({id: 'b', status: 'FAILED', errorCode: 'PROVIDER_TIMEOUT', retryable: true})]);
    fixture.detectChanges();
    button(el, 'Retry').click();
    http.expectOne({method: 'POST', url: `${LIST}/b/retry`}).flush(job({id: 'b'}));
    http.expectOne(GET).flush([job({id: 'b'})]);
  });

  it('pauses polling while the tab is hidden and resumes on visibilitychange', () => {
    vi.useFakeTimers();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const {fixture, http} = setup();
    http.expectOne(GET).flush([job({status: 'RUNNING'})]);
    fixture.detectChanges();
    vi.advanceTimersByTime(10000);
    http.expectNone(GET);

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    http.expectOne(GET);
  });

  it('cancels an in-flight poll when a newer refresh starts', () => {
    vi.useFakeTimers();
    const {fixture, http} = setup();
    http.expectOne(GET).flush([job({status: 'RUNNING'})]);
    vi.advanceTimersByTime(3000);
    const stale = http.expectOne(GET);
    fixture.componentInstance.refresh();
    expect(stale.cancelled).toBe(true);
    http.expectOne(GET).flush([job({status: 'RUNNING'})]);
  });

  it('keeps the loaded list when a background poll fails', () => {
    vi.useFakeTimers();
    const {fixture, http, el} = setup();
    http.expectOne(GET).flush([job({status: 'RUNNING', progress: 40})]);
    vi.advanceTimersByTime(3000);
    http.expectOne(GET).flush({}, {status: 500, statusText: 'err'});
    fixture.detectChanges();
    expect(el.querySelector('[role="progressbar"]')).toBeTruthy();
    expect(el.textContent).toContain('Could not refresh');
    expect(el.textContent).not.toContain('Could not load');
  });

  it('shows a loading state, then the empty state', () => {
    const {fixture, http, el} = setup();
    expect(el.textContent).toContain('Loading');
    http.expectOne(LIST).flush([]);
    fixture.detectChanges();
    expect(el.textContent).toContain('No exports yet');
  });

  it('shows an error state with retry when listing fails', () => {
    const {fixture, http, el} = setup();
    http.expectOne(LIST).flush({}, {status: 500, statusText: 'err'});
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Could not load');
  });

  it('renders progress bar semantics and mapped error text with a Retry button', () => {
    const {fixture, http, el} = setup();
    http.expectOne(LIST).flush([
      job({id: 'a', status: 'RUNNING', progress: 40, stage: 'SCROLLING'}),
      job({id: 'b', status: 'FAILED', errorCode: 'PROVIDER_EXTRACTION_FAILED', retryable: true, attempts: 1})
    ]);
    fixture.detectChanges();
    const bar = el.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect(el.textContent).toContain('Could not read the document.');
    expect(Array.from(el.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Retry')).toBe(true);
    expect(el.querySelector('[aria-live="polite"]')).toBeTruthy();
    http.verify();
  });

  it('offers Download for succeeded jobs', () => {
    const {fixture, http, el} = setup();
    http.expectOne(LIST).flush([job({id: 'ok', status: 'SUCCEEDED', progress: 100, displayName: 'My doc'})]);
    fixture.detectChanges();
    const link = el.querySelector('a[download]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/tool-service/api/v1/jobs/ok/file');
  });

  it('polls every 3s only while active jobs exist, then stops', () => {
    vi.useFakeTimers();
    const {fixture, http} = setup();
    http.expectOne(LIST).flush([job({status: 'RUNNING'})]);
    fixture.detectChanges();

    vi.advanceTimersByTime(3000);
    http.expectOne(LIST).flush([job({status: 'SUCCEEDED', progress: 100})]);
    fixture.detectChanges();

    vi.advanceTimersByTime(30000);
    http.expectNone(LIST);
  });

  it('stops polling when destroyed', () => {
    vi.useFakeTimers();
    const {fixture, http} = setup();
    http.expectOne(LIST).flush([job({status: 'RUNNING'})]);
    fixture.destroy();
    vi.advanceTimersByTime(10000);
    http.expectNone(LIST);
  });

  it('shows live hint for the detected provider and blocks invalid URLs client-side', () => {
    const {fixture, http, el} = setup();
    http.expectOne(LIST).flush([]);
    const input = el.querySelector('#url') as HTMLInputElement;
    input.value = 'https://www.scribd.com/document/123456789/x';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelector('#url-hint')?.textContent).toContain('Scribd');

    input.value = 'https://evil.com/x';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit', {cancelable: true}));
    http.expectNone(LIST);
  });
});
