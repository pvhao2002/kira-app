import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/http';
import { ApiError } from '../core/models';
import { safeValue } from '../core/resource';

const PROVIDER_KEY = 'matchmind.import-provider';

/** Copy of docs/samples/prediction-pre-match.json (kept in sync by hand; the web app does not fetch docs). */
export const SAMPLE_PREDICTION = `{
  "eventId": "evt-20261121-rma-bar-pre",
  "model": { "name": "GoalNet", "version": "2.1" },
  "match": {
    "externalMatchId": "laliga-2026-rma-bar",
    "league": "La Liga",
    "homeTeam": "Real Madrid",
    "awayTeam": "Barcelona",
    "startTime": "2026-11-19T20:00:00Z"
  },
  "predictionType": "PRE_MATCH",
  "predictedAt": "2026-11-19T18:00:00Z",
  "odds": [
    { "ref": "1x2", "market": "1X2", "stage": "PRE_MATCH", "homeOdds": 2.40, "drawOdds": 3.30, "awayOdds": 2.90 },
    { "ref": "ah", "market": "AH", "stage": "PRE_MATCH", "line": -0.25, "homeOdds": 1.98, "awayOdds": 1.88 },
    { "ref": "ou", "market": "OU", "stage": "PRE_MATCH", "line": 2.75, "overOdds": 1.92, "underOdds": 1.94 },
    { "ref": "cou", "market": "CORNER_OU", "stage": "PRE_MATCH", "line": 9.75, "overOdds": 1.90, "underOdds": 1.90 },
    { "ref": "cah", "market": "CORNER_AH", "stage": "PRE_MATCH", "line": -1.5, "homeOdds": 1.95, "awayOdds": 1.85 }
  ],
  "picks": [
    { "oddsRef": "1x2", "market": "1X2", "pick": "HOME", "probability": 0.45, "rank": 1 },
    { "oddsRef": "ou", "market": "OU", "pick": "OVER", "probability": 0.56, "rank": 2 }
  ],
  "correctScore": { "home": 2, "away": 1, "probability": 0.11 }
}`;
const SAMPLE_REPLY = `CANNOT_CALL_API\nX-Model-Name: GoalNet\n\`\`\`json\n${SAMPLE_PREDICTION}\n\`\`\``;

type Json = Record<string, unknown>;
export interface ImportItem { json: string; data: Json; }
export interface AgentOutput {
  items: ImportItem[]; model: string | null; error: string;
  /** Curly quotes or trailing commas were fixed before parsing (UX-093). */
  cleaned: boolean;
  /** The first item's JSON (kept for callers that send one prediction). */
  json: string | null;
}

const QUOTES = /[“”„‟″]/g;
const QUOTE = /[“”„‟″]/;

/** Every top-level `{…}` or `[…]` in the text, string-aware; an unterminated one runs to the end (cut-off reply). */
function jsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  let start = -1, depth = 0, inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (start < 0) { if (ch === '{' || ch === '[') { start = i; depth = 1; } continue; }
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"' || QUOTE.test(ch)) inString = false;
      continue;
    }
    if (ch === '"' || QUOTE.test(ch)) inString = true;
    else if (ch === '{' || ch === '[') depth++;
    else if ((ch === '}' || ch === ']') && --depth === 0) { blocks.push(text.slice(start, i + 1)); start = -1; }
  }
  if (start >= 0) blocks.push(text.slice(start));
  return blocks;
}

function invalidJson(block: string, e: unknown, label: string): string {
  const msg = (e as Error).message ?? '';
  const at = /position (\d+)/.exec(msg);
  if (!at) return `${label} is not valid JSON: it ends before it is complete (was the reply cut off?).`;
  const pos = Number(at[1]);
  const before = block.slice(0, pos).split('\n');
  const reason = msg.replace(/\s*(in JSON )?at position.*$/s, '');
  const near = block.slice(Math.max(0, pos - 20), pos + 20).replace(/\s+/g, ' ');
  return `${label} is not valid JSON at line ${before.length}, column ${before.at(-1)!.length + 1}: ${reason}. Near "${near}".`;
}

