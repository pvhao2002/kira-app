import {ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal} from '@angular/core';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {IconComponent} from '../../shared/icon/icon';
import {AiRewrite, RewritePreset} from './ai-rewrite';
import type {EnglishCategory, EnglishKind, EnglishRewrite} from '../../shared/models/api.models';
import {InterviewDrill} from './interview-drill';
import {DAILY_ROUTINE, LocalizedText, ROADMAP, TRACKS, TrackId} from './english-speaking.data';

type Tab = 'roadmap' | TrackId | 'rewrite';

const STORAGE_KEY = 'kira-english-speaking-progress';

/** Progress is a per-browser convenience, so storage failures fall back to an empty set. */
function readProgress(): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(saved) ? saved.filter(item => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

@Component({
  selector: 'app-english-speaking',
  imports: [IconComponent, InterviewDrill, AiRewrite],
  templateUrl: './english-speaking.page.html',
  styleUrl: './english-speaking.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnglishSpeakingPage {
  readonly i18n = inject(LanguageService);
  private readonly toast = inject(ToastService);

  readonly tabs: Tab[] = ['roadmap', 'interview', 'meetings', 'standup', 'reports', 'rewrite', 'techstack'];
  readonly roadmap = ROADMAP;
  readonly routine = DAILY_ROUTINE;
  readonly canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  readonly tab = signal<Tab>('roadmap');
  readonly showMeaning = signal(true);
  readonly slow = signal(false);
  readonly speaking = signal<string | null>(null);
  readonly done = signal(readProgress());
  /** Rewrite draft lives here so it survives leaving the tab (the child is destroyed). */
  readonly rewriteKind = signal<EnglishKind>('STANDUP');
  readonly rewriteQuestion = signal('');
  readonly rewriteCategory = signal<EnglishCategory | null>(null);
  readonly rewriteNotes = signal('');
  readonly rewriteResult = signal<EnglishRewrite | null>(null);
  /** Drill position also lives here so switching tabs does not reset it. */
  readonly drillCategory = signal<EnglishCategory | null>(null);
  readonly drillIndex = signal(0);
  /** Stable reference so the child's input never changes identity. */
  readonly speakFn = (text: string, id: string): void => this.speak(text, id);

  readonly track = computed(() => TRACKS.find(track => track.id === this.tab()) ?? null);
  readonly taskIds = ROADMAP.flatMap(week => week.tasks.map((_, index) => this.taskId(week.week, index)));
  readonly roadmapProgress = computed(() => this.percent(this.taskIds));
  readonly currentWeek = computed(() => ROADMAP.find(week =>
    week.tasks.some((_, index) => !this.done().has(this.taskId(week.week, index))))?.week ?? null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.canSpeak && speechSynthesis.cancel());
  }

  text(value: LocalizedText): string {
    return this.i18n.language() === 'vi' ? value.vi : value.en;
  }

  taskId(week: number, index: number): string {
    return `week.${week}.${index}`;
  }

  phraseId(track: TrackId, group: number, phrase: number): string {
    return `${track}.${group}.${phrase}`;
  }

  trackProgress(id: Tab): number {
    const track = TRACKS.find(item => item.id === id);
    if (!track) return 0;
    return this.percent(track.groups.flatMap((group, g) => group.phrases.map((_, p) => this.phraseId(track.id, g, p))));
  }

  openRewrite(preset: RewritePreset): void {
    this.rewriteKind.set(preset.kind);
    this.rewriteQuestion.set(preset.question ?? '');
    this.rewriteCategory.set(preset.category ?? null);
    this.tab.set('rewrite');
  }

  toggle(id: string): void {
    const next = new Set(this.done());
    if (!next.delete(id)) next.add(id);
    this.done.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch { /* storage unavailable */ }
  }

  speak(text: string, id: string): void {
    if (!this.canSpeak) return;
    speechSynthesis.cancel();
    if (this.speaking() === id) {
      this.speaking.set(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text.replace(/\[|\]/g, ''));
    utterance.lang = 'en-US';
    utterance.rate = this.slow() ? 0.75 : 1;
    utterance.onend = utterance.onerror = () => this.speaking.update(current => current === id ? null : current);
    this.speaking.set(id);
    speechSynthesis.speak(utterance);
  }

  async copy(body: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(body);
      this.toast.show(this.i18n.t('english.copied'), 'success');
    } catch {
      this.toast.show(this.i18n.t('english.copyFailed'), 'error');
    }
  }

  private percent(ids: string[]): number {
    return ids.length ? Math.round(ids.filter(id => this.done().has(id)).length * 100 / ids.length) : 0;
  }
}
