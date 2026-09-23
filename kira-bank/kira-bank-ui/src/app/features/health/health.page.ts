import {ChangeDetectionStrategy, Component, DestroyRef, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, RouterLink, RouterLinkActive} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {finalize, forkJoin, Observable} from 'rxjs';
import {LanguageService} from '../../core/i18n/language.service';
import {HealthApiService} from '../../core/services/health-api.service';
import {HealthProfile, HealthWeight, HealthSummary, HealthDevice, HealthPlan, HealthPlanData, HealthJournal, HealthJournalData, HealthAiJob} from '../../shared/models/health.models';
import {numberFormat} from '../../core/i18n/formatters';

@Component({
  selector: 'app-health-page', standalone: true, imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './health.page.html', styleUrl: './health.page.scss', changeDetection: ChangeDetectionStrategy.OnPush
})
export class HealthPage {
  readonly i18n = inject(LanguageService);
  private readonly api = inject(HealthApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly section = String(inject(ActivatedRoute).snapshot.data['healthSection'] ?? 'overview');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly summary = signal<HealthSummary | null>(null);
  readonly statistics = signal<HealthSummary[]>([]);
  readonly weights = signal<HealthWeight[]>([]);
  readonly plans = signal<HealthPlan[]>([]);
  readonly journals = signal<HealthJournal[]>([]);
  readonly device = signal<HealthDevice | null>(null);
  readonly jobs = signal<HealthAiJob[]>([]);
  readonly hasProfile = signal(false);
  profileVersion = -1;
  profile: HealthProfile = {heightCm: 170, birthDate: '', formulaSex: 'MALE', goal: 'MAINTAIN',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, activityFactor: 1.2, calorieAdjustment: 0,
    foodPreferences: '', allergies: '', avoidedFoods: '', preparationMinutes: 30, exerciseExperience: '', equipment: '', availability: '', movementRestrictions: ''};
  date = this.localDate(new Date());
  weekStart = this.monday(this.date);
  fromDate = this.date;
  weightDate = this.date;
  weightKg = 70;
  journalDate = this.date;
  journalId: string | null = null;
  journalVersion = -1;
  journal: HealthJournalData = {kind: 'MEAL', title: '', calories: 0, minutes: 0, notes: ''};
  editor: HealthPlanData | null = null;
  editorId: string | null = null;
  editorVersion = -1;
  consent = false;
  reviewedPlanId: string | null = null;
  readonly profileTextFields = ['foodPreferences', 'allergies', 'avoidedFoods', 'exerciseExperience', 'equipment', 'availability', 'movementRestrictions'] as const;
  readonly tabs = ['overview', 'profile', 'plans', 'journal', 'connection'];
  constructor() { this.reload(); }
  t(key: string) { return this.i18n.t(`health.${key}`); }
  localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  monday(date: string) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return this.localDate(d); }
  shift(date: string, days: number) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return this.localDate(d); }
  value(value: number | null | undefined) { return value == null ? '—' : numberFormat(this.i18n.language(), {maximumFractionDigits: 1}).format(value); }
  reload() {
    this.loading.set(true); this.error.set('');
    forkJoin({profile: this.api.profile(), weights: this.api.weights(), summary: this.api.summary(this.date),
      statistics: this.api.statistics(this.shift(this.date, -6), this.date), connection: this.api.connection(),
      plans: this.api.plans(this.weekStart), journals: this.api.journals(this.date, this.date), jobs: this.api.jobs()})
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))).subscribe({next: r => {
        this.hasProfile.set(!!r.profile); this.profileVersion = r.profile?.version ?? -1;
        if (r.profile) this.profile = {...r.profile.data};
        this.weights.set(r.weights); this.summary.set(r.summary); this.statistics.set(r.statistics); this.device.set(r.connection);
        this.plans.set(r.plans); this.journals.set(r.journals); this.jobs.set(r.jobs);
      }, error: e => this.showError(e)});
  }
  private showError(e: {status?: number; error?: {code?: string}}) {
    const code = e.error?.code ?? '';
    const key = `health.error.${code}`;
    this.error.set(e.status === 409 ? this.t('conflict') : this.i18n.has(key) ? this.i18n.t(key) : this.t('failed'));
  }
  private run<T>(request: Observable<T>, after?: (value: T) => void) {
    if (this.saving()) return;
    this.saving.set(true); this.error.set(''); this.notice.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({next: value => {
      this.notice.set(this.t('saved')); this.reload(); after?.(value);
    }, error: e => this.showError(e)});
  }
  saveProfile() { this.run(this.api.saveProfile(this.profile, this.profileVersion)); }
  saveWeight() { this.run(this.api.saveWeight({date: this.weightDate, kg: this.weightKg})); }
  deleteWeight(weight: HealthWeight) { if (confirm(this.t('deleteConfirm'))) this.run(this.api.deleteWeight(weight.date)); }
  newPlan() { this.editorId = null; this.editorVersion = -1; this.reviewedPlanId = null; this.editor = {title: '', items: [], warnings: []}; this.addItem(); }
  editPlan(plan: HealthPlan) {
    this.editorId = plan.status === 'DRAFT' ? plan.id : null;
    this.editorVersion = plan.status === 'DRAFT' ? plan.version : -1;
    this.editor = structuredClone(plan.data); this.reviewedPlanId = null;
  }
  addItem() { this.editor?.items.push({date: this.weekStart, kind: 'MEAL', title: '', portion: '', calories: 0, minutes: 0, notes: '', completed: false}); }
  savePlan() {
    if (this.editor) this.run(this.api.savePlan(this.editorId, this.weekStart, this.editor, this.editorVersion), () => this.editor = null);
  }
  approve(plan: HealthPlan) { if (this.reviewedPlanId === plan.id && confirm(this.t('approveConfirm'))) this.run(this.api.approve(plan), () => this.reviewedPlanId = null); }
  complete(plan: HealthPlan, index: number) { this.run(this.api.complete(plan, index, !plan.data.items[index].completed)); }
  generate() {
    if (!this.consent) return;
    this.run(this.api.generate(this.weekStart, this.fromDate, this.i18n.language()), job => {
      if (job.status === 'FAILED') { this.notice.set(''); this.showError({error: {code: job.errorCode ?? ''}}); }
    });
  }
  changeWeek() { this.weekStart = this.monday(this.weekStart); this.editor = null; this.reviewedPlanId = null; this.fromDate = this.weekStart > this.localDate(new Date()) ? this.weekStart : this.localDate(new Date()); this.reload(); }
  saveJournal() { this.run(this.api.saveJournal(this.journalId, this.journalDate, this.journal, this.journalVersion), () => this.resetJournal()); }
  editJournal(entry: HealthJournal) { this.journalId = entry.id; this.journalVersion = entry.version; this.journalDate = entry.date; this.journal = {...entry.data}; }
  resetJournal() { this.journalId = null; this.journalVersion = -1; this.journal = {kind: 'MEAL', title: '', calories: 0, minutes: 0, notes: ''}; }
  deleteJournal(entry: HealthJournal) { if (confirm(this.t('deleteConfirm'))) this.run(this.api.deleteJournal(entry)); }
  disconnect(deleteData: boolean) { if (confirm(this.t(deleteData ? 'eraseConfirm' : 'disconnectConfirm'))) this.run(this.api.disconnect(deleteData)); }
}
