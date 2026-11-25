import {Component, effect, inject} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {AuthStore} from './core/auth';
import {Live} from './core/live';
import {LoveWidget} from './shared/love-widget';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoveWidget],
  template: `
    <router-outlet/>
    @if (auth.user()) { <app-love-widget/> }
  `
})
export class App {
  protected auth = inject(AuthStore);

  constructor() {
    const live = inject(Live);
    effect(() => (this.auth.user() ? live.connect() : live.disconnect()));
  }
}
