import {ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, input, signal, viewChild} from '@angular/core';
import {LanguageService, SupportedLanguage} from '../../core/i18n/language.service';

@Component({
  selector: 'app-language-switcher',
  template: `
    <div class="language-switcher" [class.menu-variant]="variant() === 'menu'">
      <button #trigger
              (click)="open.set(!open())"
              [attr.aria-expanded]="open()"
              [attr.aria-label]="i18n.t('language.change')"
              aria-haspopup="listbox"
              class="language-trigger"
              [class.is-open]="open()"
              type="button">
        <svg class="globe-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
        <span class="lang-code">{{ i18n.language().toUpperCase() }}</span>
        <svg class="chevron-icon" [class.rotated]="open()" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      @if (open()) {
        <div [attr.aria-label]="i18n.t('language.change')" class="language-menu" role="listbox">
          @for (option of options; track option.value) {
            <button (click)="select(option.value)"
                    [attr.aria-selected]="i18n.language() === option.value"
                    class="menu-option"
                    [class.active]="i18n.language() === option.value"
                    role="option"
                    type="button">
              <span class="flag-badge">{{ option.code }}</span>
              <span class="label">{{ i18n.t(option.labelKey) }}</span>
              @if (i18n.language() === option.value) {
                <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              }
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-block;
      position: relative;
    }

    .language-switcher {
      position: relative;
    }

    .language-trigger {
      height: 38px;
      padding: 0 14px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      background: #ffffff;
      color: #334155;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .language-trigger:hover {
      border-color: #0878ff;
      color: #0878ff;
      background: #f8fafc;
      box-shadow: 0 4px 12px rgba(8, 120, 255, 0.12);
    }

    .language-trigger.is-open {
      border-color: #0878ff;
      color: #0878ff;
      box-shadow: 0 0 0 3px rgba(8, 120, 255, 0.15);
    }

    .language-switcher.menu-variant,
    .menu-variant .language-trigger {
      width: 100%;
    }

    .menu-variant .language-trigger {
      min-height: 44px;
      justify-content: flex-start;
      padding: 0 12px;
      border-radius: 10px;
      background: #f8fafc;
      box-shadow: none;
    }

    .menu-variant .chevron-icon {
      margin-left: auto;
    }

    .menu-variant .language-menu {
      position: relative;
      top: auto;
      right: auto;
      width: 100%;
      margin-top: 6px;
      box-sizing: border-box;
      box-shadow: none;
    }

    .menu-variant .menu-option {
      min-height: 44px;
    }

    :host-context(html[data-theme=dark]) .menu-variant .language-trigger,
    :host-context(html[data-theme=dark]) .menu-variant .language-menu {
      color: #dce7f2;
      background: #102942;
      border-color: #29425f;
    }

    :host-context(html[data-theme=dark]) .menu-variant .menu-option {
      color: #dce7f2;
    }

    :host-context(html[data-theme=dark]) .menu-variant .menu-option:hover {
      color: #f8fafc;
      background: #173653;
    }

    .globe-icon {
      color: #0878ff;
      flex-shrink: 0;
    }

    .lang-code {
      letter-spacing: 0.5px;
    }

    .chevron-icon {
      color: #94a3b8;
      transition: transform 0.2s ease, color 0.2s ease;
    }

    .chevron-icon.rotated {
      transform: rotate(180deg);
      color: #0878ff;
    }

    .language-menu {
      position: absolute;
      z-index: 100;
      top: calc(100% + 8px);
      right: 0;
      width: 190px;
      padding: 6px;
      border: 1px solid rgba(226, 232, 240, 0.9);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.04);
      animation: dropdownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes dropdownFadeIn {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .menu-option {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      border: none;
      border-radius: 10px;
      padding: 10px 12px;
      background: transparent;
      color: #334155;
      text-align: left;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .menu-option:hover {
      background: #f1f5f9;
      color: #0f172a;
    }

    .menu-option.active {
      background: rgba(8, 120, 255, 0.08);
      color: #0878ff;
      font-weight: 700;
    }

    .flag-badge {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 22px;
      border-radius: 6px;
      background: #e2e8f0;
      color: #0878ff;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      flex-shrink: 0;
    }

    .label {
      flex-grow: 1;
    }

    .check-icon {
      color: #0878ff;
      flex-shrink: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LanguageSwitcherComponent {
  readonly i18n = inject(LanguageService);
  readonly variant = input<'compact' | 'menu'>('compact');
  readonly open = signal(false);
  readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  readonly options = [
    {value: 'en' as const, code: 'EN', labelKey: 'language.english' as const},
    {value: 'vi' as const, code: 'VI', labelKey: 'language.vietnamese' as const}
  ];
  private readonly element = inject(ElementRef<HTMLElement>);

  select(language: SupportedLanguage): void {
    this.i18n.setLanguage(language);
    this.open.set(false);
    this.trigger()?.nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.open()) {
      this.open.set(false);
      this.trigger()?.nativeElement.focus();
    }
  }
}