const looksLikeResult = (d: Json) =>
  !('predictionType' in d) && !('picks' in d) && ('finalScore' in d || 'results' in d || ('status' in d && 'externalMatchId' in d));

/**
 * The prediction JSON(s) and the model line out of whatever the agent printed around them: one object, an array of
 * objects, or several blocks. Curly quotes and trailing commas are fixed only when the text does not parse as is.
 */
export function readAgentOutput(text: string): AgentOutput {
  const model = /^\s*X-Model-Name:\s*(.+?)\s*$/im.exec(text)?.[1] ?? null;
  // Prose may hold brackets ("[draft]"): only blocks that look like JSON ("key": …) count when they fail to parse.
  const blocks = jsonBlocks(text).filter(b => { try { JSON.parse(b); return true; } catch { return /["“”]\s*:/.test(b); } });
  if (!blocks.length) return { items: [], model, error: 'No JSON object found. Paste the agent reply that contains the JSON.', cleaned: false, json: null };
  const items: ImportItem[] = [];
  const errors: string[] = [];
  let cleaned = false, results = 0;
  blocks.forEach((block, i) => {
    const label = blocks.length > 1 ? `JSON block ${i + 1}` : 'This';
    let value: unknown;
    try { value = JSON.parse(block); } catch (e) {
      const fixed = block.replace(QUOTES, '"').replace(/,(\s*[}\]])/g, '$1');
      try { value = JSON.parse(fixed); cleaned = true; } catch { errors.push(invalidJson(block, e, label)); return; }
    }
    for (const v of Array.isArray(value) ? value : [value]) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) { errors.push(`${label} holds something other than a JSON object.`); continue; }
      if (looksLikeResult(v as Json)) { results++; continue; }
      items.push({ json: JSON.stringify(v), data: v as Json });
    }
  });
  if (results) errors.push(`${results === 1 ? 'This is a match result' : `${results} blocks are match results`}, not a prediction. `
    + 'Enter results on the match page, or give the agent the AI match result prompt so it sends them itself.');
  return { items, model, error: errors.join(' '), cleaned, json: items[0]?.json ?? null };
}

export interface ImportPreview {
  match: string; league: string | null; type: string | null; picks: number; odds: number;
  model: string | null; version: string | null; missing: string[];
}

/** What the server will see, before sending: which match, how many picks and odds, which required fields are missing. */
export function previewOf(d: Json): ImportPreview {
  const m = (d['match'] ?? {}) as Json;
  const model = (d['model'] ?? {}) as Json;
  const list = (k: string) => (Array.isArray(d[k]) ? (d[k] as unknown[]).length : 0);
  const missing = [
    ...(['homeTeam', 'awayTeam'] as const).filter(k => !String(m[k] ?? '').trim()).map(k => `match.${k}`),
    ...(d['predictionType'] ? [] : ['predictionType']),
    ...(['odds', 'picks'] as const).filter(k => !list(k)),
    ...(d['correctScore'] ? [] : ['correctScore']),
    ...(d['predictionType'] === 'LIVE' ? (['matchMinute', 'currentScore'] as const).filter(k => d[k] == null) : []),
  ];
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
  return {
    match: `${str(m['homeTeam']) ?? '?'} v ${str(m['awayTeam']) ?? '?'}`, league: str(m['league']), type: str(d['predictionType']),
    picks: list('picks'), odds: list('odds'), model: str(model['name']), version: str(model['version']), missing,
  };
}

const ERROR_TITLES: Record<string, string> = {
  VALIDATION_ERROR: 'The prediction did not pass validation',
  UNKNOWN_FIELD: 'The JSON has a field the API does not know',
  INVALID_FIELD_TYPE: 'A field has the wrong type',
  MALFORMED_REQUEST: 'The body is not one JSON object',
  MATCH_MISMATCH: 'This externalMatchId belongs to a match between other teams',
  EVENT_ID_REUSED: 'This eventId was already used for a different prediction',
  MATCH_ALREADY_FINAL: 'The match already has a final result',
  MODEL_REQUIRED: 'No model: fill in the Model field or add model.name to the JSON',
  INVALID_PROVIDER: 'The provider must be 2–64 characters: a-z, 0-9, - or _',
};

