import {ChangeDetectionStrategy, Component, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {estimateTax, TAX_YEARS, TAXPAYER_CLASSES, TaxResult} from '../../content/tax-rules';
import {formatVnd} from '../../core/format/formatters';
import {vnDate} from '../../shared/date-range.util';
import {StateBox} from '../../shared/state-box';

/** Shell only: every figure comes from `estimateTax` in content/tax-rules.ts. No rate or threshold lives here. */
@Component({
  selector: 'app-tax-calculator',
  imports: [FormsModule, StateBox],
  templateUrl: './tax-calculator.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxCalculator {
  protected readonly classes = TAXPAYER_CLASSES;
  protected readonly years = TAX_YEARS;
  protected readonly formatVnd = formatVnd;
  protected readonly year = signal(TAX_YEARS.includes(Number(vnDate().slice(0, 4))) ? Number(vnDate().slice(0, 4)) : TAX_YEARS[TAX_YEARS.length - 1]);
  protected readonly taxpayerClass = signal('');
  protected readonly annualIncome = signal<number | null>(null);
  protected readonly dependents = signal(0);
  protected readonly result = signal<TaxResult | null>(null);
  protected readonly error = signal<unknown>(null);
  protected readonly inputError = signal('');

  protected calculate(): void {
    this.result.set(null);
    this.error.set(null);
    const income = this.annualIncome(), dependents = this.dependents(), year = Number(this.year());
    if (income == null || !(income >= 0) || !Number.isInteger(dependents) || dependents < 0 || !Number.isInteger(year)) {
      this.inputError.set('Vui lòng nhập năm, thu nhập cả năm (không âm) và số người phụ thuộc hợp lệ.');
      return;
    }
    if (!this.taxpayerClass()) {
      this.inputError.set('Vui lòng chọn đối tượng nộp thuế.');
      return;
    }
    this.inputError.set('');
    try {
      this.result.set(estimateTax({year, taxpayerClass: this.taxpayerClass(), annualIncome: income, dependents}));
    } catch (e) {
      this.error.set(e);
    }
  }
}
