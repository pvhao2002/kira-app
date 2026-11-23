import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { apiError, apiErrorText } from '../core/http';
import { AgentPrompt, IssuedKey, Provider, PromptTemplate, PromptVersion, PromptVersionSummary } from '../core/models';
import { errorMessage, safeValue, viewState } from '../core/resource';
import { CopyFallback, CopyService } from '../shared/copy';
import { fmtDateTime, humanize } from '../shared/format';
import { ConfirmService, Dialog, ToastService } from '../shared/kit';
import { Select, SelectOption } from '../shared/select';
import { ResultTag, StateView } from '../shared/ui';

/** API limit of `content` (`@Size(max = 200_000)`). */
export const PROMPT_MAX = 200_000;
const DRAFT_KEY = 'matchmind.prompt-draft';
/** The "who is calling" slots the stock prompts leave for X-Provider. */
// ponytail: matches the wording of the shipped templates only; a template that words the slot differently keeps it.
const PROVIDER_SLOT = /<(?:your agent name[^>]*|your provider name|the same provider name that sent the prediction)>/g;
interface Draft { user: string; promptId: string; content: string; description: string; active: boolean; version: number; }

export type DiffLine = { op: ' ' | '-' | '+'; text: string };

/** Line diff from `before` to `after` (LCS over the lines between the common head and tail). */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n'), b = after.split('\n');
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const x = a.slice(head, a.length - tail), y = b.slice(head, b.length - tail);
  const same = (l: string[]) => l.map(text => ({ op: ' ' as const, text }));
  let middle: DiffLine[];
  if (x.length * y.length > 4_000_000) {
    // ponytail: quadratic LCS; above ~2000×2000 changed lines show as one removed block plus one added block.
    middle = [...x.map(text => ({ op: '-' as const, text })), ...y.map(text => ({ op: '+' as const, text }))];
  } else {
    const n = x.length, m = y.length, w = m + 1;
    const lcs = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = x[i] === y[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
    middle = [];
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && x[i] === y[j]) { middle.push({ op: ' ', text: x[i] }); i++; j++; }
      else if (j >= m || (i < n && lcs[(i + 1) * w + j] >= lcs[i * w + j + 1])) middle.push({ op: '-', text: x[i++] });
      else middle.push({ op: '+', text: y[j++] });
    }
  }
  return [...same(a.slice(0, head)), ...middle, ...same(a.slice(a.length - tail))];
}

