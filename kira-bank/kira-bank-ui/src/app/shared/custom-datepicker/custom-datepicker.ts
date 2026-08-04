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
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../core/i18n/language.service';

export type DatepickerMode = 'date' | 'datetime';

export interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  dateString: string;
}

@Component({
  selector: 'app-custom-datepicker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomDatepickerComponent),
      multi: true
    }
  ],
  template: `
    <div class="custom-datepicker-container" [class.is-disabled]="isDisabled()">
      <!-- Trigger Input Control -->
      <div 
        class="datepicker-trigger" 
        [class.is-open]="isOpen()" 
        [class.has-value]="!!selectedDate()"
        [class.disabled]="isDisabled()"
        (click)="toggleOpen($event)">
        
        <div class="trigger-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="4" ry="4"/>
            <line x1="16" x2="16" y1="2" y2="6"/>
            <line x1="8" x2="8" y1="2" y2="6"/>
            <line x1="3" x2="21" y1="10" y2="10"/>
            <path d="M8 14h.01"/>
            <path d="M12 14h.01"/>
            <path d="M16 14h.01"/>
            <path d="M8 18h.01"/>
            <path d="M12 18h.01"/>
            <path d="M16 18h.01"/>
          </svg>
        </div>

        <span class="trigger-text" [class.placeholder]="!selectedDate()">
          {{ displayLabel() }}
        </span>

        @if (selectedDate() && !isDisabled()) {
          <button 
            type="button" 
            class="btn-clear" 
            (click)="clearValue($event)"
            [title]="i18n.t('datepicker.clear')">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        }

        <div class="trigger-arrow">
          <svg class="chevron" [class.rotated]="isOpen()" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </div>

      <!-- Popover / Dialog Popup -->
      @if (isOpen()) {
        <div class="datepicker-dialog-backdrop" (click)="close($event)" (mousedown)="$event.stopPropagation()" (pointerdown)="$event.stopPropagation()"></div>
        <div class="datepicker-dialog" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()" (pointerdown)="$event.stopPropagation()">
          <!-- Friendly Header Banner -->
          <div class="dialog-header">
            <div class="header-info">
              <span class="header-eyebrow">{{ mode() === 'datetime' ? i18n.t('datepicker.selectDateTime') : i18n.t('datepicker.selectDate') }}</span>
              <h4 class="header-title">{{ formattedHeaderDate() }}</h4>
            </div>
            <button type="button" class="header-close-btn" (click)="close($event)">×</button>
          </div>

          <!-- Quick Shortcut Pills -->
          <div class="quick-shortcuts">
            <button type="button" class="shortcut-pill" (click)="selectToday()">{{ i18n.t('datepicker.today') }}</button>
            <button type="button" class="shortcut-pill" (click)="selectShortcut(1)">{{ i18n.t('datepicker.plus1Day') }}</button>
            <button type="button" class="shortcut-pill" (click)="selectShortcut(7)">{{ i18n.t('datepicker.plus7Days') }}</button>
            <button type="button" class="shortcut-pill" (click)="selectShortcut(30)">{{ i18n.t('datepicker.plus30Days') }}</button>
            <button type="button" class="shortcut-pill" (click)="selectEndOfMonth()">{{ i18n.t('datepicker.endOfMonth') }}</button>
          </div>

          <!-- Month & Year Navigation Bar -->
          <div class="calendar-nav">
            <button type="button" class="nav-btn" (click)="prevMonth()" [title]="i18n.t('datepicker.prevMonth')">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>

            <div class="month-year-selectors">
              <select [ngModel]="currentMonth()" (ngModelChange)="onMonthChange($event)" class="select-month">
                @for (m of monthsList(); track $index) {
                  <option [value]="$index">{{ m }}</option>
                }
              </select>

              <select [ngModel]="currentYear()" (ngModelChange)="onYearChange($event)" class="select-year">
                @for (y of yearsList(); track y) {
                  <option [value]="y">{{ y }}</option>
                }
              </select>
            </div>

            <button type="button" class="nav-btn" (click)="nextMonth()" [title]="i18n.t('datepicker.nextMonth')">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          <!-- Weekday Headers -->
          <div class="weekdays-grid">
            @for (w of weekdaysGrid(); track w.label) {
              <span class="weekday" [class.sunday]="w.sun">{{ w.label }}</span>
            }
          </div>

          <!-- Calendar Days Grid -->
          <div class="days-grid">
            @for (day of calendarDays(); track day.dateString) {
              <button 
                type="button" 
                class="day-cell"
                [class.other-month]="!day.isCurrentMonth"
                [class.today]="day.isToday"
                [class.selected]="day.isSelected"
                [class.disabled]="day.isDisabled"
                [disabled]="day.isDisabled"
                (click)="selectDay(day)">
                <span class="day-number">{{ day.dayNumber }}</span>
                @if (day.isToday && !day.isSelected) {
                  <span class="today-dot"></span>
                }
              </button>
            }
          </div>

          <!-- Time Selector (For Datetime Mode) -->
          @if (mode() === 'datetime') {
            <div class="time-picker-section">
              <div class="time-picker-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 16 14"/></svg>
                <span>{{ i18n.t('datepicker.timeTitle') }}</span>
              </div>
              <div class="time-inputs-wrapper">
                <select [ngModel]="hours()" (ngModelChange)="onHoursChange($event)" class="time-select">
                  @for (h of hoursArray; track h) {
                    <option [value]="h">{{ pad2(h) }}</option>
                  }
                </select>
                <span class="time-colon">:</span>
                <select [ngModel]="minutes()" (ngModelChange)="onMinutesChange($event)" class="time-select">
                  @for (m of minutesArray; track m) {
                    <option [value]="m">{{ pad2(m) }}</option>
                  }
                </select>

                <div class="time-presets">
                  <button type="button" class="preset-btn" (click)="setPresetTime(8, 0)">08:00</button>
                  <button type="button" class="preset-btn" (click)="setPresetTime(12, 0)">12:00</button>
                  <button type="button" class="preset-btn" (click)="setPresetTime(14, 30)">14:30</button>
                  <button type="button" class="preset-btn" (click)="setPresetTime(18, 0)">18:00</button>
                </div>
              </div>
            </div>
          }

          <!-- Footer Action Buttons -->
          <div class="dialog-footer">
            <button type="button" class="btn-footer secondary" (click)="clearAndClose()">{{ i18n.t('datepicker.clear') }}</button>
            <button type="button" class="btn-footer primary" (click)="confirmSelection()">{{ i18n.t('datepicker.apply') }}</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      width: 100%;
      font-family: inherit;
    }

    .custom-datepicker-container {
      position: relative;
      width: 100%;
    }

    /* Trigger Input */
    .datepicker-trigger {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 44px;
      padding: 0 14px;
      border-radius: 12px;
      border: 1.5px solid var(--border, #cbd5e1);
      background-color: var(--surface, #ffffff);
      color: #0f172a;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .datepicker-trigger:hover:not(.disabled) {
      border-color: #0878ff;
      box-shadow: 0 3px 12px rgba(8, 120, 255, 0.08);
    }

    .datepicker-trigger.is-open {
      border-color: #0878ff;
      box-shadow: 0 0 0 3.5px rgba(8, 120, 255, 0.18);
    }

    .datepicker-trigger.disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background-color: #f1f5f9;
    }

    .trigger-icon {
      display: flex;
      align-items: center;
      color: #0878ff;
      flex-shrink: 0;
    }

    .trigger-text {
      flex: 1;
      font-size: 13.5px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .trigger-text.placeholder {
      color: #94a3b8;
      font-weight: 400;
    }

    .btn-clear {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: none;
      background: #f1f5f9;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 0;
      flex-shrink: 0;
    }

    .btn-clear:hover {
      background: #e2e8f0;
      color: #ef4444;
      transform: scale(1.1);
    }

    .trigger-arrow {
      display: flex;
      align-items: center;
      color: #94a3b8;
      flex-shrink: 0;
    }

    .chevron {
      transition: transform 0.2s ease;
    }

    .chevron.rotated {
      transform: rotate(180deg);
    }

    /* Backdrop & Dialog Modal */
    .datepicker-dialog-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 999;
      background: rgba(15, 23, 42, 0.25);
      backdrop-filter: blur(2px);
      animation: fadeIn 0.15s ease-out;
    }

    .datepicker-dialog {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      z-index: 1000;
      width: 320px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.06);
      padding: 16px;
      animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Header Banner */
    .dialog-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 12px 14px;
      margin: -16px -16px 14px -16px;
      background: linear-gradient(135deg, #0878ff 0%, #0052cc 100%);
      color: #ffffff;
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
    }

    .header-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .header-eyebrow {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.85;
      font-weight: 600;
    }

    .header-title {
      margin: 0;
      font-size: 14.5px;
      font-weight: 600;
      letter-spacing: -0.2px;
    }

    .header-close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: #ffffff;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease;
    }

    .header-close-btn:hover {
      background: rgba(255, 255, 255, 0.35);
    }

    /* Quick Shortcuts */
    .quick-shortcuts {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 8px;
      margin-bottom: 12px;
      scrollbar-width: none;
    }

    .quick-shortcuts::-webkit-scrollbar {
      display: none;
    }

    .shortcut-pill {
      white-space: nowrap;
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #475569;
      font-size: 11.5px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .shortcut-pill:hover {
      background: #e0f2fe;
      border-color: #38bdf8;
      color: #0284c7;
      transform: translateY(-1px);
    }

    /* Navigation Bar */
    .calendar-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .nav-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .nav-btn:hover {
      background: #f1f5f9;
      color: #0878ff;
      border-color: #cbd5e1;
    }

    .month-year-selectors {
      display: flex;
      gap: 6px;
    }

    .select-month, .select-year {
      padding: 4px 8px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #0f172a;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
    }

    .select-month:hover, .select-year:hover {
      border-color: #0878ff;
      background: #ffffff;
    }

    /* Weekday Headers */
    .weekdays-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      text-align: center;
      margin-bottom: 6px;
    }

    .weekday {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      padding: 4px 0;
    }

    .weekday.sunday {
      color: #ef4444;
    }

    /* Calendar Grid */
    .days-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      margin-bottom: 12px;
    }

    .day-cell {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 36px;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: #1e293b;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 0;
    }

    .day-cell:hover:not(.disabled) {
      background: #e0f2fe;
      color: #0284c7;
      transform: scale(1.05);
    }

    .day-cell.other-month {
      color: #cbd5e1;
    }

    .day-cell.today {
      font-weight: 700;
      color: #0878ff;
    }

    .today-dot {
      position: absolute;
      bottom: 4px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #0878ff;
    }

    .day-cell.selected {
      background: linear-gradient(135deg, #0878ff 0%, #0052cc 100%) !important;
      color: #ffffff !important;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(8, 120, 255, 0.35);
      transform: scale(1.05);
    }

    .day-cell.disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    /* Time Picker Section */
    .time-picker-section {
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
      margin-top: 6px;
      margin-bottom: 12px;
    }

    .time-picker-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 8px;
    }

    .time-inputs-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .time-select {
      padding: 4px 8px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #0f172a;
      font-size: 13px;
      font-weight: 600;
      outline: none;
    }

    .time-colon {
      font-weight: 700;
      color: #64748b;
    }

    .time-presets {
      display: flex;
      gap: 4px;
      margin-left: auto;
    }

    .preset-btn {
      padding: 3px 6px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #475569;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .preset-btn:hover {
      background: #e0f2fe;
      border-color: #38bdf8;
      color: #0284c7;
    }

    /* Dialog Footer */
    .dialog-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
      margin-top: 6px;
    }

    .btn-footer {
      padding: 7px 14px;
      border-radius: 10px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-footer.secondary {
      border: 1px solid #e2e8f0;
      background: #ffffff;
      color: #64748b;
    }

    .btn-footer.secondary:hover {
      background: #f8fafc;
      color: #0f172a;
    }

    .btn-footer.primary {
      border: none;
      background: linear-gradient(135deg, #0878ff 0%, #0052cc 100%);
      color: #ffffff;
      box-shadow: 0 3px 10px rgba(8, 120, 255, 0.25);
    }

    .btn-footer.primary:hover {
      box-shadow: 0 5px 14px rgba(8, 120, 255, 0.4);
      transform: translateY(-1px);
    }

    /* Dark Mode Styling */
    :host-context(html[data-theme=dark]) .datepicker-trigger {
      background-color: #0b1828;
      border-color: #2b476b;
      color: #ffffff;
    }

    :host-context(html[data-theme=dark]) .datepicker-trigger:hover:not(.disabled) {
      border-color: #38bdf8;
      box-shadow: 0 4px 12px rgba(56, 189, 248, 0.15);
    }

    :host-context(html[data-theme=dark]) .trigger-icon {
      color: #38bdf8;
    }

    :host-context(html[data-theme=dark]) .trigger-text.placeholder {
      color: #64748b;
    }

    :host-context(html[data-theme=dark]) .datepicker-dialog {
      background: #0f172a;
      border: 1px solid #1e293b;
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6);
    }

    :host-context(html[data-theme=dark]) .dialog-header {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
    }

    :host-context(html[data-theme=dark]) .shortcut-pill {
      background: #1e293b;
      border-color: #334155;
      color: #94a3b8;
    }

    :host-context(html[data-theme=dark]) .shortcut-pill:hover {
      background: #0369a1;
      border-color: #38bdf8;
      color: #ffffff;
    }

    :host-context(html[data-theme=dark]) .nav-btn {
      background: #1e293b;
      border-color: #334155;
      color: #cbd5e1;
    }

    :host-context(html[data-theme=dark]) .nav-btn:hover {
      background: #334155;
      color: #38bdf8;
    }

    :host-context(html[data-theme=dark]) .select-month,
    :host-context(html[data-theme=dark]) .select-year {
      background: #1e293b;
      border-color: #334155;
      color: #ffffff;
    }

    :host-context(html[data-theme=dark]) .day-cell {
      color: #f1f5f9;
    }

    :host-context(html[data-theme=dark]) .day-cell:hover:not(.disabled) {
      background: #1e293b;
      color: #38bdf8;
    }

    :host-context(html[data-theme=dark]) .day-cell.other-month {
      color: #475569;
    }

    :host-context(html[data-theme=dark]) .day-cell.today {
      color: #38bdf8;
    }

    :host-context(html[data-theme=dark]) .today-dot {
      background: #38bdf8;
    }

    :host-context(html[data-theme=dark]) .day-cell.selected {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%) !important;
      box-shadow: 0 4px 12px rgba(56, 189, 248, 0.4);
    }

    :host-context(html[data-theme=dark]) .time-picker-section {
      border-color: #1e293b;
    }

    :host-context(html[data-theme=dark]) .time-select {
      background: #1e293b;
      border-color: #334155;
      color: #ffffff;
    }

    :host-context(html[data-theme=dark]) .preset-btn {
      background: #1e293b;
      border-color: #334155;
      color: #94a3b8;
    }

    :host-context(html[data-theme=dark]) .preset-btn:hover {
      background: #0369a1;
      border-color: #38bdf8;
      color: #ffffff;
    }

    :host-context(html[data-theme=dark]) .dialog-footer {
      border-color: #1e293b;
    }

    :host-context(html[data-theme=dark]) .btn-footer.secondary {
      background: #1e293b;
      border-color: #334155;
      color: #cbd5e1;
    }

    :host-context(html[data-theme=dark]) .btn-footer.secondary:hover {
      background: #334155;
      color: #ffffff;
    }

    :host-context(html[data-theme=dark]) .btn-footer.primary {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomDatepickerComponent implements ControlValueAccessor {
  readonly mode = input<DatepickerMode>('date');
  readonly placeholder = input<string>('');

  readonly i18n = inject(LanguageService);

  readonly isOpen = signal(false);
  readonly isDisabled = signal(false);

  readonly selectedDate = signal<Date | null>(null);
  readonly viewDate = signal<Date>(new Date());

  readonly hours = signal<number>(12);
  readonly minutes = signal<number>(0);

  readonly hoursArray = Array.from({ length: 24 }, (_, i) => i);
  readonly minutesArray = Array.from({ length: 60 }, (_, i) => i);

  private elementRef = inject(ElementRef);

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  readonly currentMonth = computed(() => this.viewDate().getMonth());
  readonly currentYear = computed(() => this.viewDate().getFullYear());

  readonly monthsList = computed(() => {
    const lang = this.i18n.language();
    if (lang === 'vi') {
      return [
        'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
        'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
        'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
      ];
    }
    return [
      'January', 'February', 'March', 'April',
      'May', 'June', 'July', 'August',
      'September', 'October', 'November', 'December'
    ];
  });

  readonly weekdaysGrid = computed(() => {
    const lang = this.i18n.language();
    if (lang === 'vi') {
      return [
        { label: 'T2', sun: false },
        { label: 'T3', sun: false },
        { label: 'T4', sun: false },
        { label: 'T5', sun: false },
        { label: 'T6', sun: false },
        { label: 'T7', sun: false },
        { label: 'CN', sun: true }
      ];
    }
    return [
      { label: 'Mon', sun: false },
      { label: 'Tue', sun: false },
      { label: 'Wed', sun: false },
      { label: 'Thu', sun: false },
      { label: 'Fri', sun: false },
      { label: 'Sat', sun: false },
      { label: 'Sun', sun: true }
    ];
  });

  readonly yearsList = computed(() => {
    const curYear = new Date().getFullYear();
    const list: number[] = [];
    for (let y = curYear - 20; y <= curYear + 20; y++) {
      list.push(y);
    }
    return list;
  });

  readonly displayLabel = computed(() => {
    const date = this.selectedDate();
    if (!date) {
      if (this.placeholder()) return this.placeholder();
      return this.mode() === 'datetime'
        ? this.i18n.t('datepicker.selectDateTimePlaceholder')
        : this.i18n.t('datepicker.selectDatePlaceholder');
    }

    const day = this.pad2(date.getDate());
    const month = this.pad2(date.getMonth() + 1);
    const year = date.getFullYear();

    if (this.mode() === 'datetime') {
      const h = this.pad2(this.hours());
      const m = this.pad2(this.minutes());
      return `${day}/${month}/${year} ${h}:${m}`;
    }

    return `${day}/${month}/${year}`;
  });

  readonly formattedHeaderDate = computed(() => {
    const date = this.selectedDate() || this.viewDate();
    const lang = this.i18n.language();
    const dayIndex = date.getDay();

    const dayNamesVi = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = lang === 'vi' ? dayNamesVi[dayIndex] : dayNamesEn[dayIndex];

    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    if (this.mode() === 'datetime') {
      const h = this.pad2(this.hours());
      const m = this.pad2(this.minutes());
      return `${dayName}, ${day}/${month}/${year} (${h}:${m})`;
    }

    return `${dayName}, ${day}/${month}/${year}`;
  });

  readonly calendarDays = computed(() => {
    const view = this.viewDate();
    const year = view.getFullYear();
    const month = view.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1; // 0 = Mon, 6 = Sun
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: CalendarDay[] = [];
    const today = new Date();
    const todayStr = this.formatDateString(today);
    const selectedStr = this.selectedDate() ? this.formatDateString(this.selectedDate()!) : '';

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date: d,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: this.formatDateString(d) === todayStr,
        isSelected: this.formatDateString(d) === selectedStr,
        isDisabled: false,
        dateString: this.formatDateString(d)
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= lastDayOfMonth.getDate(); dayNum++) {
      const d = new Date(year, month, dayNum);
      days.push({
        date: d,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: this.formatDateString(d) === todayStr,
        isSelected: this.formatDateString(d) === selectedStr,
        isDisabled: false,
        dateString: this.formatDateString(d)
      });
    }

    // Next month days to complete 42 cells (6 rows x 7 cols)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: this.formatDateString(d) === todayStr,
        isSelected: this.formatDateString(d) === selectedStr,
        isDisabled: false,
        dateString: this.formatDateString(d)
      });
    }

    return days;
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  toggleOpen(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.isDisabled()) return;
    this.isOpen.update(open => !open);
    if (this.isOpen()) {
      this.onTouched();
      if (this.selectedDate()) {
        this.viewDate.set(new Date(this.selectedDate()!));
      }
    }
  }

  close(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.isOpen.set(false);
  }

  prevMonth(): void {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  onMonthChange(newMonth: number): void {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), Number(newMonth), 1));
  }

  onYearChange(newYear: number): void {
    const d = this.viewDate();
    this.viewDate.set(new Date(Number(newYear), d.getMonth(), 1));
  }

  selectDay(day: CalendarDay): void {
    const newDate = new Date(day.date);
    if (!day.isCurrentMonth) {
      this.viewDate.set(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
    }
    this.selectedDate.set(newDate);

    if (this.mode() === 'date') {
      this.emitValue();
      this.close();
    }
  }

  selectToday(): void {
    const today = new Date();
    this.selectedDate.set(today);
    this.viewDate.set(new Date(today.getFullYear(), today.getMonth(), 1));
    if (this.mode() === 'datetime') {
      this.hours.set(today.getHours());
      this.minutes.set(today.getMinutes());
    } else {
      this.emitValue();
      this.close();
    }
  }

  selectShortcut(daysToAdd: number): void {
    const base = new Date();
    base.setDate(base.getDate() + daysToAdd);
    this.selectedDate.set(base);
    this.viewDate.set(new Date(base.getFullYear(), base.getMonth(), 1));
    if (this.mode() === 'date') {
      this.emitValue();
      this.close();
    }
  }

  selectEndOfMonth(): void {
    const cur = this.viewDate();
    const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    this.selectedDate.set(end);
    if (this.mode() === 'date') {
      this.emitValue();
      this.close();
    }
  }

  onHoursChange(h: number): void {
    this.hours.set(Number(h));
  }

  onMinutesChange(m: number): void {
    this.minutes.set(Number(m));
  }

  setPresetTime(h: number, m: number): void {
    this.hours.set(h);
    this.minutes.set(m);
  }

  confirmSelection(): void {
    if (!this.selectedDate()) {
      this.selectedDate.set(new Date());
    }
    this.emitValue();
    this.close();
  }

  clearValue(event: MouseEvent): void {
    event.stopPropagation();
    this.selectedDate.set(null);
    this.onChange(null);
  }

  clearAndClose(): void {
    this.selectedDate.set(null);
    this.onChange(null);
    this.close();
  }

  // ControlValueAccessor methods
  writeValue(value: any): void {
    if (!value) {
      this.selectedDate.set(null);
      return;
    }

    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      this.selectedDate.set(parsed);
      this.viewDate.set(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      this.hours.set(parsed.getHours());
      this.minutes.set(parsed.getMinutes());
    } else {
      this.selectedDate.set(null);
    }
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

  pad2(num: number): string {
    return num < 10 ? `0${num}` : `${num}`;
  }

  private formatDateString(d: Date): string {
    return `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}-${this.pad2(d.getDate())}`;
  }

  private emitValue(): void {
    const date = this.selectedDate();
    if (!date) {
      this.onChange(null);
      return;
    }

    const yyyy = date.getFullYear();
    const mm = this.pad2(date.getMonth() + 1);
    const dd = this.pad2(date.getDate());

    if (this.mode() === 'datetime') {
      const hh = this.pad2(this.hours());
      const min = this.pad2(this.minutes());
      // Return HTML datetime-local compatible format: YYYY-MM-DDTHH:mm
      this.onChange(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    } else {
      // Return HTML date compatible format: YYYY-MM-DD
      this.onChange(`${yyyy}-${mm}-${dd}`);
    }
  }
}
