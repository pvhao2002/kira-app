import {ChangeDetectionStrategy, Component, model, signal} from '@angular/core';
import {DateRange, presetRange, RangePreset} from './date-range.util';

const PRESETS: {id: RangePreset; label: string}[] = [
  {id: 'today', label: 'Hôm nay'},
  {id: '7d', label: '7 ngày'},
  {id: '30d', label: '30 ngày'},
  {id: 'month', label: 'Tháng này'},
  {id: 'custom', label: 'Tùy chọn'}
];

/** Date filter in Vietnam time. `value` is always a complete, ordered {from, to}. */
@Component({
  selector: 'app-date-range',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {class: 'block min-w-0 max-w-full'},
  template: `
    <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Khoảng thời gian">
      <div class="seg max-w-full overflow-x-auto">
        @for (p of presets; track p.id) {
          <button type="button" [attr.aria-pressed]="preset() === p.id" (click)="pick(p.id)" [attr.data-testid]="'range-' + p.id">{{ p.label }}</button>
        }
      </div>
      @if (preset() === 'custom') {
        <div class="flex items-center gap-2">
          <label class="sr-only" [for]="id + '-from'">Từ ngày</label>
          <input class="input w-auto" type="date" [id]="id + '-from'" [value]="value().from" [max]="value().to" #from (change)="setFrom(from.value)" data-testid="range-from">
          <span class="muted" aria-hidden="true">–</span>
          <label class="sr-only" [for]="id + '-to'">Đến ngày</label>
          <input class="input w-auto" type="date" [id]="id + '-to'" [value]="value().to" [min]="value().from" #to (change)="setTo(to.value)" data-testid="range-to">
        </div>
      }
    </div>
  `
})
export class DateRangePicker {
  private static seq = 0;
  readonly value = model.required<DateRange>();
  readonly preset = signal<RangePreset>('30d');
  protected readonly presets = PRESETS;
  protected readonly id = `range-${DateRangePicker.seq++}`;

  protected pick(preset: RangePreset): void {
    this.preset.set(preset);
    if (preset !== 'custom') this.value.set(presetRange(preset));
  }

  // An emptied date input is ignored; an inverted range collapses to the edited day.
  protected setFrom(from: string): void {
    if (from) this.value.update(v => ({from, to: v.to < from ? from : v.to}));
  }

  protected setTo(to: string): void {
    if (to) this.value.update(v => ({from: v.from > to ? to : v.from, to}));
  }
}
