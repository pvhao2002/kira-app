import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild
} from '@angular/core';
import {RouterLink} from '@angular/router';
import {LanguageService} from '../../core/i18n/language.service';
import {TranslationKey} from '../../core/i18n/translations';
import {IconComponent, IconName} from '../../shared/icon/icon';

interface Kpi {
  label: string;
  value: string;
  icon: IconName
}

type DateRange = 7 | 30 | 90;

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, IconComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPage {
  readonly i18n = inject(LanguageService);
  readonly dateRangeOpen = signal(false);
  readonly selectedDateRange = signal<DateRange>(30);
  readonly dateRangePicker = viewChild<ElementRef<HTMLElement>>('dateRangePicker');
  readonly dateRangeTrigger = viewChild<ElementRef<HTMLButtonElement>>('dateRangeTrigger');
  readonly dateRangeOptions: {days: DateRange; labelKey: TranslationKey}[] = [
    {days: 7, labelKey: 'dashboard.last7Days'},
    {days: 30, labelKey: 'dashboard.last30Days'},
    {days: 90, labelKey: 'dashboard.last90Days'}
  ];
  readonly credit = computed<Kpi[]>(() => [
    {label: this.i18n.t('field.creditLimit'), value: '60.000.000 ₫', icon: 'card'},
    {label: this.i18n.t('field.currentBalance'), value: '41.750.000 ₫', icon: 'wallet'},
    {label: this.i18n.t('field.statementBalance'), value: '18.250.000 ₫', icon: 'receipt'}
  ]);
  readonly dues = computed(() => [
    {bank: 'Vietcombank', card: '4821', date: this.i18n.t('dashboard.dueDate24'), amount: '8.450.000 ₫', color: '#087f5b'},
    {bank: 'Techcombank', card: '7290', date: this.i18n.t('dashboard.dueDate27'), amount: '6.800.000 ₫', color: '#dc2626'},
    {bank: 'VPBank', card: '3155', date: this.i18n.t('dashboard.dueDate29'), amount: '3.000.000 ₫', color: '#15803d'}
  ]);

  dateRangeLabel(): string {
    return this.i18n.t(this.dateRangeOptions.find(option => option.days === this.selectedDateRange())!.labelKey);
  }

  toggleDateRange(event: MouseEvent): void {
    event.stopPropagation();
    this.dateRangeOpen.update(open => !open);
  }

  selectDateRange(days: DateRange): void {
    this.selectedDateRange.set(days);
    this.dateRangeOpen.set(false);
    this.dateRangeTrigger()?.nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  closeDateRangeOnOutsideClick(event: MouseEvent): void {
    if (!this.dateRangePicker()?.nativeElement.contains(event.target as Node)) {
      this.dateRangeOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  closeDateRangeOnEscape(): void {
    if (this.dateRangeOpen()) {
      this.dateRangeOpen.set(false);
      this.dateRangeTrigger()?.nativeElement.focus();
    }
  }
}
