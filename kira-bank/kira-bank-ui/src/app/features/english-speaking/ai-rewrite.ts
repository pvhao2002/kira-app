import {ChangeDetectionStrategy, Component, computed, inject, input, model, signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {LanguageService} from '../../core/i18n/language.service';
import {ApiService} from '../../core/services/api.service';
import {apiErrorMessage} from '../../core/services/api-error';
import {ToastService} from '../../core/services/toast.service';
import {IconComponent} from '../../shared/icon/icon';
import type {
  EnglishCategory, EnglishKind, EnglishRewrite, EnglishRewriteRequest, EnglishRewriteSummary
} from '../../shared/models/api.models';

export interface RewritePreset {
  kind: EnglishKind;
  question?: string;
  category?: EnglishCategory;
}

const KINDS: EnglishKind[] = ['STANDUP', 'WEEKLY', 'BIWEEKLY', 'INTERVIEW'];
const NOTES_MAX = 4000;
const QUESTION_MAX = 500;

@Component({
  selector: 'app-ai-rewrite',
  imports: [IconComponent],
  templateUrl: './ai-rewrite.html',
  styleUrl: './ai-rewrite.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiRewrite {
  readonly i18n = inject(LanguageService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly speak = input.required<(text: string, id: string) => void>();
  readonly speaking = input<string | null>();
  readonly showMeaning = input<boolean>();

  readonly kinds = KINDS;
  readonly notesMax = NOTES_MAX;
  readonly questionMax = QUESTION_MAX;
  readonly canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  readonly kind = model<EnglishKind>('STANDUP');
  readonly question = model('');
  readonly category = model<EnglishCategory | null>(null);
  readonly notes = model('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = model<EnglishRewrite | null>(null);
  readonly history = signal<EnglishRewriteSummary[]>([]);
  readonly historyLoading = signal(false);
  readonly historyError = signal<string | null>(null);
  readonly historyActionError = signal<string | null>(null);

  readonly valid = computed(() => {
    const notes = this.notes().trim();
    const question = this.question().trim();
    const questionOk = this.kind() !== 'INTERVIEW' || (question.length > 0 && question.length <= QUESTION_MAX);
    return notes.length > 0 && notes.length <= NOTES_MAX && questionOk;
  });

  /** Result sentences grouped by consecutive section, keeping each sentence's global index for stable speak ids. */
  readonly groups = computed(() => {
    const groups: {section: string; items: {en: string; vi: string; index: number}[]}[] = [];
    (this.result()?.sentences ?? []).forEach((sentence, index) => {
      const last = groups[groups.length - 1];
      if (last && last.section === sentence.section) last.items.push({...sentence, index});
      else groups.push({section: sentence.section, items: [{...sentence, index}]});
    });
    return groups;
  });

  constructor() {
    void this.loadHistory();
  }

  setKind(kind: EnglishKind): void {
    this.kind.set(kind);
    if (kind !== 'INTERVIEW') this.category.set(null);
  }

  async generate(): Promise<void> {
    if (this.loading() || !this.valid()) return;
    const interview = this.kind() === 'INTERVIEW';
    const body: EnglishRewriteRequest = {
      kind: this.kind(),
      notes: this.notes().trim(),
      ...(interview ? {question: this.question().trim()} : {}),
      ...(interview && this.category() ? {category: this.category()!} : {})
    };
    this.loading.set(true);
    this.error.set(null);
    try {
      this.result.set(await firstValueFrom(this.api.post<EnglishRewrite>('english/rewrites', body)));
      void this.loadHistory();
    } catch (error) {
      this.error.set(apiErrorMessage(error, this.i18n.t('english.rewriteFailed')));
    } finally {
      this.loading.set(false);
    }
  }

  async open(id: string): Promise<void> {
    this.historyActionError.set(null);
    try {
      this.result.set(await firstValueFrom(this.api.get<EnglishRewrite>(`english/rewrites/${id}`)));
    } catch (error) {
      this.historyActionError.set(apiErrorMessage(error, this.i18n.t('english.historyActionFailed')));
    }
  }

  async remove(id: string): Promise<void> {
    if (!confirm(this.i18n.t('english.deleteConfirm'))) return;
    this.historyActionError.set(null);
    try {
      await firstValueFrom(this.api.delete<void>(`english/rewrites/${id}`));
      if (this.result()?.id === id) this.result.set(null);
      await this.loadHistory();
    } catch (error) {
      this.historyActionError.set(apiErrorMessage(error, this.i18n.t('english.historyActionFailed')));
    }
  }

  listenAll(): void {
    const result = this.result();
    if (result) this.speak()(result.sentences.map(sentence => sentence.en).join(' '), 'rewrite.' + result.id + '.all');
  }

  async copyEnglish(): Promise<void> {
    const body = this.groups()
      .map(group => (group.section ? `${group.section}:\n` : '') + group.items.map(item => item.en).join('\n'))
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(body);
      this.toast.show(this.i18n.t('english.copiedEnglish'), 'success');
    } catch {
      this.toast.show(this.i18n.t('english.copyEnglishFailed'), 'error');
    }
  }

  date(value: string): string {
    return new Date(value).toLocaleDateString(this.i18n.language() === 'vi' ? 'vi-VN' : 'en-US');
  }

  private async loadHistory(): Promise<void> {
    this.historyLoading.set(true);
    this.historyError.set(null);
    try {
      this.history.set(await firstValueFrom(this.api.get<EnglishRewriteSummary[]>('english/rewrites')));
    } catch (error) {
      this.historyError.set(apiErrorMessage(error, this.i18n.t('english.historyFailed')));
    } finally {
      this.historyLoading.set(false);
    }
  }
}
