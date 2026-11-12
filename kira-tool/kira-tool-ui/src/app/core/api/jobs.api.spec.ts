import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {JobsApi} from './jobs.api';

const BASE = '/tool-service/api/v1/jobs';

function setup() {
  TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
  return {api: TestBed.inject(JobsApi), http: TestBed.inject(HttpTestingController)};
}

describe('JobsApi', () => {
  it('submits POST /jobs with {url}', () => {
    const {api, http} = setup();
    api.submit('https://drive.google.com/file/d/x').subscribe();
    const req = http.expectOne({method: 'POST', url: BASE});
    expect(req.request.body).toEqual({url: 'https://drive.google.com/file/d/x'});
    req.flush({});
    http.verify();
  });

  it('surfaces the ProblemDetail code on a 429', () => {
    const {api, http} = setup();
    let code: string | undefined;
    api.submit('u').subscribe({error: e => (code = e.error?.code)});
    http.expectOne({method: 'POST', url: BASE}).flush({code: 'QUEUE_FULL'}, {status: 429, statusText: 'Too Many'});
    expect(code).toBe('QUEUE_FULL');
  });

  it('retries via POST /jobs/{id}/retry and removes via DELETE /jobs/{id}', () => {
    const {api, http} = setup();
    api.retry('j1').subscribe();
    api.remove('j2').subscribe();
    http.expectOne({method: 'POST', url: `${BASE}/j1/retry`}).flush({});
    http.expectOne({method: 'DELETE', url: `${BASE}/j2`}).flush(null);
    http.verify();
  });

  it('builds the file download URL', () => {
    expect(setup().api.fileUrl('j3')).toBe(`${BASE}/j3/file`);
  });
});