export interface ImportResult {
  label: string; status: 'stored' | 'duplicate' | 'error';
  predictionId?: string; possibleDuplicateOf?: string | null;
  title?: string; message?: string; fields?: [string, string][];
}

function failure(label: string, e: ApiError): ImportResult {
  const title = e.status === 413 ? 'Too large: one prediction can be at most 1 MB' : ERROR_TITLES[e.code] ?? 'The import failed';
  return { label, status: 'error', title, message: e.message, fields: Object.entries(e.fieldErrors ?? {}) };
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** For agents that could not reach the API (no internet in their sandbox): paste their reply, send it here. */
@Component({
  selector: 'mm-import',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel import-panel">
      <div class="page-note">
        <strong>How this works</strong>
        <ol class="steps">
          <li>Copy a prompt from <a routerLink="/prompts">Prompt Notes</a> and give it to the agent with the match.</li>
          <li>An agent with internet sends its prediction to the API by itself: nothing to do here
            (see <a routerLink="/settings">Settings › Connect an agent</a>).</li>
          <li>An agent without internet replies <code>CANNOT_CALL_API</code>, a line <code>X-Model-Name: …</code> naming its model,
            and the JSON. Paste that whole reply below; it is checked exactly like a call to the API.</li>
        </ol>
      </div>
      @if (!auth.isAdmin()) {
        <div class="alert alert-warn" role="status">Only an admin can import predictions.</div>
      } @else {
        <form class="stack" (ngSubmit)="send()">
          <p class="muted-text"><span aria-hidden="true">*</span> required</p>
          <div class="import-ids">
            <div class="field"><label for="imp-provider">Provider <span aria-hidden="true">*</span></label>
              <input class="input w-full" id="imp-provider" name="provider" [ngModel]="provider()" (ngModelChange)="provider.set($event)" placeholder="e.g. chatgpt" required
                     list="imp-providers" pattern="[a-zA-Z0-9][a-zA-Z0-9_\\-]{1,63}" autocomplete="off" />
              <datalist id="imp-providers">@for (p of providers(); track p.id) { <option [value]="p.code">{{ p.name }}</option> }</datalist>
              <small class="muted-text">The agent or app that made it. Use the same name every time.</small>
              @if (newProvider()) { <small class="warn-text">New provider "{{ provider().trim() }}": it is created by the first accepted prediction.</small> }</div>
            <div class="field"><label for="imp-model">Model</label>
              <input class="input w-full" id="imp-model" name="model" [ngModel]="model()" (ngModelChange)="model.set($event)" placeholder="from the JSON or X-Model-Name"
                     list="imp-models" autocomplete="off" />
              <datalist id="imp-models">@for (m of providerModels(); track m.id) { <option [value]="m.name">{{ m.name }} v{{ m.version }}</option> }</datalist>
              <small class="muted-text">Leave empty to use <code>model.name</code> from the JSON. Filled in from the X-Model-Name line.</small></div>
            <div class="field"><label for="imp-version">Model version</label>
              <input class="input w-full" id="imp-version" name="version" [ngModel]="version()" (ngModelChange)="version.set($event)" placeholder="from the JSON, else 1" /></div>
          </div>
          <div class="field"><label for="imp-json">Agent reply <span aria-hidden="true">*</span></label>
            <textarea class="input import-text" id="imp-json" name="text" [ngModel]="text()" (ngModelChange)="onPaste($event)" spellcheck="false"
                      placeholder="CANNOT_CALL_API&#10;X-Model-Name: …&#10;{ … }" data-testid="import-text"></textarea>
            <div class="row">
              <button type="button" class="btn btn-text btn-sm" (click)="useExample()"><i class="pi pi-file" aria-hidden="true"></i> Use example</button>
              <small class="muted-text">One prediction, a JSON array, or several JSON blocks. Required in each: match.homeTeam, match.awayTeam,
                predictionType, odds, picks, correctScore (LIVE also matchMinute, currentScore).</small>
            </div>
            @if (text() && parsed().error) { <div class="field-error" role="alert">{{ parsed().error }}</div> }
            @if (parsed().cleaned) { <small class="muted-text">Curly quotes or trailing commas were fixed before reading the JSON.</small> }</div>

          @if (previews().length) {
            <div class="table-wrap"><table class="dt" data-testid="import-preview">
              <caption class="sr-only">What will be sent</caption>
              <thead><tr><th>#</th><th>Match</th><th>Type</th><th>Picks</th><th>Odds</th><th>Model</th><th>Missing</th></tr></thead>
              <tbody>
                @for (p of previews(); track $index) {
                  <tr><td>{{ $index + 1 }}</td><td>{{ p.match }}@if (p.league) { <span class="cell-sub">{{ p.league }}</span> }</td>
                    <td>{{ p.type ?? '—' }}</td><td>{{ p.picks }}</td><td>{{ p.odds }}</td>
                    <td>{{ modelOf(p) ?? '—' }}</td>
                    <td>@if (p.missing.length) { <span class="warn-text">{{ p.missing.join(', ') }}</span> } @else { — }</td></tr>
                }
              </tbody>
            </table></div>
            <p class="muted-text" data-testid="model-note">{{ modelNote() }}</p>
            @if (newModels().length) {
              <div class="alert alert-warn" role="status">New model {{ quoted(newModels()) }} for {{ provider().trim() || 'this provider' }}: it is created by
                the first accepted prediction. Check the spelling, or pick an existing model from the list.</div>
            }
          }

          @for (r of results(); track $index) {
            <div class="alert" [class.alert-success]="r.status !== 'error'" [class.alert-error]="r.status === 'error'" role="status" data-testid="import-result">
              <div>
                <strong>{{ results().length > 1 ? '#' + ($index + 1) + ' ' + r.label + ': ' : '' }}</strong>
                @if (r.status === 'error') {
                  <strong>{{ r.title }}.</strong> {{ r.message }}
                  @if (r.fields?.length) { <ul>@for (f of r.fields; track f[0]) { <li><code>{{ f[0] }}</code>: {{ f[1] }}</li> }</ul> }
                } @else {
                  {{ r.status === 'duplicate' ? 'Already stored: this exact JSON was imported before.' : 'Prediction stored.' }}
                  <a [routerLink]="['/predictions', r.predictionId]">Open prediction</a>
                  @if (r.possibleDuplicateOf) {
                    <div class="warn-text">Looks like a retry of <a [routerLink]="['/predictions', r.possibleDuplicateOf]">an earlier prediction</a>
                      (same model, match, type, minute and picks). Both are stored; reports count only the latest of them.</div>
                  }
                }
              </div>
            </div>
          }

          <div class="row">
            <button type="submit" class="btn btn-primary" aria-describedby="imp-hint" [disabled]="!canSend()">
              <i class="pi" [class.pi-upload]="!busy()" [class.pi-spinner]="busy()" [class.pi-spin]="busy()"></i>
              Send {{ parsed().items.length > 1 ? parsed().items.length + ' predictions' : 'prediction' }}</button>
            @if (results().length && !busy()) { <button type="button" class="btn btn-outline" (click)="importAnother()">Import another</button> }
            <small id="imp-hint" class="warn-text">{{ hint() }}</small>
          </div>
        </form>
      }
    </section>`,
  styles: `
    .steps { margin: .35rem 0 0; padding-left: 1.25rem; display: grid; gap: .2rem; }
    .warn-text { color: var(--mm-warn-ink); display: block; }
    @media (max-width: 640px) { input.input, textarea.input { font-size: 16px; } }`,
})
export class ImportPage {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  readonly provider = signal(ImportPage.storedProvider());
  readonly version = signal('');
  readonly model = signal('');
  readonly text = signal('');
  readonly parsed = computed(() => readAgentOutput(this.text()));
  readonly previews = computed(() => this.parsed().items.map(i => previewOf(i.data)));
  readonly busy = signal(false);
  readonly results = signal<ImportResult[]>([]);
  private readonly models = safeValue(this.api.modelsResource(() => this.auth.isAdmin()), []);
  readonly providers = safeValue(this.api.providersResource(), []);
  private readonly knownProvider = computed(() => this.providers().find(p => p.code === this.provider().trim().toLowerCase()) ?? null);
  readonly providerModels = computed(() => {
    const p = this.knownProvider();
    return p ? this.models().filter(m => m.providerId === p.id) : this.models();
  });
  readonly newProvider = computed(() => !!this.provider().trim() && this.providers().length > 0 && !this.knownProvider());
  /** Model names that would be created: unknown for this provider (every name is new for a new provider). */
  readonly newModels = computed(() => {
    const p = this.knownProvider();
    if (!this.provider().trim() || !this.providers().length) return [];
    const known = new Set((p ? this.providerModels() : []).map(m => norm(m.name)));
    const names = this.previews().map(x => this.modelOf(x)).filter((n): n is string => !!n);
    return [...new Set(names.filter(n => !known.has(norm(n))))];
  });
  /** UX-033: the Model field (sent as the `model` parameter, like X-Model-Name) wins over `model.name` in the JSON. */
  readonly modelNote = computed(() => {
    const field = this.model().trim();
    const fromJson = [...new Set(this.previews().map(p => p.model).filter((m): m is string => !!m))];
    if (field) {
      const other = fromJson.filter(m => norm(m) !== norm(field));
      return `Model sent: ${field} (from the Model field)` + (other.length ? `; the Model field wins over ${this.quoted(other)} in the JSON.` : '.');
    }
    return fromJson.length ? `Model: ${fromJson.join(', ')} (from the JSON).` : '';
  });
  readonly missingModel = computed(() => !this.model().trim() && this.previews().some(p => !p.model));
  readonly hint = computed(() => {
    if (this.busy()) return '';
    if (!this.provider().trim()) return 'Enter the provider to send.';
    if (!this.text().trim()) return 'Paste the agent reply that contains the JSON to send.';
    if (this.parsed().error) return 'Fix the JSON above to send.';
    if (this.missingModel()) return 'Enter the model name (or add model.name to the JSON) to send.';
    return '';
  });
  readonly canSend = computed(() => !this.busy() && !this.hint() && this.parsed().items.length > 0);

  modelOf(p: ImportPreview): string | null { return this.model().trim() || p.model; }
  quoted(names: string[]): string { return names.map(n => `"${n}"`).join(', '); }

  onPaste(text: string): void {
    this.text.set(text);
    this.results.set([]);
    const model = readAgentOutput(text).model;
    if (model) this.model.set(model);
  }

  useExample(): void { this.onPaste(SAMPLE_REPLY); }

  importAnother(): void {
    this.text.set('');
    this.model.set('');
    this.version.set('');
    this.results.set([]);
  }

  /** Sends each prediction in turn, so one failure does not hide the others; stops if the session ends. */
  async send(): Promise<void> {
    if (!this.canSend()) return;
    const items = this.parsed().items;
    const previews = this.previews();
    const provider = this.provider().trim();
    this.busy.set(true);
    this.results.set([]);
    try { localStorage.setItem(PROVIDER_KEY, provider); } catch { /* optional convenience */ }
    for (const [i, item] of items.entries()) {
      try {
        const r = await firstValueFrom(this.api.importPrediction(item.json, provider, this.model().trim(), this.version().trim()));
        this.results.update(l => [...l, { label: previews[i].match, status: r.duplicate ? 'duplicate' : 'stored', predictionId: r.predictionId,
          possibleDuplicateOf: r.possibleDuplicateOf ?? null }]);
      } catch (e) {
        const err = apiError(e);
        this.results.update(l => [...l, failure(previews[i].match, err)]);
        if (err.status === 401) break;
      }
    }
    this.busy.set(false);
  }

  private static storedProvider(): string {
    try { return localStorage.getItem(PROVIDER_KEY) ?? ''; } catch { return ''; }
  }
}
