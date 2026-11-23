import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { apiErrorText } from '../core/http';
import { IssuedKey, KeyScope, PromptTemplate, Provider, ProviderKey } from '../core/models';
import { safeValue, viewState } from '../core/resource';
import { CopyFallback, CopyService } from '../shared/copy';
import { fmtDateTime, humanize } from '../shared/format';
import { ConfirmService, Dialog, ToastService } from '../shared/kit';
import { listError } from '../shared/paged-list';
import { Select, SelectOption } from '../shared/select';
import { ReasonAction, ReasonDialog, StateView } from '../shared/ui';

const SCOPES: { value: KeyScope; label: string; hint: string }[] = [
  { value: 'PREDICTIONS', label: 'Predictions', hint: 'POST /external/predictions' },
  { value: 'SETTLE_REQUEST', label: 'Settle request', hint: 'POST /external/predictions/settle' },
  { value: 'RESULTS', label: 'Results', hint: 'POST /external/matches/results: only for a trusted results feeder' },
];
const KEY_PLACEHOLDER = '{{EXTERNAL_API_KEY}}';
const NO_PROMPT = `No prompt contains ${KEY_PLACEHOLDER}.`;
const CODE_RULE = /^[a-z0-9_-]{2,64}$/;

/**
 * Providers (UX-019): who may call the agent API. Admins create providers, issue, rotate and revoke their keys, grant
 * scopes, and disable or archive a provider. Viewers see the list only.
 */
