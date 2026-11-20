// Copy to clipboard with fallbacks (UX-091): the Clipboard API exists only in secure contexts (https, localhost), so a
// page opened over plain HTTP on a LAN falls back to execCommand, then to a dialog where the text is copied by hand.
import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { Dialog, Toast, ToastService } from './kit';

type Note = Omit<Toast, 'id'>;

@Injectable({ providedIn: 'root' })
export class CopyService {
  private readonly toasts = inject(ToastService);
  /** Text the browser would not copy; `<mm-copy-fallback />` shows it for a manual copy. */
  readonly manual = signal<{ text: string; what: string; note?: string } | null>(null);

  /** Copies `text`; `done` replaces the default "Copied" toast (e.g. to say a placeholder is still in it). */
  async copy(text: string, what: string, done?: Note): Promise<boolean> {
    const ok = await CopyService.write(text);
    if (ok) this.toasts.add(done ?? { severity: 'success', summary: 'Copied', detail: `${what} copied to the clipboard.` });
    else this.manual.set({ text, what, note: done?.detail });
    return ok;
  }

  close(): void { this.manual.set(null); }

  private static async write(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch { /* denied: try the old way */ }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(area);
    area.select();
    try { return document.execCommand?.('copy') === true; } catch { return false; } finally { area.remove(); }
  }
}

/** Put once in a page that copies: shows the text the browser refused to copy, selected, for Ctrl+C. */
@Component({
  selector: 'mm-copy-fallback',
  imports: [Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mm-dialog [open]="!!c.manual()" [header]="'Copy ' + (c.manual()?.what ?? '')" width="min(720px, 95vw)" (closed)="c.close()">
      <p class="muted-text">This browser blocked automatic copying (the page is not on HTTPS). The text is selected below: press Ctrl+C (⌘C on a Mac), then close.</p>
      @if (c.manual()?.note) { <p class="alert alert-warn">{{ c.manual()?.note }}</p> }
      <textarea class="input w-full copy-area" readonly rows="12" spellcheck="false" [value]="c.manual()?.text ?? ''"
        (focus)="$any($event.target).select()" autofocus aria-label="Text to copy"></textarea>
      <div class="dialog-actions"><button type="button" class="btn btn-primary" (click)="c.close()">Done</button></div>
    </mm-dialog>`,
  styles: `.copy-area { font-family: var(--mm-mono); font-size: var(--fs-sm); min-height: 12rem; }`,
})
export class CopyFallback {
  readonly c = inject(CopyService);
}
