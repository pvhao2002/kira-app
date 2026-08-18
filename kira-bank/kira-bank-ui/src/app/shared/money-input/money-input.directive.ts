import {Directive, effect, ElementRef, forwardRef, inject, input, output} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {LanguageService} from '../../core/i18n/language.service';

interface ParsedMoney {
  display: string;
  value: number | null;
  decimalEntered: boolean;
}

@Directive({
  selector: 'input[appMoneyInput]',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => MoneyInputDirective),
    multi: true
  }],
  host: {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    '(input)': 'handleInput($event)',
    '(blur)': 'handleBlur()'
  }
})
export class MoneyInputDirective implements ControlValueAccessor {
  readonly moneyFractionDigits = input(4);
  readonly moneyValue = input<number | null | undefined>(undefined);
  readonly moneyValueChange = output<number | null>();

  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly i18n = inject(LanguageService);
  private value: number | null = null;
  private renderedLanguage: string | null = null;
  private onChange: (value: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    effect(() => {
      const language = this.i18n.language();
      const externalValue = this.moneyValue();
      const nextValue = externalValue === undefined ? this.value : this.toFiniteNumber(externalValue);
      const languageChanged = language !== this.renderedLanguage;
      const valueChanged = nextValue !== this.value;
      this.renderedLanguage = language;
      this.value = nextValue;
      if (languageChanged || valueChanged) {
        this.renderValue();
      }
    });
  }

  writeValue(value: number | string | null | undefined): void {
    this.value = this.toFiniteNumber(value);
    this.renderValue();
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.element.disabled = disabled;
  }

  handleInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const rawValue = inputElement.value;
    const cursor = inputElement.selectionStart ?? rawValue.length;
    const rawBeforeCursor = rawValue.slice(0, cursor);
    const digitsBeforeCursor = rawBeforeCursor.replace(/\D/g, '').length;
    const separators = this.separators();
    const cursorAfterDecimal = rawBeforeCursor.includes(separators.decimal);
    const parsed = this.parse(rawValue, separators.group, separators.decimal);

    this.value = parsed.value;
    inputElement.value = parsed.display;
    this.onChange(parsed.value);
    this.moneyValueChange.emit(parsed.value);
    this.restoreCursor(inputElement, digitsBeforeCursor, cursorAfterDecimal && parsed.decimalEntered, separators.decimal);
  }

  handleBlur(): void {
    this.onTouched();
    this.renderValue();
  }

  private parse(rawValue: string, groupSeparator: string, decimalSeparator: string): ParsedMoney {
    const withoutSpaces = rawValue.replace(/[\s\u00a0\u202f]/g, '');
    const withoutGroups = withoutSpaces.split(groupSeparator).join('');
    const decimalIndex = withoutGroups.indexOf(decimalSeparator);
    const integerSource = decimalIndex >= 0 ? withoutGroups.slice(0, decimalIndex) : withoutGroups;
    const fractionSource = decimalIndex >= 0 ? withoutGroups.slice(decimalIndex + decimalSeparator.length) : '';
    const integerDigits = integerSource.replace(/\D/g, '');
    const fractionDigits = fractionSource.replace(/\D/g, '').slice(0, this.moneyFractionDigits());
    const decimalEntered = decimalIndex >= 0;

    if (!integerDigits && !fractionDigits) {
      return {
        display: decimalEntered ? `0${decimalSeparator}` : '',
        value: decimalEntered ? 0 : null,
        decimalEntered
      };
    }

    const normalizedInteger = integerDigits.replace(/^0+(?=\d)/, '') || '0';
    const normalized = `${normalizedInteger}${decimalEntered ? `.${fractionDigits}` : ''}`;
    const value = Number(normalized);
    const display = `${this.groupInteger(normalizedInteger, groupSeparator)}`
      + `${decimalEntered ? decimalSeparator + fractionDigits : ''}`;
    return {display, value: Number.isFinite(value) ? value : null, decimalEntered};
  }

  private renderValue(): void {
    if (this.value === null) {
      this.element.value = '';
      return;
    }

    const locale = this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US';
    this.element.value = new Intl.NumberFormat(locale, {
      maximumFractionDigits: this.moneyFractionDigits(),
      useGrouping: true
    }).format(this.value);
  }

  private separators(): {group: string; decimal: string} {
    const locale = this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US';
    const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
    return {
      group: parts.find(part => part.type === 'group')?.value ?? ',',
      decimal: parts.find(part => part.type === 'decimal')?.value ?? '.'
    };
  }

  private groupInteger(value: string, groupSeparator: string): string {
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
  }

  private restoreCursor(
    inputElement: HTMLInputElement,
    digitsBeforeCursor: number,
    cursorAfterDecimal: boolean,
    decimalSeparator: string
  ): void {
    queueMicrotask(() => {
      let digitsSeen = 0;
      let position = 0;
      while (position < inputElement.value.length && digitsSeen < digitsBeforeCursor) {
        if (/\d/.test(inputElement.value[position])) digitsSeen++;
        position++;
      }
      if (cursorAfterDecimal) {
        const decimalIndex = inputElement.value.indexOf(decimalSeparator);
        position = Math.max(position, decimalIndex >= 0 ? decimalIndex + decimalSeparator.length : position);
      }
      inputElement.setSelectionRange(position, position);
    });
  }

  private toFiniteNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
