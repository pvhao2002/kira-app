import {ChangeDetectionStrategy, Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Not href="#main": under hash routing a fragment link would navigate to route /main. -->
    <button type="button" class="skip" (click)="mainEl.focus()">Skip to content</button>
    <header>
      <strong class="brand">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15H6z M14 2v6h6 M9 14h6 M9 18h4" /></svg>
        Kira Tool
      </strong>
      <span class="note">No sign-in needed. Your jobs are kept in this browser.</span>
    </header>
    <main #mainEl tabindex="-1"><router-outlet /></main>
  `,
  styles: `
    header { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 12px max(16px, calc((100% - 1200px) / 2 + 16px)); background: var(--surface); border-bottom: 1px solid var(--border); }
    .brand { flex: 1; font-weight: 800; letter-spacing: -0.01em; display: inline-flex; align-items: center; gap: 8px; }
    .brand svg { width: 22px; height: 22px; fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .note { color: var(--muted); font-size: 0.875rem; }
    main { max-width: 1200px; margin: 0 auto; padding: 24px 16px 48px; }
    .skip { position: absolute; left: -999px; }
    .skip:focus { left: 8px; top: 8px; background: var(--surface); padding: 8px; z-index: 1; }
  `
})
export class App {}
