import {ChangeDetectionStrategy, Component, input} from '@angular/core';

export type IconName =
  | 'account'
  | 'arrow-left'
  | 'bank'
  | 'bell'
  | 'card'
  | 'calendar'
  | 'check'
  | 'check-circle'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'clock'
  | 'close'
  | 'corner-down-left'
  | 'copy'
  | 'dashboard'
  | 'diamond'
  | 'loader'
  | 'alert-circle'
  | 'globe'
  | 'home'
  | 'info'
  | 'lock'
  | 'eye'
  | 'key'
  | 'menu'
  | 'monitor'
  | 'moon'
  | 'phone'
  | 'plus'
  | 'receipt'
  | 'settings'
  | 'shield-check'
  | 'star'
  | 'sun'
  | 'trend-up'
  | 'trash'
  | 'users'
  | 'wallet'
  | 'x-circle';

@Component({
  selector: 'app-icon',
  template: `
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24"
         xmlns="http://www.w3.org/2000/svg">
      @switch (name()) {
        @case ('account') {
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 21a8 8 0 0 1 16 0"/>
        }
        @case ('arrow-left') {
          <path d="m15 18-6-6 6-6"/>
        }
        @case ('bank') {
          <path d="m3 10 9-6 9 6"/>
          <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18M2 18h20"/>
        }
        @case ('bell') {
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
          <path d="M10 21h4"/>
        }
        @case ('card') {
          <rect x="3" y="5" width="18" height="14" rx="2"/>
          <path d="M3 10h18M7 15h3"/>
        }
        @case ('calendar') {
          <rect x="3" y="5" width="18" height="16" rx="2"/>
          <path d="M16 3v4M8 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2"/>
        }
        @case ('check') {
          <path d="m5 12 4 4L19 6"/>
        }
        @case ('check-circle') {
          <circle cx="12" cy="12" r="9"/>
          <path d="m8 12 3 3 5-6"/>
        }
        @case ('chevron-down') {
          <path d="m6 9 6 6 6-6"/>
        }
        @case ('chevron-left') {
          <path d="m15 18-6-6 6-6"/>
        }
        @case ('chevron-right') {
          <path d="m9 18 6-6-6-6"/>
        }
        @case ('clock') {
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 7v5l3 2"/>
        }
        @case ('close') {
          <path d="M6 6l12 12M18 6 6 18"/>
        }
        @case ('corner-down-left') {
          <path d="M9 10 4 15l5 5"/>
          <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
        }
        @case ('copy') {
          <rect x="9" y="9" width="11" height="11" rx="2"/>
          <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>
        }
        @case ('dashboard') {
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        }
        @case ('diamond') {
          <path d="m12 3 8 6-8 12L4 9l8-6Z"/>
          <path d="m4 9 8 3 8-3M12 12v9"/>
        }
        @case ('loader') {
          <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
        }
        @case ('alert-circle') {
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 7v6M12 17h.01"/>
        }
        @case ('globe') {
          <circle cx="12" cy="12" r="9"/>
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>
        }
        @case ('home') {
          <path d="m3 11 9-8 9 8"/>
          <path d="M5 10v10h14V10M9 20v-6h6v6"/>
        }
        @case ('info') {
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 11v5M12 8h.01"/>
        }
        @case ('eye') {
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/>
          <circle cx="12" cy="12" r="2.5"/>
        }
        @case ('key') {
          <circle cx="8" cy="15" r="4"/>
          <path d="m11 12 8-8M16 7l3 3M14 9l2 2"/>
        }
        @case ('lock') {
          <rect x="4" y="10" width="16" height="11" rx="2"/>
          <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>
        }
        @case ('menu') {
          <path d="M4 7h16M4 12h16M4 17h16"/>
        }
        @case ('monitor') {
          <rect x="3" y="4" width="18" height="13" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
        }
        @case ('moon') {
          <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/>
        }
        @case ('phone') {
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c1 .3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>
        }
        @case ('plus') {
          <path d="M12 5v14M5 12h14"/>
        }
        @case ('receipt') {
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/>
          <path d="M9 8h6M9 12h6M9 16h3"/>
        }
        @case ('settings') {
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>
        }
        @case ('shield-check') {
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
          <path d="m9 12 2 2 4-4"/>
        }
        @case ('star') {
          <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>
        }
        @case ('sun') {
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
        }
        @case ('trend-up') {
          <path d="m3 17 6-6 4 4 8-8"/>
          <path d="M15 7h6v6"/>
        }
        @case ('trash') {
          <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>
        }
        @case ('users') {
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>
        }
        @case ('wallet') {
          <path d="M4 5h14a2 2 0 0 1 2 2v12H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/>
          <path d="M16 11h6v4h-6a2 2 0 0 1 0-4Z"/>
        }
        @case ('x-circle') {
          <circle cx="12" cy="12" r="9"/>
          <path d="m9 9 6 6M15 9l-6 6"/>
        }
      }
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      flex: 0 0 auto;
      width: 1em;
      height: 1em;
      line-height: 1;
      vertical-align: -0.125em;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IconComponent {
  readonly name = input.required<IconName>();
}