@Component({
  selector: 'mm-providers',
  imports: [FormsModule, Dialog, ReasonDialog, Select, StateView, CopyFallback],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <p class="page-note">Each agent calls the API with its own provider key (<code>X-Api-Key: mmk_…</code>). A disabled provider
        or a revoked key is refused on its next call.</p>
      <div class="filter-bar">
        <label class="check"><input type="checkbox" data-testid="show-archived" [checked]="showArchived()" (change)="showArchived.set($any($event.target).checked)" /> Show archived</label>
        @if (auth.isAdmin()) {
          <button type="button" class="btn btn-primary btn-sm" data-testid="add-provider" (click)="openEdit(null)"><i class="pi pi-plus"></i> Add provider</button>
        }
      </div>
      <mm-state [state]="state()" [message]="error()" retryable (retry)="resource.reload()" />
      @if (state() === 'ready') {
        <section class="panel flush">
          <div class="table-wrap tall"><table class="dt compact-sm" aria-label="Providers">
            <thead><tr><th>Code</th><th>Name</th><th>Status</th><th class="num hide-sm">Models</th><th class="num hide-sm">Predictions</th>
              <th class="num">Active keys</th><th class="hide-sm">Last callback</th>
              @if (auth.isAdmin()) { <th class="actions sticky-end"><span class="sr-only">Actions</span></th> }</tr></thead>
            <tbody>
              @for (p of rows(); track p.id) {
                <tr [attr.data-testid]="'provider-' + p.code">
                  <td><code>{{ p.code }}</code></td>
                  <td>{{ p.name }}@if (p.description) { <span class="cell-sub">{{ p.description }}</span> }</td>
                  <td class="nowrap">
                    @if (p.status === 'DISABLED') { <span class="tag tag-danger">Disabled</span> }
                    @else { <span class="tag tag-success">Active</span> }
                    @if (p.archivedAt) { <span class="tag tag-secondary">Archived</span> }
                    @if (p.status === 'DISABLED' && p.disabledReason) { <span class="cell-sub wrap-sub">{{ p.disabledReason }}</span> }</td>
                  <td class="num hide-sm">{{ p.models }}</td><td class="num hide-sm">{{ p.predictions }}</td>
                  <td class="num">{{ p.activeKeys ?? '—' }}</td>
                  <td class="nowrap hide-sm">{{ fmt(p.lastCallbackAt) }}</td>
                  @if (auth.isAdmin()) {
                    <td class="nowrap actions sticky-end">
                      <button type="button" class="btn btn-text btn-sm" (click)="openKeys(p)" [attr.data-testid]="'keys-' + p.code">Keys</button>
                      <button type="button" class="btn btn-text btn-sm" (click)="openEdit(p)">Edit</button>
                      <button type="button" class="btn btn-text btn-sm" [class.danger]="p.status !== 'DISABLED'" (click)="toggleStatus(p)">{{ p.status === 'DISABLED' ? 'Enable' : 'Disable' }}</button>
                      <button type="button" class="btn btn-text btn-sm" [attr.data-testid]="'archive-' + p.code" (click)="toggleArchive(p)">{{ p.archivedAt ? 'Unarchive' : 'Archive' }}</button>
                    </td>
                  }
                </tr>
              } @empty {
                <tr><td [attr.colspan]="auth.isAdmin() ? 8 : 7" class="empty">No providers yet.</td></tr>
              }
            </tbody>
          </table></div>
        </section>
      }
    </div>

    <mm-dialog [open]="!!editing()" [busy]="busy()" [header]="editing()?.id ? 'Edit provider' : 'Add provider'" (closed)="editing.set(null)">
      @if (editing(); as e) {
        <form class="stack" (submit)="$event.preventDefault(); saveEdit()">
          <div class="field"><label for="pv-code">Code</label>
            <input class="input w-full" id="pv-code" name="code" [value]="e.code" [disabled]="!!e.id" maxlength="64" required pattern="[a-z0-9_-]{2,64}"
              [attr.aria-invalid]="!e.id && codeBad(e.code)" aria-describedby="pv-code-hint" (input)="patchEdit({ code: $any($event.target).value })" />
            <small id="pv-code-hint" class="muted-text" [class.err]="!e.id && codeBad(e.code)">2–64 of a-z, 0-9, - and _. It never changes.</small></div>
          <div class="field"><label for="pv-name">Name</label>
            <input class="input w-full" id="pv-name" name="name" [value]="e.name" maxlength="128" required (input)="patchEdit({ name: $any($event.target).value })" /></div>
          <div class="field"><label for="pv-desc">Description</label>
            <textarea class="input w-full" id="pv-desc" name="description" rows="2" maxlength="2000" [value]="e.description" (input)="patchEdit({ description: $any($event.target).value })"></textarea></div>
          @if (formError()) { <div class="field-error" role="alert">{{ formError() }}</div> }
          <div class="dialog-actions">
            <button type="button" class="btn btn-text" (click)="editing.set(null)">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="busy() || !e.name.trim() || !e.code.trim() || (!e.id && codeBad(e.code))">
              @if (busy()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } Save</button>
          </div>
        </form>
      }
    </mm-dialog>

    <mm-dialog [open]="!!keysFor()" [busy]="busy()" [header]="'API keys of ' + (keysFor()?.name ?? '')" width="min(760px, 95vw)" (closed)="askCloseKeys()">
      @if (issued(); as k) {
        <div class="alert alert-warn" role="alert" data-testid="issued-key">
          <strong>You will not see this key again.</strong> Copy it now and give it only to this provider's agent.
        </div>
        <div class="field"><label for="pv-key">New API key</label>
          <div class="password-wrap">
            <input class="input w-full mono" id="pv-key" readonly [type]="revealed() ? 'text' : 'password'" [value]="k.apiKey" autocomplete="off"
              (focus)="$any($event.target).select()" (copy)="keyCopied.set(true)" />
            <button type="button" class="btn btn-text btn-icon" [attr.aria-label]="revealed() ? 'Hide key' : 'Show key'" [attr.aria-pressed]="revealed()" (click)="revealed.set(!revealed())">
              <i class="pi" [class.pi-eye]="!revealed()" [class.pi-eye-slash]="revealed()" aria-hidden="true"></i></button>
          </div></div>
        <div class="row">
          <button type="button" class="btn btn-outline btn-sm" data-testid="copy-key" (click)="copyKey(k)"><i class="pi pi-copy" aria-hidden="true"></i> Copy key</button>
          @if (prompts().length || promptsLoading()) {
            <mm-select size="sm" ariaLabel="Prompt to copy" [options]="promptOptions()" [loading]="promptsLoading()" [emptyText]="noPrompt"
              [ngModel]="promptId()" (ngModelChange)="promptId.set($event)" />
            <button type="button" class="btn btn-outline btn-sm" data-testid="copy-prompt-with-key" [disabled]="!promptId() || copying()" (click)="copyPrompt(k)">
              <i class="pi" [class.pi-file-edit]="!copying()" [class.pi-spinner]="copying()" [class.pi-spin]="copying()" aria-hidden="true"></i> Copy prompt with this key</button>
          } @else { <span class="muted-text" data-testid="no-prompt">{{ promptsError() || noPrompt }}</span> }
        </div>
      }
      @if (keysError()) {
        <div class="alert alert-error mt-2" role="alert" data-testid="keys-error">{{ keysError() }}
          <button type="button" class="btn btn-text btn-sm" (click)="loadKeys()">Retry</button></div>
      }
      @if (keysLoading() && !keys().length) { <div class="mt-2"><mm-state state="loading" [rows]="3" /></div> }
      @else if (!keysError() || keys().length) {
        <div class="table-wrap mt-2"><table class="dt compact-sm" aria-label="API keys" [attr.aria-busy]="keysLoading() || null">
          <thead><tr><th>Key id</th><th class="hide-sm">Label</th><th class="hide-sm">Scopes</th><th>Status</th><th class="hide-sm">Last used</th><th class="actions sticky-end"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            @for (k of keys(); track k.id) {
              <tr>
                <td><code>{{ k.keyId }}</code><span class="cell-sub">{{ fmt(k.createdAt) }}</span></td>
                <td class="hide-sm">{{ k.label ?? '—' }}</td>
                <td class="hide-sm">@for (s of k.scopes; track s) { <span class="tag tag-info">{{ humanize(s) }}</span> }</td>
                <td>@if (k.status === 'ACTIVE') { <span class="tag tag-success">Active</span> } @else { <span class="tag tag-secondary">Revoked</span> }</td>
                <td class="nowrap hide-sm">{{ fmt(k.lastUsedAt) }}</td>
                <td class="nowrap actions sticky-end">
                  @if (k.status === 'ACTIVE') {
                    <button type="button" class="btn btn-text btn-sm" (click)="editScopes(k)">Scopes</button>
                    <button type="button" class="btn btn-text btn-sm" [attr.data-testid]="'rotate-' + k.keyId" (click)="rotate(k)">Rotate</button>
                    <button type="button" class="btn btn-text btn-sm danger" (click)="revoke(k)">Revoke</button>
                  }
                </td>
              </tr>
            } @empty { <tr><td colspan="6" class="empty">No keys yet.</td></tr> }
          </tbody>
        </table></div>
      }
      <form class="stack mt-2" (submit)="$event.preventDefault(); issue()">
        <h3>Issue a key</h3>
        <div class="field"><label for="pv-label">Label</label>
          <input class="input w-full" id="pv-label" name="label" maxlength="128" placeholder="e.g. production agent" [value]="label()" (input)="label.set($any($event.target).value)" /></div>
        <fieldset class="field"><legend>Scopes</legend>
          @for (s of scopeList; track s.value) {
            <div><label class="check"><input type="checkbox" [checked]="newScopes().includes(s.value)" [attr.aria-describedby]="'sc-new-' + s.value" (change)="toggle(newScopes, s.value)" /> {{ s.label }}</label>
              <small class="muted-text scope-hint" [id]="'sc-new-' + s.value">{{ s.hint }}</small></div>
          }
        </fieldset>
        @if (formError()) { <div class="field-error" role="alert">{{ formError() }}</div> }
        <div class="dialog-actions">
          <button type="button" class="btn btn-text" (click)="askCloseKeys()">Close</button>
          <button type="submit" class="btn btn-primary" data-testid="issue-key" [disabled]="busy() || !newScopes().length">
            @if (busy()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } Issue key</button>
        </div>
      </form>
    </mm-dialog>

    <mm-reason-dialog [action]="action()" [ready]="!scopesFor() || scopeDraft().length > 0" (closed)="action.set(null); scopesFor.set(null)">
      @if (scopesFor()) {
        <fieldset class="field"><legend>Scopes</legend>
          @for (s of scopeList; track s.value) {
            <div><label class="check"><input type="checkbox" [checked]="scopeDraft().includes(s.value)" [attr.aria-describedby]="'sc-edit-' + s.value" (change)="toggle(scopeDraft, s.value)" /> {{ s.label }}</label>
              <small class="muted-text scope-hint" [id]="'sc-edit-' + s.value">{{ s.hint }}</small></div>
          }
        </fieldset>
      }
    </mm-reason-dialog>
    <mm-copy-fallback />`,
  styles: `.mono { font-family: var(--mm-mono); } .scope-hint { display: block; margin-left: 1.55rem; } .wrap-sub { white-space: normal; max-width: 16rem; }`,
})
export class ProvidersPage {
  private readonly api = inject(ApiService);
  private readonly messages = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  readonly clipboard = inject(CopyService);
  readonly auth = inject(AuthService);
  readonly resource = this.api.providersResource(true);
  readonly state = viewState(this.resource);
  readonly error = computed(() => (this.resource.error() ? listError(this.resource.error()) : ''));
  private readonly providers = safeValue(this.resource, []);
  readonly showArchived = signal(false);
  readonly rows = computed(() => this.showArchived() ? this.providers() : this.providers().filter(p => !p.archivedAt));
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  readonly scopeList = SCOPES;

  readonly busy = signal(false);
  readonly formError = signal('');
  readonly action = signal<ReasonAction | null>(null);
  readonly editing = signal<{ id: string | null; code: string; name: string; description: string } | null>(null);

  readonly keysFor = signal<Provider | null>(null);
  readonly keys = signal<ProviderKey[]>([]);
  /** The key just issued or rotated: shown once, cleared when the dialog closes. */
  readonly issued = signal<IssuedKey | null>(null);
  readonly label = signal('');
  readonly newScopes = signal<KeyScope[]>(['PREDICTIONS', 'SETTLE_REQUEST']);
  readonly keysLoading = signal(false);
  readonly keysError = signal('');
  readonly prompts = signal<PromptTemplate[]>([]);
  readonly promptOptions = computed<SelectOption[]>(() => this.prompts().map(t => ({ value: t.id, label: t.name })));
  readonly promptsLoading = signal(false);
  readonly promptsError = signal('');
  readonly noPrompt = NO_PROMPT;
  readonly promptId = signal('');
  readonly copying = signal(false);
  /** The issued key is hidden until the admin asks; `keyCopied` says the admin took it (Copy key, Copy prompt or Ctrl+C). */
  readonly revealed = signal(false);
  readonly keyCopied = signal(false);
  readonly scopesFor = signal<ProviderKey | null>(null);
  readonly scopeDraft = signal<KeyScope[]>([]);

  toggle(list: WritableSignal<KeyScope[]>, s: KeyScope): void {
    list.update(v => v.includes(s) ? v.filter(x => x !== s) : SCOPES.map(x => x.value).filter(x => x === s || v.includes(x)));
  }

  openEdit(p: Provider | null): void {
    this.formError.set('');
    this.editing.set({ id: p?.id ?? null, code: p?.code ?? '', name: p?.name ?? '', description: p?.description ?? '' });
  }

  codeBad(code: string): boolean { return !!code.trim() && !CODE_RULE.test(code.trim()); }

  patchEdit(v: Partial<{ code: string; name: string; description: string }>): void {
    this.editing.update(e => e && { ...e, ...v });
  }

  saveEdit(): void {
    const e = this.editing();
    if (!e || this.busy()) return;
    const body = { name: e.name.trim(), description: e.description.trim() || null };
    const req = e.id ? this.api.updateProvider(e.id, { ...body, description: body.description ?? '' })
      : this.api.createProvider({ ...body, code: e.code.trim() });
    this.run(req, () => { this.editing.set(null); this.resource.reload(); this.messages.add({ severity: 'success', summary: 'Saved', detail: body.name }); });
  }

  toggleStatus(p: Provider): void {
    const disable = p.status !== 'DISABLED';
    this.action.set({
      header: `${disable ? 'Disable' : 'Enable'} provider ${p.name}`, label: disable ? 'Disable' : 'Enable', danger: disable,
      message: disable ? 'Every call with its keys (and the shared key naming it) is refused from the next request. Its data stays.'
        : 'Its active keys work again from the next request.',
      run: reason => this.api.updateProvider(p.id, { status: disable ? 'DISABLED' : 'ACTIVE', reason }),
      done: () => this.resource.reload(),
    });
  }

  toggleArchive(p: Provider): void {
    const archive = !p.archivedAt;
    this.action.set({
      header: `${archive ? 'Archive' : 'Unarchive'} provider ${p.name}`, label: archive ? 'Archive' : 'Unarchive', danger: archive,
      message: archive ? 'Its models, matches and predictions leave every list, dropdown and figure. Nothing is deleted, and its callbacks are still accepted.'
        : 'Its models, matches and predictions count again.',
      run: reason => this.api.setArchived('providers', p.id, archive, reason),
      done: () => this.resource.reload(),
    });
  }

  openKeys(p: Provider): void {
    this.keysFor.set(p);
    this.clearIssued();
    this.keys.set([]);
    this.formError.set('');
    this.label.set('');
    this.newScopes.set(['PREDICTIONS', 'SETTLE_REQUEST']);
    this.loadKeys();
    if (!this.prompts().length) {
      this.promptsLoading.set(true);
      this.promptsError.set('');
      this.api.prompts().subscribe({
        next: list => {
          const usable = list.filter(t => t.content.includes(KEY_PLACEHOLDER));
          this.prompts.set(usable);
          this.promptId.set(usable[0]?.id ?? '');
          this.promptsLoading.set(false);
        },
        error: e => { this.promptsLoading.set(false); this.promptsError.set(apiErrorText(e)); },
      });
    }
  }

  private clearIssued(): void {
    this.issued.set(null);
    this.revealed.set(false);
    this.keyCopied.set(false);
  }

  /** X, Close and Esc: a key nobody copied is gone for good, so ask first. */
  async askCloseKeys(): Promise<void> {
    if (this.busy()) return;
    if (this.issued() && !this.keyCopied() && !await this.confirm.ask({
      header: 'Close without copying the key?', acceptLabel: 'Close anyway', danger: true,
      message: 'You have not copied the new key. It is shown only once and cannot be recovered.',
    })) return;
    this.closeKeys();
  }

  closeKeys(): void {
    if (this.busy()) return;
    this.clearIssued();
    this.keysFor.set(null);
    this.keys.set([]);
    this.keysError.set('');
    this.resource.reload();
  }

  issue(): void {
    const p = this.keysFor();
    if (!p || this.busy()) return;
    this.run(this.api.issueKey(p.id, this.label().trim(), this.newScopes()), k => { this.showIssued(k); this.label.set(''); this.loadKeys(); });
  }

  async rotate(k: ProviderKey): Promise<void> {
    const p = this.keysFor();
    if (!p || this.busy()) return;
    const ok = await this.confirm.ask({
      header: `Rotate key ${k.keyId}?`, acceptLabel: 'Rotate', danger: true,
      message: `Key ${k.keyId} stops working now. Its agent is refused until you give it the new key.`,
    });
    if (!ok) return;
    this.run(this.api.rotateKey(p.id, k.id), issued => { this.showIssued(issued); this.loadKeys(); });
  }

  private showIssued(k: IssuedKey): void {
    this.issued.set(k);
    this.revealed.set(false);
    this.keyCopied.set(false);
  }

  async copyKey(k: IssuedKey): Promise<void> {
    const copied = await this.clipboard.copy(k.apiKey, 'API key');
    if (copied && this.issued() === k) this.keyCopied.set(true);
  }

  revoke(k: ProviderKey): void {
    const p = this.keysFor();
    if (!p) return;
    this.action.set({
      header: `Revoke key ${k.keyId}`, label: 'Revoke', danger: true,
      message: 'The agent using this key is refused from its next call. This cannot be undone.',
      run: reason => this.api.revokeKey(p.id, k.id, reason),
      done: () => this.loadKeys(),
    });
  }

  editScopes(k: ProviderKey): void {
    const p = this.keysFor();
    if (!p) return;
    this.scopeDraft.set([...k.scopes]);
    this.scopesFor.set(k);
    this.action.set({
      header: `Scopes of key ${k.keyId}`, label: 'Save',
      message: 'Grant Results only to a trusted results feeder: it can set the final score that settles every pick.',
      run: reason => this.api.setKeyScopes(p.id, k.id, this.scopeDraft(), reason),
      done: () => this.loadKeys(),
    });
  }

  /** The prompt with this key put in here, in the browser: the key is never sent back to the API. */
  async copyPrompt(k: IssuedKey): Promise<void> {
    if (this.copying()) return;
    this.copying.set(true);
    try {
      const r = await firstValueFrom(this.api.promptForAgent(this.promptId(), false));
      if (this.issued() !== k) return;
      const copied = await this.clipboard.copy(r.content.split(KEY_PLACEHOLDER).join(k.apiKey), 'Prompt for the agent');
      if (copied && this.issued() === k) this.keyCopied.set(true);
    } catch (e) {
      this.messages.add({ severity: 'error', summary: 'Copy failed', detail: apiErrorText(e) });
    } finally {
      this.copying.set(false);
    }
  }

  loadKeys(): void {
    const p = this.keysFor();
    if (!p) return;
    this.keysLoading.set(true);
    this.keysError.set('');
    this.api.providerKeys(p.id).subscribe({
      next: k => { if (this.keysFor()?.id !== p.id) return; this.keysLoading.set(false); this.keys.set(k); },
      error: e => { if (this.keysFor()?.id !== p.id) return; this.keysLoading.set(false); this.keysError.set(apiErrorText(e)); },
    });
  }

  private run<T>(req: Observable<T>, ok: (v: T) => void): void {
    this.busy.set(true);
    this.formError.set('');
    req.subscribe({
      next: v => { this.busy.set(false); ok(v); },
      error: e => { this.busy.set(false); this.formError.set(apiErrorText(e)); },
    });
  }
}
