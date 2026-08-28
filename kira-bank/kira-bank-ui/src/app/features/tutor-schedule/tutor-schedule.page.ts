import {CdkDrag, CdkDragEnd} from '@angular/cdk/drag-drop';
import {ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild} from '@angular/core';
import {NgStyle} from '@angular/common';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {finalize, Observable} from 'rxjs';
import {ApiService} from '../../core/services/api.service';
import {ToastService} from '../../core/services/toast.service';
import {LanguageService} from '../../core/i18n/language.service';
import {IconComponent} from '../../shared/icon/icon';
import {
  TutoringLesson, TutoringSeriesRequest, TutoringStudent, TutoringStudentRequest,
  TutoringTeachingMode, TutoringWeek
} from '../../shared/models/api.models';

@Component({
  selector: 'app-tutor-schedule',
  imports: [ReactiveFormsModule, IconComponent, CdkDrag, NgStyle],
  templateUrl: './tutor-schedule.page.html',
  styleUrl: './tutor-schedule.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TutorSchedulePage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  readonly i18n = inject(LanguageService);
  readonly toast = inject(ToastService);
  readonly calendarGrid = viewChild<ElementRef<HTMLElement>>('calendarGrid');

  readonly weekStart = signal(this.currentWeekStart());
  readonly week = signal<TutoringWeek | null>(null);
  readonly students = signal<TutoringStudent[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly lessonDialog = signal(false);
  readonly studentDialog = signal(false);
  readonly editingLesson = signal<TutoringLesson | null>(null);
  readonly editingStudent = signal<TutoringStudent | null>(null);
  readonly hours = Array.from({length: 18}, (_, index) => index + 6);
  readonly days = computed(() => Array.from({length: 7}, (_, index) => this.addDays(this.weekStart(), index)));
  readonly canEdit = computed(() => !this.week()?.readOnly);

  readonly lessonForm = this.fb.nonNullable.group({
    studentId: [0, [Validators.required, Validators.min(1)]],
    subject: ['', [Validators.required, Validators.maxLength(150)]],
    date: ['', Validators.required],
    startTime: ['18:00', Validators.required],
    endTime: ['19:30', Validators.required],
    teachingMode: ['IN_PERSON' as TutoringTeachingMode, Validators.required],
    location: ['', Validators.maxLength(500)],
    fee: [0, [Validators.required, Validators.min(0)]],
    note: ['', Validators.maxLength(2000)],
    scope: ['FUTURE' as 'FUTURE' | 'ONCE']
  });
  readonly studentForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    phone: ['', Validators.maxLength(30)],
    color: ['#2563EB', [Validators.required, Validators.pattern(/^#[0-9A-Fa-f]{6}$/)]],
    note: ['', Validators.maxLength(1000)]
  });

  constructor() { this.loadAll(); }

  loadAll(): void {
    this.loading.set(true); this.error.set('');
    let pending = 2;
    const done = () => { pending--; if (!pending) this.loading.set(false); };
    this.api.tutoringWeek(this.weekStart()).pipe(finalize(done)).subscribe({
      next: value => this.week.set(value),
      error: () => this.error.set(this.i18n.t('tutor.loadFailed'))
    });
    this.api.tutoringStudents().pipe(finalize(done)).subscribe({
      next: value => this.students.set(value),
      error: () => this.error.set(this.i18n.t('tutor.loadFailed'))
    });
  }

  moveWeek(offset: number): void { this.weekStart.set(this.addDays(this.weekStart(), offset * 7)); this.loadAll(); }
  goToday(): void { this.weekStart.set(this.currentWeekStart()); this.loadAll(); }
  lessonsFor(date: string): TutoringLesson[] { return (this.week()?.lessons ?? []).filter(value => value.date === date); }
  isToday(date: string): boolean { return date === this.todayInZone(); }
  dayLabel(date: string): string { return new Intl.DateTimeFormat(this.locale(), {weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC'}).format(new Date(`${date}T00:00:00Z`)); }
  weekLabel(): string {
    const value = this.week(); if (!value) return '';
    return `${this.shortDate(value.weekStart)} – ${this.shortDate(value.weekEnd)}`;
  }
  money(value: number): string { return new Intl.NumberFormat(this.locale(), {style: 'currency', currency: 'VND', maximumFractionDigits: 0}).format(value); }
  time(value: string): string { return value.slice(0, 5); }
  duration(lesson: TutoringLesson): string { return `${this.time(lesson.startTime)}–${this.time(lesson.endTime)}`; }
  lessonStyle(lesson: TutoringLesson): Record<string, string> {
    const start = this.minutes(lesson.startTime) - 360;
    const length = Math.max(30, this.minutes(lesson.endTime) - this.minutes(lesson.startTime));
    return {top: `${start * 1.2}px`, height: `${Math.max(42, length * 1.2 - 4)}px`, '--student-color': lesson.studentColor};
  }

  openCreate(date = this.days()[0], startTime = '18:00'): void {
    if (!this.canEdit()) return;
    if (!this.students().length) { this.openStudent(); return; }
    this.editingLesson.set(null); this.error.set('');
    this.lessonForm.reset({studentId: this.students()[0].id, subject: '', date, startTime,
      endTime: this.addMinutes(startTime, 90), teachingMode: 'IN_PERSON', location: '', fee: 0, note: '', scope: 'FUTURE'});
    this.lessonDialog.set(true);
  }
  openLesson(lesson: TutoringLesson): void {
    if (lesson.cancelled) return;
    this.editingLesson.set(lesson); this.error.set('');
    this.lessonForm.reset({studentId: lesson.studentId, subject: lesson.subject, date: lesson.date,
      startTime: this.time(lesson.startTime), endTime: this.time(lesson.endTime), teachingMode: lesson.teachingMode,
      location: lesson.location ?? '', fee: lesson.fee, note: lesson.note ?? '', scope: 'FUTURE'});
    this.lessonDialog.set(true);
  }
  closeLesson(): void { if (!this.saving()) this.lessonDialog.set(false); }

  saveLesson(confirmConflict = false): void {
    if (this.lessonForm.invalid) { this.lessonForm.markAllAsTouched(); return; }
    const value = this.lessonForm.getRawValue();
    if (value.endTime <= value.startTime) { this.error.set(this.i18n.t('tutor.timeInvalid')); return; }
    const lesson = this.editingLesson();
    if (lesson && value.scope === 'ONCE') {
      this.saveWithConflict(confirm => this.api.saveTutoringException(lesson.seriesId, lesson.originalDate, 'MOVE',
        value.date, value.startTime, value.endTime, lesson.exceptionVersion, confirm), confirmConflict);
      return;
    }
    const request: TutoringSeriesRequest = {
      studentId: value.studentId, dayOfWeek: this.dayOfWeek(value.date), startTime: value.startTime,
      endTime: value.endTime, subject: value.subject.trim(), teachingMode: value.teachingMode,
      location: this.blank(value.location), fee: value.fee, note: this.blank(value.note),
      effectiveFrom: this.weekStart(), version: lesson?.seriesVersion ?? null, confirmConflict
    };
    const action = lesson ? this.api.updateTutoringSeries(lesson.seriesId, request) : this.api.createTutoringSeries(request);
    this.runMutation(action, confirmConflict, confirmed => this.saveLesson(confirmed));
  }

  cancelOccurrence(): void {
    const lesson = this.editingLesson(); if (!lesson) return;
    if (!confirm(this.i18n.t('tutor.cancelOnceConfirm'))) return;
    this.saveWithConflict(confirmed => this.api.saveTutoringException(lesson.seriesId, lesson.originalDate, 'CANCEL',
      null, null, null, lesson.exceptionVersion, confirmed), false);
  }
  deleteFuture(): void {
    const lesson = this.editingLesson(); if (!lesson || !confirm(this.i18n.t('tutor.deleteFutureConfirm'))) return;
    this.saving.set(true);
    this.api.deleteTutoringSeries(lesson.seriesId, this.weekStart(), lesson.seriesVersion)
      .pipe(finalize(() => this.saving.set(false))).subscribe({next: () => this.mutationDone(), error: error => this.showError(error)});
  }
  restore(lesson: TutoringLesson, confirmConflict = false): void {
    if (lesson.exceptionVersion === null) return;
    this.runMutation(this.api.restoreTutoringException(lesson.seriesId, lesson.originalDate,
      lesson.exceptionVersion, confirmConflict), confirmConflict, confirmed => this.restore(lesson, confirmed), false);
  }

  dragEnded(event: CdkDragEnd, lesson: TutoringLesson): void {
    event.source.reset();
    if (!this.canEdit() || lesson.cancelled) return;
    const grid = this.calendarGrid()?.nativeElement;
    if (!grid) return;
    const dayWidth = (grid.clientWidth - 64) / 7;
    const dayDelta = Math.round(event.distance.x / dayWidth);
    const minuteDelta = Math.round(event.distance.y / 36) * 30;
    if (!dayDelta && !minuteDelta) { this.openLesson(lesson); return; }
    const date = this.addDays(lesson.date, Math.max(-6, Math.min(6, dayDelta)));
    if (!this.days().includes(date)) { this.toast.show(this.i18n.t('tutor.dragSameWeek'), 'error'); return; }
    const start = Math.max(360, Math.min(1320, this.minutes(lesson.startTime) + minuteDelta));
    const length = this.minutes(lesson.endTime) - this.minutes(lesson.startTime);
    const end = Math.min(1380, start + length);
    if (!confirm(this.i18n.t('tutor.applyFutureConfirm'))) return;
    const request: TutoringSeriesRequest = {studentId: lesson.studentId, dayOfWeek: this.dayOfWeek(date),
      startTime: this.minuteTime(end - length), endTime: this.minuteTime(end), subject: lesson.subject,
      teachingMode: lesson.teachingMode, location: lesson.location, fee: lesson.fee, note: lesson.note,
      effectiveFrom: this.weekStart(), version: lesson.seriesVersion, confirmConflict: false};
    this.runMutation(this.api.updateTutoringSeries(lesson.seriesId, request), false, confirmed => {
      request.confirmConflict = confirmed;
      this.runMutation(this.api.updateTutoringSeries(lesson.seriesId, request), true, () => undefined);
    }, false);
  }

  openStudent(student: TutoringStudent | null = null): void {
    this.editingStudent.set(student); this.error.set('');
    this.studentForm.reset({name: student?.name ?? '', phone: student?.phone ?? '', color: student?.color ?? this.nextColor(), note: student?.note ?? ''});
    this.studentDialog.set(true);
  }
  closeStudent(): void { if (!this.saving()) this.studentDialog.set(false); }
  saveStudent(): void {
    if (this.studentForm.invalid) { this.studentForm.markAllAsTouched(); return; }
    const value = this.studentForm.getRawValue(); const current = this.editingStudent();
    const body: TutoringStudentRequest = {name: value.name.trim(), phone: this.blank(value.phone), color: value.color,
      note: this.blank(value.note), version: current?.version ?? null};
    const action = current ? this.api.updateTutoringStudent(current.id, body) : this.api.createTutoringStudent(body);
    this.saving.set(true); this.error.set('');
    action.pipe(finalize(() => this.saving.set(false))).subscribe({next: student => {
      this.students.update(values => [...values.filter(item => item.id !== student.id), student].sort((a, b) => a.name.localeCompare(b.name)));
      this.editingStudent.set(null); this.studentForm.reset({name: '', phone: '', color: this.nextColor(), note: ''});
      this.toast.show(this.i18n.t('tutor.studentSaved'), 'success');
    }, error: error => this.showError(error)});
  }
  deleteStudent(student: TutoringStudent): void {
    if (!confirm(this.i18n.t('tutor.deleteStudentConfirm'))) return;
    this.api.deleteTutoringStudent(student.id, student.version).subscribe({next: () => {
      this.students.update(values => values.filter(value => value.id !== student.id));
      if (this.editingStudent()?.id === student.id) this.editingStudent.set(null);
      this.toast.show(this.i18n.t('tutor.studentDeleted'), 'success');
    }, error: error => this.showError(error)});
  }

  private saveWithConflict(factory: (confirmed: boolean) => Observable<unknown>, confirmed: boolean): void {
    this.runMutation(factory(confirmed), confirmed, next => this.saveWithConflict(factory, next));
  }
  private runMutation(action: Observable<unknown>, confirmed: boolean, retry: (confirmed: boolean) => void,
                      close = true): void {
    this.saving.set(true); this.error.set('');
    action.pipe(finalize(() => this.saving.set(false))).subscribe({next: () => {
      if (close) this.lessonDialog.set(false); this.mutationDone();
    }, error: (error: HttpErrorResponse) => {
      if (!confirmed && error.status === 409 && error.error?.code === 'TUTOR_SCHEDULE_CONFLICT' &&
          confirm(this.i18n.t('tutor.conflictConfirm'))) retry(true);
      else this.showError(error);
    }});
  }
  private mutationDone(): void { this.lessonDialog.set(false); this.toast.show(this.i18n.t('tutor.saved'), 'success'); this.loadAll(); }
  private showError(error: HttpErrorResponse): void { this.error.set(error.error?.message ?? this.i18n.t('tutor.saveFailed')); }
  private locale(): string { return this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US'; }
  private shortDate(value: string): string { return new Intl.DateTimeFormat(this.locale(), {day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'}).format(new Date(`${value}T00:00:00Z`)); }
  private todayInZone(): string {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date());
    const part = (type: string) => parts.find(value => value.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  private currentWeekStart(): string { const today = this.todayInZone(); return this.addDays(today, 1 - this.dayOfWeek(today)); }
  private addDays(value: string, days: number): string { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
  private dayOfWeek(value: string): number { const day = new Date(`${value}T00:00:00Z`).getUTCDay(); return day === 0 ? 7 : day; }
  private minutes(value: string): number { const [hours, minutes] = value.slice(0, 5).split(':').map(Number); return hours * 60 + minutes; }
  private minuteTime(value: number): string { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
  private addMinutes(value: string, minutes: number): string { return this.minuteTime(Math.min(1380, this.minutes(value) + minutes)); }
  private blank(value: string): string | null { return value.trim() || null; }
  private nextColor(): string { const colors = ['#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#059669', '#0891B2']; return colors[this.students().length % colors.length]; }
}
