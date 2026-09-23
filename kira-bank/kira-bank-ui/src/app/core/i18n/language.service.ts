import {Injectable, computed, signal} from '@angular/core';
import {englishTranslations, TranslationKey} from './translations';

export type SupportedLanguage = 'en' | 'vi';
export type TranslationParams = Record<string, string | number>;

type Dictionary = Record<string, string>;

const STORAGE_KEY = 'kira-language';
const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
const english = englishTranslations as Dictionary;

/** Vietnamese ships in its own chunk; English is the bundled fallback. */
let vietnamese: Dictionary | null = null;

function storedLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'vi' || stored === 'en' ? stored : DEFAULT_LANGUAGE;
}

function loadVietnamese(): Promise<Dictionary> {
  return vietnamese
    ? Promise.resolve(vietnamese)
    : import('./translations.vi').then(module => vietnamese = module.vietnameseTranslations);
}

/** Call before bootstrap so a Vietnamese session never renders English first. */
export function preloadLanguage(): Promise<unknown> {
  return storedLanguage() === 'vi' ? loadVietnamese() : Promise.resolve();
}

@Injectable({providedIn: 'root'})
export class LanguageService {
  readonly language = signal<SupportedLanguage>(storedLanguage());
  readonly locale = computed(() => this.language() === 'vi' ? 'vi-VN' : 'en-US');
  private readonly vietnamese = signal<Dictionary | null>(vietnamese);
  private readonly dictionary = computed(() => this.language() === 'vi' ? this.vietnamese() ?? english : english);

  constructor() {
    this.applyDocumentLanguage(this.language());
    if (this.language() === 'vi' && !this.vietnamese()) void this.activateVietnamese();
  }

  setLanguage(language: SupportedLanguage): void {
    localStorage.setItem(STORAGE_KEY, language);
    this.applyDocumentLanguage(language);
    if (language === 'vi' && !this.vietnamese()) {
      void this.activateVietnamese();
      return;
    }
    this.language.set(language);
  }

  t(key: TranslationKey | string, params?: TranslationParams): string {
    const template = this.dictionary()[key] ?? english[key] ?? key;
    if (!params) return template;

    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template
    );
  }

  has(key: string): boolean {
    return key in englishTranslations;
  }

  private activateVietnamese(): Promise<void> {
    return loadVietnamese().then(dictionary => {
      this.vietnamese.set(dictionary);
      this.language.set('vi');
    });
  }

  private applyDocumentLanguage(language: SupportedLanguage): void {
    document.documentElement.lang = language;
  }
}
