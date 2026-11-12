import {TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {App} from './app';
import {routes} from './app.routes';

describe('App', () => {
  function setup() {
    TestBed.configureTestingModule({providers: [provideRouter([])]});
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return {navigate, el: fixture.nativeElement as HTMLElement};
  }

  it('is public: no sign-in UI, no login route, no guard', () => {
    const {el} = setup();
    expect(el.textContent).not.toMatch(/sign (in|out)/i);
    expect(el.querySelector('.note')?.textContent).toContain('No sign-in needed');
    expect(routes.some(r => r.path === 'login')).toBe(false);
    expect(routes.every(r => !r.canActivate)).toBe(true);
  });

  it('skip link focuses <main> without changing the route', () => {
    const {el, navigate} = setup();
    (el.querySelector('.skip') as HTMLButtonElement).click();
    expect(document.activeElement).toBe(el.querySelector('main'));
    expect(navigate).not.toHaveBeenCalled();
  });
});
