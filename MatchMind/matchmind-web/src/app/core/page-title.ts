import { Injectable, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';

/**
 * UX-005: a detail page names itself once its data is in ("Arsenal – Chelsea", a model name). The shell heading and
 * the browser tab show that name instead of the generic route title; the shell clears it on every new page.
 */
@Injectable({ providedIn: 'root' })
export class PageTitle {
  private readonly title = inject(Title);
  readonly value = signal<string | null>(null);

  set(name: string): void {
    this.value.set(name);
    this.title.setTitle(`${name} · MatchMind`);
  }
}
