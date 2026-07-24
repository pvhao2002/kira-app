import {Injectable, signal} from '@angular/core';
import {englishTranslations, TranslationKey, translations} from './translations';

export type SupportedLanguage = 'en' | 'vi';
export type TranslationParams = Record<string, string | number>;

const STORAGE_KEY = 'kira-language';
const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

@Injectable({providedIn: 'root'})
export class LanguageService {
  readonly language = signal<SupportedLanguage>(this.loadLanguage());

  constructor() {
    this.applyDocumentLanguage(this.language());
  }

  setLanguage(language: SupportedLanguage): void {
    this.language.set(language);
    localStorage.setItem(STORAGE_KEY, language);
    this.applyDocumentLanguage(language);
  }

  t(key: TranslationKey | string, params: TranslationParams = {}): string {
    const active = translations[this.language()] as Record<string, string>;
    const english = englishTranslations as Record<string, string>;
    const template = active[key] ?? english[key] ?? key;

    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template
    );
  }

  has(key: string): boolean {
    return key in englishTranslations;
  }

  private loadLanguage(): SupportedLanguage {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'vi' || stored === 'en' ? stored : DEFAULT_LANGUAGE;
  }

  private applyDocumentLanguage(language: SupportedLanguage): void {
    document.documentElement.lang = language;
  }
}
