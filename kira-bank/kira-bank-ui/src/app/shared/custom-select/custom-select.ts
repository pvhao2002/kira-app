import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  HostListener,
  inject,
  input,
  signal,
  computed
} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';

export interface SelectOption {
  value: any;
  label: string;
  iconUrl?: string;
  sublabel?: string;
}

@Component({
  selector: 'app-custom-select',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSelectComponent),
      multi: true
    }
  ],
  template: `
    <div class="custom-select-wrapper" [class.is-disabled]="isDisabled()">
      <!-- Trigger Button -->
      <button
        type="button"
        class="select-trigger"
        [class.is-open]="isOpen()"
        [disabled]="isDisabled()"
        (click)="toggleOpen()">
        <div class="selected-content">
          @if (selectedOption()?.iconUrl) {
            <img [src]="selectedOption()!.iconUrl" class="trigger-icon-img" alt="">
          }
          <span class="selected-text" [class.is-placeholder]="selectedValue() === null || selectedValue() === undefined">
            {{ selectedLabel() }}
          </span>
        </div>
        <svg class="chevron-icon" [class.rotated]="isOpen()" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      <!-- Dropdown Menu -->
      @if (isOpen()) {
        <div class="select-dropdown-menu" role="listbox">
          @if (options().length > 5) {
            <div class="search-box">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                type="text"
                [value]="searchQuery()"
                (input)="updateSearch($event)"
                placeholder="Search..."
                (click)="$event.stopPropagation()"
              />
            </div>
          }

          <div class="options-list">
            @for (opt of filteredOptions(); track opt.value) {
              <div
                class="option-item"
                [class.is-selected]="isSelected(opt.value)"
                (click)="selectOption(opt)">
                @if (opt.iconUrl) {
                  <img [src]="opt.iconUrl" class="option-icon-img" alt="">
                }
                <div class="option-label-group">
                  <span class="option-label">{{ opt.label }}</span>
                  @if (opt.sublabel) {
                    <small class="option-sublabel">{{ opt.sublabel }}</small>
                  }
                </div>
                @if (isSelected(opt.value)) {
                  <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                }
              </div>
            } @empty {
              <div class="no-options">No matching options</div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      position: relative;
    }

    .custom-select-wrapper {
      position: relative;
      width: 100%;

      &.is-disabled {
        opacity: 0.55;
        pointer-events: none;
      }
    }

    .select-trigger {
      width: 100%;
      height: 44px;
      padding: 0 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: var(--surface, #ffffff);
      border: 1.5px solid var(--border, #e2e8f0);
      border-radius: 12px;
      color: #0f172a;
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.02);

      &:hover:not(:disabled) {
        border-color: #0878ff;
        box-shadow: 0 4px 12px rgba(8, 120, 255, 0.1);
      }

      &.is-open {
        border-color: #0878ff;
        box-shadow: 0 0 0 3.5px rgba(8, 120, 255, 0.18);

        .chevron-icon {
          color: #0878ff;
        }
      }
    }

    .selected-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      &.is-placeholder {
        color: #94a3b8;
        font-weight: 400;
      }
    }

    .chevron-icon {
      color: #94a3b8;
      flex-shrink: 0;
      transition: transform 0.2s ease, color 0.2s ease;

      &.rotated {
        transform: rotate(180deg);
      }
    }

    /* Dropdown Menu */
    .select-dropdown-menu {
      position: absolute;
      z-index: 200;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1.5px solid rgba(226, 232, 240, 0.9);
      border-radius: 14px;
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.14), 0 4px 12px rgba(15, 23, 42, 0.04);
      padding: 6px;
      max-height: 260px;
      display: flex;
      flex-direction: column;
      animation: dropdownSlideIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes dropdownSlideIn {
      from {
        opacity: 0;
        transform: translateY(-6px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 6px;

      svg {
        color: #94a3b8;
        flex-shrink: 0;
      }

      input {
        width: 100%;
        border: none;
        background: transparent;
        outline: none;
        font-size: 12.5px;
        color: #0f172a;

        &::placeholder {
          color: #94a3b8;
        }
      }
    }

    .options-list {
      overflow-y: auto;
      max-height: 200px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .selected-content {
      display: flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
      overflow: hidden;
    }

    .trigger-icon-img {
      width: 26px;
      height: 17px;
      object-fit: contain;
      border-radius: 3px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      flex-shrink: 0;
    }

    .option-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 12px;
      border-radius: 9px;
      font-size: 13px;
      color: #334155;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;

      .option-icon-img {
        width: 28px;
        height: 18px;
        object-fit: contain;
        border-radius: 3px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        flex-shrink: 0;
      }

      .option-label-group {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
        flex: 1;

        .option-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .option-sublabel {
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
        }
      }

      &:hover {
        background: #f1f5f9;
        color: #0f172a;
      }

      &.is-selected {
        background: rgba(8, 120, 255, 0.09);
        color: #0878ff;
        font-weight: 700;

        .option-sublabel {
          color: #0878ff;
          opacity: 0.8;
        }
      }

      .check-icon {
        color: #0878ff;
        flex-shrink: 0;
      }
    }

    .no-options {
      padding: 14px;
      text-align: center;
      font-size: 12.5px;
      color: #94a3b8;
    }

    /* Dark mode support */
    :host-context(html[data-theme=dark]) {
      .select-trigger {
        background: #0d1e33;
        border-color: #2a4362;
        color: #f8fafc;

        &:hover:not(:disabled) {
          border-color: #38bdf8;
          box-shadow: 0 4px 12px rgba(56, 189, 248, 0.15);
        }

        &.is-open {
          border-color: #38bdf8;
          box-shadow: 0 0 0 3.5px rgba(56, 189, 248, 0.2);

          .chevron-icon {
            color: #38bdf8;
          }
        }
      }

      .selected-text.is-placeholder {
        color: #8da4be;
      }

      .select-dropdown-menu {
        background: rgba(13, 30, 51, 0.98);
        border-color: #2a4362;
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4);
      }

      .search-box {
        background: #0b1829;
        border-color: #2a4362;

        input {
          color: #f8fafc;

          &::placeholder {
            color: #8da4be;
          }
        }
      }

      .option-item {
        color: #cbd5e1;

        &:hover {
          background: #162f4e;
          color: #ffffff;
        }

        &.is-selected {
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
        }

        .check-icon {
          color: #38bdf8;
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomSelectComponent implements ControlValueAccessor {
  options = input<SelectOption[]>([]);
  placeholder = input<string>('Select an option');

  readonly isOpen = signal(false);
  readonly selectedValue = signal<any>(null);
  readonly isDisabled = signal(false);
  readonly searchQuery = signal('');

  private readonly element = inject(ElementRef<HTMLElement>);

  onChange: (val: any) => void = () => {};
  onTouched: () => void = () => {};

  readonly filteredOptions = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.options();
    return this.options().filter(o => o.label.toLowerCase().includes(q));
  });

  readonly selectedOption = computed(() => {
    const val = this.selectedValue();
    if (val === null || val === undefined) return null;
    return this.options().find(o => String(o.value) === String(val)) ?? null;
  });

  readonly selectedLabel = computed(() => {
    const opt = this.selectedOption();
    return opt ? opt.label : this.placeholder();
  });

  toggleOpen(): void {
    if (this.isDisabled()) return;
    this.isOpen.update(v => !v);
    if (!this.isOpen()) {
      this.searchQuery.set('');
      this.onTouched();
    }
  }

  selectOption(opt: SelectOption): void {
    this.selectedValue.set(opt.value);
    this.onChange(opt.value);
    this.onTouched();
    this.isOpen.set(false);
    this.searchQuery.set('');
  }

  isSelected(val: any): boolean {
    return this.selectedValue() === val;
  }

  updateSearch(e: Event): void {
    this.searchQuery.set((e.target as HTMLInputElement).value);
  }

  // ControlValueAccessor methods
  writeValue(val: any): void {
    this.selectedValue.set(val);
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) {
      if (this.isOpen()) {
        this.isOpen.set(false);
        this.searchQuery.set('');
        this.onTouched();
      }
    }
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.searchQuery.set('');
      this.onTouched();
    }
  }
}
