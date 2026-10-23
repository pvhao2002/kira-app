import {ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {LanguageService} from '../../core/i18n/language.service';
import {ToastService} from '../../core/services/toast.service';
import {IconComponent} from '../../shared/icon/icon';
import {AiRewrite, RewritePreset} from './ai-rewrite';
import type {EnglishCategory, EnglishKind, EnglishRewrite} from '../../shared/models/api.models';
import {InterviewDrill} from './interview-drill';
import type {InterviewRound} from './interview-questions.data';
import {fold, speakable} from './text-search';
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
  imports: [IconComponent, InterviewDrill, AiRewrite, NgTemplateOutlet],
  templateUrl: './english-speaking.page.html',
  styleUrl: './english-speaking.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnglishSpeakingPage {
  readonly i18n = inject(LanguageService);
  private readonly toast = inject(ToastService);

  /** Tabs grouped by theme; every track must appear in exactly one group. */
  readonly tabGroups: {key: string; tabs: Tab[]}[] = [
    {key: 'start', tabs: ['roadmap', 'rewrite']},
    {key: 'interview', tabs: ['interview', 'livecoding', 'offer', 'hiring', 'cv', 'sdinterview']},
    {key: 'work', tabs: ['standup', 'reports', 'meetings', 'agile', 'estimates', 'writing', 'git', 'pairing', 'walkthrough', 'docs', 'qa', 'release', 'acceptance']},
    {key: 'team', tabs: ['client', 'consulting', 'presenting', 'workshop', 'product', 'support', 'oncall', 'feedback', 'leadership']},
    {key: 'foundation', tabs: ['pronunciation', 'symbols', 'mistakes', 'phrasal', 'diplomatic', 'listening', 'vocab', 'linking', 'jargon', 'storytelling', 'questions', 'dialogues']},
    {key: 'office', tabs: ['office', 'situations', 'onboarding', 'social', 'remote', 'wellbeing', 'phone', 'meetup', 'travel']},
    {key: 'domain', tabs: ['techstack', 'fintech', 'systemtalk', 'aitools', 'security', 'data', 'techdebt', 'cloud', 'testingtalk', 'frontend', 'mobile']}
  ];
  readonly roadmap = ROADMAP;
  readonly routine = DAILY_ROUTINE;
  readonly canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  readonly tab = signal<Tab>('roadmap');
  readonly showMeaning = signal(true);
  readonly slow = signal(false);
  readonly speaking = signal<string | null>(null);
  /** Recall mode hides the English so the learner says it first, then reveals it. */
  readonly recall = signal(false);
  readonly revealed = signal<ReadonlySet<string>>(new Set());
  readonly done = signal(readProgress());
  /** Rewrite draft lives here so it survives leaving the tab (the child is destroyed). */
  readonly rewriteKind = signal<EnglishKind>('STANDUP');
  readonly rewriteQuestion = signal('');
  readonly rewriteCategory = signal<EnglishCategory | null>(null);
  readonly rewriteNotes = signal('');
  readonly rewriteResult = signal<EnglishRewrite | null>(null);
  /** Drill position also lives here so switching tabs does not reset it. */
  readonly drillCategory = signal<EnglishCategory | null>(null);
  readonly drillRound = signal<InterviewRound | null>(null);
  readonly drillIndex = signal(0);
  /** Stable reference so the child's input never changes identity. */
  readonly speakFn = (text: string, id: string): void => this.speak(text, id);

  /** The group of the open tab, so a roadmap link to any track also switches the group row. */
  readonly activeGroup = computed(() => this.tabGroups.find(group => group.tabs.includes(this.tab())) ?? this.tabGroups[0]);
  readonly allPhrases = TRACKS.flatMap(track => track.groups.flatMap((group, g) => group.phrases.map((phrase, p) =>
    ({phrase, track: track.id, id: this.phraseId(track.id, g, p)}))));
  /** Five unpractised phrases for today's shadowing step; the start moves daily and practised ones drop out. */
  readonly todayPhrases = computed(() => {
    const done = this.done();
    const open = this.allPhrases.filter(item => !done.has(item.id));
    const start = Math.floor(Date.now() / 86_400_000) * 37 % Math.max(open.length, 1);
    return Array.from({length: Math.min(5, open.length)}, (_, i) => open[(start + i) % open.length]);
  });
  readonly phraseQuery = signal('');
  /** Accent-insensitive, so "tre mot tuan" also finds "trễ một tuần". */
  readonly phraseResults = computed(() => {
    const query = fold(this.phraseQuery().trim());
    if (query.length < 2) return [];
    return this.allPhrases.filter(item => fold(item.phrase.en + ' ' + item.phrase.vi).includes(query)).slice(0, 30);
  });
  readonly track = computed(() => TRACKS.find(track => track.id === this.tab()) ?? null);
  readonly taskIds = ROADMAP.flatMap(week => week.tasks.map((_, index) => this.taskId(week.week, index)));
  readonly roadmapProgress = computed(() => this.percent(this.taskIds));
  readonly phraseIds = this.allPhrases.map(item => item.id);
  readonly phrasesDone = computed(() => this.phraseIds.filter(id => this.done().has(id)).length);
  /** Counted from saved ids only, so the page doesn't import the deferred question bank. */
  readonly questionsDone = computed(() => [...this.done()].filter(id => id.startsWith('q:')).length);
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
    return this.percent(this.allPhrases.filter(item => item.track === id).map(item => item.id));
  }

  toggleRecall(): void {
    this.recall.update(on => !on);
    this.revealed.set(new Set());
  }

  reveal(id: string): void {
    this.revealed.update(ids => new Set(ids).add(id));
  }

  openGroup(key: string): void {
    const group = this.tabGroups.find(item => item.key === key);
    if (group && !group.tabs.includes(this.tab())) this.tab.set(group.tabs[0]);
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
    const utterance = new SpeechSynthesisUtterance(speakable(text));
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