@Component({
  selector: 'mm-prompts',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
  imports: [FormsModule, Dialog, ResultTag, Select, StateView, CopyFallback],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mm-state [state]="state()" [message]="error()" />
    @if (state() === 'ready') {
      <div class="prompt-layout">
        <aside class="prompt-list" aria-label="Prompt templates">
          @for (p of prompts(); track p.id) {
            <button type="button" class="prompt-item" [class.active]="p.id === selected()?.id" (click)="select(p)" [attr.aria-current]="p.id === selected()?.id">
              <strong>{{ p.name }}</strong>
              <small>{{ humanize(p.templateType) }} · v{{ p.version }}{{ p.active ? '' : ' · inactive' }}</small>
            </button>
          } @empty { <mm-state state="empty" message="No prompt templates yet." icon="pi-file" /> }
          @if (auth.isAdmin()) { <button type="button" class="btn btn-text btn-sm" (click)="openCreate()"><i class="pi pi-plus"></i> New template</button> }
        </aside>

        @if (selected(); as p) {
          <section class="panel prompt-editor">
            <header>
              <div>
                <h2>{{ p.name }}</h2>
                <p class="muted-text">{{ humanize(p.templateType) }} · version {{ p.version }} · last updated {{ fmt(p.updatedAt) }}</p>
              </div>
              <div class="row">
                <mm-result [value]="p.active ? 'ACTIVE' : 'DISABLED'" kind="status" />
                @if (!editing()) {
                  <button type="button" class="btn btn-text btn-sm" (click)="openHistory()" [disabled]="loadingHistory()" data-testid="prompt-history">
                    <i class="pi" [class.pi-history]="!loadingHistory()" [class.pi-spinner]="loadingHistory()" [class.pi-spin]="loadingHistory()" aria-hidden="true"></i> History</button>
                  @if (auth.isAdmin()) {
                    <label for="prompt-provider" class="copy-for">Copy for:</label>
                    <mm-select id="prompt-provider" size="sm" data-testid="prompt-provider" [options]="providerOptions()"
                      [ngModel]="providerId()" (ngModelChange)="providerId.set($event)" />
                  }
                  <button type="button" class="btn btn-outline btn-sm" (click)="copy()" [disabled]="copying()" data-testid="prompt-copy">
                    <i class="pi" [class.pi-copy]="!copying()" [class.pi-spinner]="copying()" [class.pi-spin]="copying()" aria-hidden="true"></i> Copy</button>
                  @if (auth.isAdmin()) { <button type="button" class="btn btn-primary btn-sm" (click)="startEdit()" data-testid="prompt-edit"><i class="pi pi-pencil"></i> Edit</button> }
                } @else {
                  <button type="button" class="btn btn-text btn-sm" (click)="cancel()" data-testid="prompt-cancel">Cancel</button>
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="saving() || !dirty() || !draft().trim() || tooLong()" (click)="save()" data-testid="prompt-save">
                    <i class="pi" [class.pi-check]="!saving()" [class.pi-spinner]="saving()" [class.pi-spin]="saving()"></i> Save</button>
                }
              </div>
            </header>
            @if (restored()) {
              <div class="alert alert-info mb-2" role="status">Restored your unsaved changes from before your session ended. Review them, then Save.</div>
            }
            @if (conflict()) {
              <div class="alert alert-warn mb-2" role="alert">
                Someone saved a newer version while you were editing. Your text is still here: copy it, then reload to see their changes.
                <button type="button" class="btn btn-text btn-sm" [disabled]="reloading()" (click)="reloadLatest()">
                  @if (reloading()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } Reload latest</button>
              </div>
            }
            @if (saveError()) { <div class="alert alert-error mb-2" role="alert" data-testid="prompt-save-error">{{ saveError() }}</div> }
            @if (editing()) {
              <div class="stack">
                <div class="field"><label for="pr-desc">Description</label><input class="input w-full" id="pr-desc" [(ngModel)]="draftDescription" maxlength="2000" /></div>
                <label class="check"><input type="checkbox" id="pr-active" [(ngModel)]="draftActive" /> Active</label>
                <div class="field"><label for="pr-content">Content</label>
                  <textarea class="input" id="pr-content" [(ngModel)]="draft" aria-describedby="pr-count" spellcheck="false" data-testid="prompt-content"></textarea></div>
                <small id="pr-count" class="muted-text" [class.over]="tooLong()">{{ num(draft().length) }} / {{ num(max) }} characters
                  @if (tooLong()) { · shorten it by {{ num(draft().length - max) }} to save }</small>
              </div>
            } @else {
              @if (p.description) { <p class="page-note mb-2">{{ p.description }}</p> }
              @if (p.content.includes(KEY_PLACEHOLDER)) {
                <p class="muted-text">
                  @if (auth.isAdmin()) { Pick a provider, then Copy: its key is rotated (the old one stops working) and the new key goes into
                    <code ngNonBindable>{{EXTERNAL_API_KEY}}</code>. A provider without a key gets the legacy shared key, or a new key when the
                    server has none. Without a provider, Copy uses the shared key. Paste the copy only into that provider's agent. }
                  @else { <code ngNonBindable>{{EXTERNAL_API_KEY}}</code> stands for the agent API key and stays in your copy. Ask an admin to copy this prompt for an agent. }
                </p>
              }
              <pre class="prompt-view" data-testid="prompt-view">{{ p.content }}</pre>
            }
          </section>
        }
      </div>
    }

    <mm-dialog [open]="history() !== null" (closed)="closeHistory()" [header]="'History of ' + (selected()?.name ?? '')" width="min(960px, 95vw)">
      <div class="history-layout">
        <ul class="history-list" aria-label="Versions">
          @for (v of history(); track v.version) {
            <li><button type="button" class="prompt-item" [class.active]="v.version === version()?.version" (click)="viewVersion(v.version)">
              <strong>v{{ v.version }}@if (v.version === selected()?.version) { · current }</strong>
              <small>{{ fmt(v.createdAt) }} · {{ v.updatedByUsername ?? 'system' }}</small>
            </button></li>
          } @empty { <li class="muted-text">No earlier versions.</li> }
        </ul>
        <div class="stack">
          @if (loadingVersion()) { <mm-state state="loading" [rows]="4" /> }
          @else if (version(); as v) {
            <div class="row">
              <label class="check"><input type="checkbox" [checked]="showFull()" (change)="showFull.set(!showFull())" /> Show full text</label>
              @if (auth.isAdmin() && v.version !== selected()?.version) {
                <button type="button" class="btn btn-primary btn-sm" [disabled]="restoring()" (click)="restore()" data-testid="prompt-restore">
                  <i class="pi" [class.pi-replay]="!restoring()" [class.pi-spinner]="restoring()" [class.pi-spin]="restoring()"></i> Restore v{{ v.version }}</button>
              }
            </div>
            @if (showFull()) { <pre class="prompt-view">{{ v.content }}</pre> }
            @else {
              <p class="muted-text">Changes from v{{ v.version }} to the current version (v{{ selected()?.version }}): <span class="d-del">− removed</span> <span class="d-add">+ added</span></p>
              <pre class="prompt-view diff" data-testid="prompt-diff">@for (l of diff(); track $index) {<span [class.d-del]="l.op === '-'" [class.d-add]="l.op === '+'">{{ l.op }} {{ l.text }}
</span>}</pre>
            }
          } @else { <p class="muted-text">Pick a version to compare it with the current text.</p> }
          @if (historyError()) { <div class="alert alert-error" role="alert">{{ historyError() }}</div> }
        </div>
      </div>
    </mm-dialog>

    <mm-dialog [open]="creating()" [busy]="saving()" (closed)="closeCreate()" header="New prompt template" width="min(720px, 95vw)">
      <form class="stack" (ngSubmit)="create()">
        <div class="field"><label for="np-name">Name</label><input class="input w-full" id="np-name" name="name" [(ngModel)]="newName" maxlength="128" required /></div>
        <div class="field"><label for="np-type">Type</label><input class="input w-full" id="np-type" name="type" [(ngModel)]="newType" placeholder="AI_PREDICTION"
            [attr.aria-invalid]="typeBad()" aria-describedby="np-type-hint" />
          <small id="np-type-hint" class="muted-text" [class.err]="typeBad()">Upper-case letters, digits and underscores; starts with a letter, 2–64 characters.</small></div>
        <div class="field"><label for="np-desc">Description</label><input class="input w-full" id="np-desc" name="desc" [(ngModel)]="newDescription" maxlength="2000" /></div>
        <div class="field"><label for="np-content">Content</label><textarea class="input mono" id="np-content" name="content" [(ngModel)]="newContent" rows="12"></textarea>
          <small class="muted-text" [class.err]="newContent().length > max">{{ num(newContent().length) }} / {{ num(max) }} characters</small></div>
        @if (createError()) { <div class="field-error" role="alert">{{ createError() }}</div> }
        <div class="dialog-actions">
          <button type="button" class="btn btn-text" (click)="closeCreate()">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving() || !newName().trim() || !typeValid() || !newContent().trim() || newContent().length > max">
            @if (saving()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } Create template</button>
        </div>
      </form>
    </mm-dialog>
    <mm-copy-fallback />`,
  styles: `
    .history-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 1rem; }
    .history-list { list-style: none; margin: 0; padding: 0; max-height: 60vh; overflow: auto; display: grid; gap: .25rem; }
    .d-del { background: var(--mm-loss-soft); color: var(--mm-loss-ink); }
    .d-add { background: var(--mm-win-soft); color: var(--mm-win-ink); }
    .over { color: var(--mm-loss); }
    .copy-for { font-size: var(--fs-sm); color: var(--mm-ink-2); }
    .mono { font-family: var(--mm-mono); font-size: var(--fs-sm); }
    .diff span { display: block; }
    @media (max-width: 900px) { .prompt-list { max-height: 30vh; overflow: auto; } }
    @media (max-width: 700px) { .history-layout { grid-template-columns: 1fr; } .history-list { max-height: 30vh; } }`,
})
export class PromptsPage {
  private readonly api = inject(ApiService);
  private readonly messages = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly clipboard = inject(CopyService);
  readonly auth = inject(AuthService);
  private readonly promptsRes = this.api.promptsResource();
  readonly state = viewState(this.promptsRes);
  readonly error = errorMessage(this.promptsRes);
  readonly prompts = safeValue(this.promptsRes, []);
  /** The open template: kept across reloads while it still exists, else the first one. */
  readonly selectedId = linkedSignal<PromptTemplate[], string | null>({
    source: this.prompts,
    computation: (list, prev) => (prev && list.some(p => p.id === prev.value) ? prev.value : list[0]?.id ?? null),
  });
  readonly selected = computed(() => this.prompts().find(p => p.id === this.selectedId()) ?? null);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly conflict = signal(false);
  readonly saveError = signal('');
  readonly restored = signal(false);
  readonly creating = signal(false);
  readonly createError = signal('');
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  readonly max = PROMPT_MAX;
  readonly num = (n: number) => n.toLocaleString('en-US');
  readonly draft = signal('');
  readonly draftDescription = signal('');
  readonly draftActive = signal(true);
  readonly tooLong = computed(() => this.draft().length > PROMPT_MAX);
  /** Version the draft started from; a reload must not move it, or Save would overwrite a newer version. */
  private draftVersion = 0;
  readonly newName = signal('');
  readonly newType = signal('');
  readonly newDescription = signal('');
  readonly newContent = signal('');
  readonly history = signal<PromptVersionSummary[] | null>(null);
  readonly version = signal<PromptVersion | null>(null);
  readonly showFull = signal(false);
  readonly restoring = signal(false);
  readonly reloading = signal(false);
  readonly loadingHistory = signal(false);
  readonly loadingVersion = signal(false);
  /** The version the user clicked last: an older response must not replace it. */
  private wantedVersion = 0;
  readonly historyError = signal('');
  readonly diff = computed(() => {
    const v = this.version(), p = this.selected();
    return v && p ? lineDiff(v.content, p.content) : [];
  });

  constructor() {
    // A draft kept when the session ended mid-edit (UX-048) comes back once the templates are loaded.
    let checked = false;
    effect(() => {
      const list = this.prompts();
      if (checked || this.state() !== 'ready') return;
      checked = true;
      this.restoreDraft(list);
    });
  }

  /** Route guard hook (app.routes.ts): leaving with unsaved edits asks first. */
  canLeave(): boolean | Promise<boolean> {
    if (!(this.editing() && this.dirty())) return true;
    // The session ended (401, expiry, sign-out): nobody can answer a dialog on the way to login, so keep the draft.
    if (!this.auth.isAuthenticated()) { this.keepDraft(); return true; }
    return this.confirmDiscard();
  }

  private confirmDiscard(): Promise<boolean> {
    return this.confirm.ask({ header: 'Discard changes?', message: 'You have unsaved changes to this prompt.', acceptLabel: 'Discard', danger: true });
  }

  onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.editing() && this.dirty()) e.preventDefault();
  }

  readonly dirty = computed(() => {
    const p = this.selected();
    return !!p && (this.draft() !== p.content || this.draftDescription() !== (p.description ?? '') || this.draftActive() !== p.active);
  });

  async select(p: PromptTemplate): Promise<void> {
    if (p.id === this.selectedId()) return; // already open: nothing to discard
    if (this.editing() && this.dirty() && !await this.confirmDiscard()) return;
    this.editing.set(false);
    this.conflict.set(false);
    this.restored.set(false);
    this.saveError.set('');
    this.selectedId.set(p.id);
  }

  startEdit(): void {
    const p = this.selected();
    if (!p) return;
    this.draft.set(p.content);
    this.draftDescription.set(p.description ?? '');
    this.draftActive.set(p.active);
    this.draftVersion = p.version;
    this.conflict.set(false);
    this.saveError.set('');
    this.editing.set(true);
  }

  async cancel(): Promise<void> {
    if (this.dirty() && !await this.confirmDiscard()) return;
    this.editing.set(false);
    this.conflict.set(false);
    this.restored.set(false);
    this.saveError.set('');
  }

  save(): void {
    const p = this.selected();
    if (!p || this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');
    this.api.updatePrompt(p.id, { content: this.draft(), description: this.draftDescription().trim() || null, active: this.draftActive(), expectedVersion: this.draftVersion })
      .subscribe({
        next: updated => {
          this.saving.set(false);
          this.editing.set(false);
          this.restored.set(false);
          this.promptsRes.update(list => list?.map(x => x.id === updated.id ? updated : x));
          this.messages.add({ severity: 'success', summary: 'Prompt saved', detail: `${updated.name} is now version ${updated.version}.` });
        },
        error: e => {
          this.saving.set(false);
          const err = apiError(e);
          if (err.status === 401) return; // the session ended: the guard keeps the draft on the way to login
          if (err.code === 'PROMPT_VERSION_CONFLICT') this.conflict.set(true);
          else this.saveError.set(apiErrorText(e));
        },
      });
  }

  /** Refreshes from the server; the open draft is kept so nothing typed is lost. */
  reloadLatest(): void {
    if (this.reloading()) return;
    this.reloading.set(true);
    this.api.prompts().subscribe({
      next: list => { this.reloading.set(false); this.promptsRes.set(list); this.conflict.set(false); },
      error: e => { this.reloading.set(false); this.messages.add({ severity: 'error', summary: 'Reload failed', detail: apiError(e).message }); },
    });
  }

  readonly KEY_PLACEHOLDER = '{{EXTERNAL_API_KEY}}';
  /** Admins copy for one provider; viewers never load the list. */
  private readonly providersRes = this.api.providersResource(false, () => this.auth.isAdmin());
  private readonly providerList = safeValue(this.providersRes, []);
  readonly providers = computed(() => this.providerList().filter(p => p.status !== 'DISABLED'));
  readonly providerOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Any agent (shared key)' }, ...this.providers().map(pv => ({ value: pv.id, label: pv.name })),
  ]);
  readonly providerId = signal('');
  readonly copying = signal(false);

  /** Copies what an agent needs: the server fills in the URLs, and the key for admins (`keyRendered`). */
  copy(): void {
    const p = this.selected();
    if (!p || this.copying()) return;
    const provider = this.providers().find(x => x.id === this.providerId());
    if (provider) { void this.copyForProvider(p, provider); return; }
    this.copying.set(true);
    this.api.promptForAgent(p.id).subscribe({
      next: r => {
        this.copying.set(false);
        const keyLeft = !r.keyRendered && r.content.includes(this.KEY_PLACEHOLDER);
        void this.clipboard.copy(r.content, keyLeft ? 'Prompt' : 'Prompt for the agent', keyLeft ? {
          severity: 'warn', summary: 'Copied without the API key',
          detail: this.auth.isAdmin()
            ? `${this.KEY_PLACEHOLDER} is still in the text: no shared key is set. Issue a key on Providers and use "Copy prompt with this key" there.`
            : `${this.KEY_PLACEHOLDER} is still in the text: the agent cannot call the API until an admin copies the prompt or fills in the key.`,
        } : undefined);
      },
      error: e => { this.copying.set(false); this.messages.add({ severity: 'error', summary: 'Copy failed', detail: apiError(e).message }); },
    });
  }

  /**
   * Provider keys are stored hashed, so the one in use cannot be read back: rotate it (after a confirm), or, when the
   * provider has none, use the shared key, or issue a first key when the server has no shared key either. A new key is
   * put into the text here in the browser and never sent back to the API.
   */
  private async copyForProvider(p: PromptTemplate, provider: Provider): Promise<void> {
    this.copying.set(true);
    try {
      const active = (await firstValueFrom(this.api.providerKeys(provider.id))).filter(k => k.status === 'ACTIVE');
      let content: string;
      if (active.length) {
        const k = [...active].sort((a, b) => (b.lastUsedAt ?? b.createdAt).localeCompare(a.lastUsedAt ?? a.createdAt))[0];
        const ok = await this.confirm.ask({
          header: `Rotate key ${k.keyId}?`, acceptLabel: 'Rotate and copy', danger: true,
          message: `${provider.name}'s key ${k.keyId} stops working now. Its agent is refused until you paste this new prompt into it.`,
        });
        if (!ok) return;
        content = await this.withKey(p, this.api.rotateKey(provider.id, k.id));
      } else {
        const r = await firstValueFrom(this.api.promptForAgent(p.id));
        content = r.keyRendered ? r.content
          : await this.withKey(p, this.api.issueKey(provider.id, 'Prompt Notes copy', ['PREDICTIONS', 'SETTLE_REQUEST']));
      }
      void this.clipboard.copy(content.replace(PROVIDER_SLOT, provider.code), `Prompt for ${provider.name}`);
    } catch (e) {
      this.messages.add({ severity: 'error', summary: 'Copy failed', detail: apiErrorText(e) });
    } finally {
      this.copying.set(false);
    }
  }

  /**
   * The prompt without the shared key, with the key just issued or rotated put in its place. The text is fetched first:
   * once the key exists, only the clipboard (with its manual fallback) stands between it and the admin.
   */
  private async withKey(p: PromptTemplate, issue: Observable<IssuedKey>): Promise<string> {
    const r: AgentPrompt = await firstValueFrom(this.api.promptForAgent(p.id, false));
    const k = await firstValueFrom(issue);
    return r.content.split(this.KEY_PLACEHOLDER).join(k.apiKey);
  }

  openHistory(): void {
    const p = this.selected();
    if (!p || this.loadingHistory()) return;
    this.version.set(null);
    this.showFull.set(false);
    this.historyError.set('');
    this.loadingHistory.set(true);
    this.api.promptVersions(p.id).subscribe({
      next: list => { this.loadingHistory.set(false); this.history.set(list); },
      error: e => { this.loadingHistory.set(false); this.messages.add({ severity: 'error', summary: 'Could not load the history', detail: apiError(e).message }); },
    });
  }

  closeHistory(): void { this.history.set(null); this.version.set(null); this.loadingVersion.set(false); this.wantedVersion = 0; }

  viewVersion(v: number): void {
    const p = this.selected();
    if (!p) return;
    this.historyError.set('');
    this.version.set(null);
    this.loadingVersion.set(true);
    this.wantedVersion = v;
    this.api.promptVersion(p.id, v).subscribe({
      next: version => { if (this.wantedVersion !== v) return; this.loadingVersion.set(false); this.version.set(version); },
      error: e => { if (this.wantedVersion !== v) return; this.loadingVersion.set(false); this.historyError.set(apiError(e).message); },
    });
  }

  /** Saves the viewed version again as the newest one, unless someone saved in between (409). */
  async restore(): Promise<void> {
    const p = this.selected(), v = this.version();
    if (!p || !v || this.restoring()) return;
    const ok = await this.confirm.ask({
      header: `Restore v${v.version}?`, acceptLabel: 'Restore',
      message: `v${v.version} becomes the new live version of ${p.name}. Agents pick up its text from their next copy.`,
    });
    if (!ok) return;
    this.restoring.set(true);
    this.api.restorePromptVersion(p.id, v.version, p.version).subscribe({
      next: updated => {
        this.restoring.set(false);
        this.promptsRes.update(list => list?.map(x => x.id === updated.id ? updated : x));
        this.closeHistory();
        this.messages.add({ severity: 'success', summary: 'Version restored', detail: `v${v.version} is now version ${updated.version} of ${updated.name}.` });
      },
      error: e => {
        this.restoring.set(false);
        const err = apiError(e);
        if (err.code === 'PROMPT_VERSION_CONFLICT') {
          this.historyError.set('Someone saved a newer version meanwhile. The list was reloaded: compare again, then restore.');
          this.reloadLatest();
        } else this.historyError.set(apiErrorText(e));
      },
    });
  }

  readonly typeValid = computed(() => /^[A-Z][A-Z0-9_]{1,63}$/.test(this.newType().trim()));
  readonly typeBad = computed(() => !!this.newType().trim() && !this.typeValid());
  private readonly createDirty = computed(() => !!(this.newName().trim() || this.newType().trim() || this.newDescription().trim() || this.newContent().trim()));

  /** X, Cancel and Esc: typed text is not thrown away without asking. */
  async closeCreate(): Promise<void> {
    if (this.createDirty() && !await this.confirmDiscard()) return;
    this.creating.set(false);
  }

  openCreate(): void {
    this.newName.set(''); this.newType.set(''); this.newDescription.set(''); this.newContent.set('');
    this.createError.set('');
    this.creating.set(true);
  }

  create(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.api.createPrompt({ name: this.newName().trim(), templateType: this.newType().trim(), content: this.newContent(), description: this.newDescription().trim() || null })
      .subscribe({
        next: p => { this.saving.set(false); this.creating.set(false); this.selectedId.set(p.id); this.promptsRes.reload(); this.messages.add({ severity: 'success', summary: 'Template created', detail: p.name }); },
        error: e => { this.saving.set(false); this.createError.set(apiErrorText(e)); },
      });
  }

  /** Kept in this tab's sessionStorage only, tagged with the user, and removed once read back. */
  private keepDraft(): void {
    const p = this.selected();
    if (!p || !this.editor) return;
    const d: Draft = { user: this.editor, promptId: p.id, content: this.draft(), description: this.draftDescription(), active: this.draftActive(), version: this.draftVersion };
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* storage full or blocked: nothing more to do */ }
  }

  /** The user is gone from AuthService once the session ended, so remember who opened the page. */
  private readonly editor = this.auth.user()?.username ?? null;

  private restoreDraft(list: PromptTemplate[]): void {
    let d: Draft | null = null;
    try { d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null; sessionStorage.removeItem(DRAFT_KEY); } catch { return; }
    if (!d || d.user !== this.auth.user()?.username || !this.auth.isAdmin() || !list.some(p => p.id === d.promptId)) return;
    this.selectedId.set(d.promptId);
    this.draft.set(d.content);
    this.draftDescription.set(d.description);
    this.draftActive.set(d.active);
    this.draftVersion = d.version;
    this.editing.set(true);
    this.restored.set(true);
  }
}
