import {ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal, viewChild} from '@angular/core';
import {LanguageService, SupportedLanguage} from '../../core/i18n/language.service';

@Component({
  selector: 'app-language-switcher',
  template: `
    <div class="language-switcher">
      <button #trigger
              (click)="open.set(!open())"
              [attr.aria-expanded]="open()"
              [attr.aria-label]="i18n.t('language.change')"
              aria-haspopup="listbox"
              class="language-trigger"
              type="button">
        {{ i18n.language().toUpperCase() }} <span aria-hidden="true">⌄</span>
      </button>
      @if (open()) {
        <div [attr.aria-label]="i18n.t('language.change')" class="language-menu" role="listbox">
          @for (option of options; track option.value) {
            <button (click)="select(option.value)"
                    [attr.aria-selected]="i18n.language() === option.value"
                    role="option"
                    type="button">
              <span>{{ option.code }}</span>{{ i18n.t(option.labelKey) }}
              @if (i18n.language() === option.value) {
                <b aria-hidden="true">✓</b>
              }
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
    }

    .language-trigger {
      min-width: 58px;
      height: 35px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--surface);
      color: inherit;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .4px;
      white-space: nowrap;
    }

    .language-menu {
      position: absolute;
      z-index: 50;
      top: calc(100% + 8px);
      right: 0;
      width: 180px;
      padding: 6px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }

    .language-menu button {
      width: 100%;
      display: grid;
      grid-template-columns: 28px 1fr auto;
      align-items: center;
      gap: 8px;
      border: 0;
      border-radius: 7px;
      padding: 9px 10px;
      background: transparent;
      color: inherit;
      text-align: left;
      font-size: 12px;
    }

    .language-menu button:hover,
    .language-menu button[aria-selected="true"] {
      background: color-mix(in srgb, var(--blue) 12%, var(--surface));
    }

    .language-menu span {
      color: var(--blue);
      font-weight: 800;
    }

    .language-menu b {
      color: var(--teal);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LanguageSwitcherComponent {
  readonly i18n = inject(LanguageService);
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
