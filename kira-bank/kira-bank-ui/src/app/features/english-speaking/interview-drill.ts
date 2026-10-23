import {ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal} from '@angular/core';
import {LanguageService} from '../../core/i18n/language.service';
import {IconComponent} from '../../shared/icon/icon';
import type {EnglishCategory} from '../../shared/models/api.models';
import {INTERVIEW_QUESTIONS, INTERVIEW_ROUNDS, InterviewQuestion, InterviewRound} from './interview-questions.data';
import {fold} from './text-search';

const CATEGORIES: EnglishCategory[] = ['JAVA_CORE', 'SPRING', 'DATABASE', 'ANGULAR', 'SYSTEM_DESIGN', 'PROJECT'];

@Component({
  selector: 'app-interview-drill',
  imports: [IconComponent],
  templateUrl: './interview-drill.html',
  styleUrl: './interview-drill.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InterviewDrill {
  readonly i18n = inject(LanguageService);
  readonly speak = input.required<(text: string, id: string) => void>();
  readonly speaking = input<string | null>();
  readonly showMeaning = input<boolean>();
  readonly answerWithAi = output<{question: string; category: EnglishCategory}>();
  /** Practised ids are owned by the page so they share its saved progress. */
  readonly done = input<ReadonlySet<string>>(new Set());
  readonly toggleDone = output<string>();

  readonly categories = CATEGORIES;
  readonly rounds = INTERVIEW_ROUNDS;
  readonly canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  readonly category = model<EnglishCategory | null>(null);
  /** A round filter replaces the category filter; both null means all questions. */
  readonly round = model<InterviewRound | null>(null);
  readonly index = model(0);
  readonly revealed = signal(false);
  /** The answer stays hidden until asked for, so the learner answers aloud first. */
  readonly answerShown = signal(false);
  readonly search = signal('');

  readonly questions = computed(() => {
    const category = this.category();
    const round = this.round();
    const filtered = round ? INTERVIEW_QUESTIONS.filter(item => item.round === round)
      : category ? INTERVIEW_QUESTIONS.filter(item => item.category === category) : INTERVIEW_QUESTIONS;
    const text = fold(this.search().trim());
    return text ? filtered.filter(item => fold(item.question + ' ' + item.questionVi).includes(text)) : filtered;
  });
  readonly current = computed(() => this.questions()[this.index()] ?? null);

  /** Keyed by the question text, so adding or reordering questions never moves saved progress. */
  questionId(question: InterviewQuestion): string {
    return 'q:' + question.question;
  }

  roundProgress(round: InterviewRound): string {
    const questions = INTERVIEW_QUESTIONS.filter(item => item.round === round);
    return `${questions.filter(item => this.done().has(this.questionId(item))).length}/${questions.length}`;
  }

  select(category: EnglishCategory | null): void {
    this.round.set(null);
    this.category.set(category);
    this.go(0);
  }

  selectRound(round: InterviewRound): void {
    this.category.set(null);
    this.round.set(round);
    this.go(0);
  }

  find(text: string): void {
    this.search.set(text);
    this.go(0);
  }

  step(delta: number): void {
    const total = this.questions().length;
    if (total) this.go((this.index() + delta + total) % total);
  }

  /** Jumps to a random question in the current filter, never the one already shown. */
  random(): void {
    const total = this.questions().length;
    if (total < 2) return;
    const offset = 1 + Math.floor(Math.random() * (total - 1));
    this.go((this.index() + offset) % total);
  }

  private go(index: number): void {
    this.index.set(index);
    this.revealed.set(false);
    this.answerShown.set(false);
  }
}
