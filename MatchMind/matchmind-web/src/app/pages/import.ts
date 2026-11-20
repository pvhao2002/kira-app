import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/http';
import { ApiError } from '../core/models';

const PROVIDER_KEY = 'matchmind.import-provider';

/** The JSON body (first "{" to last "}") and the model line out of whatever the agent printed around them. */
export function readAgentOutput(text: string): { json: string | null; model: string | null; error: string } {
  const model = /^\s*X-Model-Name:\s*(.+?)\s*$/im.exec(text)?.[1] ?? null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return { json: null, model, error: 'No JSON object found. Paste the agent reply that contains the JSON.' };
  const json = text.slice(start, end + 1);
  try {
    JSON.parse(json);
    return { json, model, error: '' };
  } catch (e) {
    return { json: null, model, error: `The JSON is not valid JSON: ${(e as Error).message}` };
  }
}

/** For agents that could not reach the API (no internet in their sandbox): paste their reply, send it here. */
@Component({
  selector: 'mm-import',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel import-panel">
      <p class="page-note">When an agent replies <code>CANNOT_CALL_API</code>, paste its whole reply below. The JSON is checked
        exactly like a call to the API, and the provider and model are created if they are new.</p>
      @if (!auth.isAdmin()) {
        <div class="alert alert-warn" role="status">Only an admin can import predictions.</div>
      } @else {
        <form class="stack" (ngSubmit)="send()">
          <div class="import-ids">
            <div class="field"><label for="imp-provider">Provider</label>
              <input class="input w-full" id="imp-provider" name="provider" [(ngModel)]="provider" placeholder="chatgpt" required
                     pattern="[a-zA-Z0-9][a-zA-Z0-9_\\-]{1,63}" />
              <small class="muted-text">The agent or app that made it. Use the same name every time.</small></div>
            <div class="field"><label for="imp-model">Model</label>
              <input class="input w-full" id="imp-model" name="model" [ngModel]="model()" (ngModelChange)="model.set($event)" placeholder="gpt-5.1" required />
              <small class="muted-text">Filled in from the X-Model-Name line when the reply has one.</small></div>
            <div class="field"><label for="imp-version">Model version</label>
              <input class="input w-full" id="imp-version" name="version" [(ngModel)]="version" placeholder="1" /></div>
          </div>
          <div class="field"><label for="imp-json">Agent reply</label>
            <textarea class="input import-text" id="imp-json" name="text" [ngModel]="text()" (ngModelChange)="onPaste($event)" spellcheck="false"
                      placeholder="CANNOT_CALL_API&#10;X-Model-Name: …&#10;{ … }" data-testid="import-text"></textarea>
            @if (text() && parsed().error) { <div class="field-error">{{ parsed().error }}</div> }</div>
          @if (error(); as e) {
            <div class="alert alert-error" role="alert" data-testid="import-error">
              <div><strong>{{ e.code }}</strong>: {{ e.message }}
                @if (fieldErrors().length) { <ul>@for (f of fieldErrors(); track f[0]) { <li><code>{{ f[0] }}</code> {{ f[1] }}</li> }</ul> }
              </div>
            </div>
          }
          @if (result(); as r) {
            <div class="alert alert-success" role="status" data-testid="import-result">
              {{ r.duplicate ? 'Already stored: this exact JSON was imported before.' : 'Prediction stored.' }}
              <a [routerLink]="['/predictions', r.predictionId]">Open prediction</a>
            </div>
          }
          <div class="row">
            <button type="submit" class="btn btn-primary" aria-describedby="imp-hint" [disabled]="busy() || !parsed().json || !provider().trim() || !model().trim()">
              <i class="pi" [class.pi-upload]="!busy()" [class.pi-spinner]="busy()" [class.pi-spin]="busy()"></i> Send prediction</button>
            <small id="imp-hint" class="muted-text">
              @if (!provider().trim()) { Enter the provider to send. }
              @else if (!model().trim()) { Enter the model name to send. }
              @else if (!parsed().json) { Paste the agent reply that contains the JSON to send. }
            </small>
          </div>
        </form>
      }
    </section>`,
})
export class ImportPage {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  readonly provider = signal(ImportPage.storedProvider());
  readonly version = signal('');
  readonly model = signal('');
  readonly text = signal('');
  readonly parsed = computed(() => readAgentOutput(this.text()));
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly result = signal<{ predictionId: string; duplicate: boolean } | null>(null);
  readonly fieldErrors = computed(() => Object.entries(this.error()?.fieldErrors ?? {}));

  onPaste(text: string): void {
    this.text.set(text);
    this.result.set(null);
    this.error.set(null);
    const model = readAgentOutput(text).model;
    if (model) this.model.set(model);
  }

  send(): void {
    const json = this.parsed().json;
    if (!json || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.result.set(null);
    try { localStorage.setItem(PROVIDER_KEY, this.provider().trim()); } catch { /* optional convenience */ }
    this.api.importPrediction(json, this.provider().trim(), this.model().trim(), this.version().trim()).subscribe({
      next: r => { this.result.set(r); this.busy.set(false); },
      error: e => { this.error.set(apiError(e)); this.busy.set(false); },
    });
  }

  private static storedProvider(): string {
    try { return localStorage.getItem(PROVIDER_KEY) ?? ''; } catch { return ''; }
  }
}
