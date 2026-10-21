import {ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal} from '@angular/core';
import {LanguageService} from '../../core/i18n/language.service';
import {IconComponent} from '../../shared/icon/icon';
import type {EnglishCategory} from '../../shared/models/api.models';
import {INTERVIEW_QUESTIONS} from './interview-questions.data';

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

  readonly categories = CATEGORIES;
  readonly canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  readonly category = model<EnglishCategory | null>(null);
  readonly index = model(0);
  readonly revealed = signal(false);

  readonly questions = computed(() => {
    const category = this.category();
    return category ? INTERVIEW_QUESTIONS.filter(item => item.category === category) : INTERVIEW_QUESTIONS;
  });
  readonly current = computed(() => this.questions()[this.index()] ?? null);

  select(category: EnglishCategory | null): void {
    this.category.set(category);
    this.go(0);
  }

  step(delta: number): void {
    const total = this.questions().length;
    if (total) this.go((this.index() + delta + total) % total);
  }

  private go(index: number): void {
    this.index.set(index);
    this.revealed.set(false);
  }
}
