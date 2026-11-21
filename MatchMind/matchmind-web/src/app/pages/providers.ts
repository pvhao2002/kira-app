import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { apiErrorText } from '../core/http';
import { IssuedKey, KeyScope, PromptTemplate, Provider, ProviderKey } from '../core/models';
import { safeValue, viewState } from '../core/resource';
import { CopyFallback, CopyService } from '../shared/copy';
import { fmtDateTime, humanize } from '../shared/format';
import { Dialog, ToastService } from '../shared/kit';
import { listError } from '../shared/paged-list';
import { ReasonAction, ReasonDialog, StateView } from '../shared/ui';

const SCOPES: { value: KeyScope; label: string; hint: string }[] = [
  { value: 'PREDICTIONS', label: 'Predictions', hint: 'POST /external/predictions' },
  { value: 'SETTLE_REQUEST', label: 'Settle request', hint: 'POST /external/predictions/settle' },
  { value: 'RESULTS', label: 'Results', hint: 'POST /external/matches/results: only for a trusted results feeder' },
];
const KEY_PLACEHOLDER = '{{EXTERNAL_API_KEY}}';

/**
 * Providers (UX-019): who may call the agent API. Admins create providers, issue, rotate and revoke their keys, grant
 * scopes, and disable or archive a provider. Viewers see the list only.
 */
@Component({
  selector: 'mm-providers',
  imports: [Dialog, ReasonDialog, StateView, CopyFallback],
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
      <mm-state [state]="state()" [message]="error()" />
      @if (state() === 'error') {
        <button type="button" class="btn btn-outline btn-sm retry" (click)="resource.reload()"><i class="pi pi-refresh"></i> Retry</button>
      }
      @if (state() === 'ready') {
        <section class="panel flush">
          <div class="table-wrap tall"><table class="dt compact-sm" aria-label="Providers">
            <thead><tr><th>Code</th><th>Name</th><th>Status</th><th class="num hide-sm">Models</th><th class="num hide-sm">Predictions</th>
              <th class="num">Active keys</th><th class="hide-sm">Last callback</th>
              @if (auth.isAdmin()) { <th class="actions"><span class="sr-only">Actions</span></th> }</tr></thead>
            <tbody>
              @for (p of rows(); track p.id) {
                <tr [attr.data-testid]="'provider-' + p.code">
                  <td><code>{{ p.code }}</code></td>
                  <td>{{ p.name }}@if (p.description) { <span class="cell-sub">{{ p.description }}</span> }</td>
                  <td class="nowrap">
                    @if (p.status === 'DISABLED') { <span class="tag tag-danger" [title]="p.disabledReason ?? ''">Disabled</span> }
                    @else { <span class="tag tag-success">Active</span> }
                    @if (p.archivedAt) { <span class="tag tag-secondary">Archived</span> }</td>
                  <td class="num hide-sm">{{ p.models }}</td><td class="num hide-sm">{{ p.predictions }}</td>
                  <td class="num">{{ p.activeKeys ?? '—' }}</td>
                  <td class="nowrap hide-sm">{{ fmt(p.lastCallbackAt) }}</td>
                  @if (auth.isAdmin()) {
                    <td class="nowrap actions">
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
            <input class="input w-full" id="pv-code" name="code" [value]="e.code" [disabled]="!!e.id" maxlength="64" required
              aria-describedby="pv-code-hint" (input)="patchEdit({ code: $any($event.target).value })" />
            <small id="pv-code-hint" class="muted-text">2–64 of a-z, 0-9, - and _. It never changes.</small></div>
          <div class="field"><label for="pv-name">Name</label>
            <input class="input w-full" id="pv-name" name="name" [value]="e.name" maxlength="128" required (input)="patchEdit({ name: $any($event.target).value })" /></div>
          <div class="field"><label for="pv-desc">Description</label>
            <textarea class="input w-full" id="pv-desc" name="description" rows="2" maxlength="2000" [value]="e.description" (input)="patchEdit({ description: $any($event.target).value })"></textarea></div>
          @if (formError()) { <div class="field-error" role="alert">{{ formError() }}</div> }
          <div class="dialog-actions">
            <button type="button" class="btn btn-text" (click)="editing.set(null)">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="busy() || !e.name.trim() || !e.code.trim()">Save</button>
          </div>
        </form>
      }
    </mm-dialog>

    <mm-dialog [open]="!!keysFor()" [busy]="busy()" [header]="'API keys of ' + (keysFor()?.name ?? '')" width="min(760px, 95vw)" (closed)="closeKeys()">
      @if (issued(); as k) {
        <div class="alert alert-warn" role="alert" data-testid="issued-key">
          <strong>You will not see this key again.</strong> Copy it now and give it only to this provider's agent.
        </div>
        <div class="field"><label for="pv-key">New API key</label>
          <input class="input w-full mono" id="pv-key" readonly [value]="k.apiKey" (focus)="$any($event.target).select()" /></div>
        <div class="row">
          <button type="button" class="btn btn-outline btn-sm" (click)="clipboard.copy(k.apiKey, 'API key')"><i class="pi pi-copy"></i> Copy key</button>
          <select class="input input-sm" aria-label="Prompt to copy" [value]="promptId()" (change)="promptId.set($any($event.target).value)">
            @for (t of prompts(); track t.id) { <option [value]="t.id">{{ t.name }}</option> }
          </select>
          <button type="button" class="btn btn-outline btn-sm" data-testid="copy-prompt-with-key" [disabled]="!promptId()" (click)="copyPrompt(k)">
            <i class="pi pi-file-edit"></i> Copy prompt with this key</button>
        </div>
      }
      <table class="dt compact-sm mt-2" aria-label="API keys">
        <thead><tr><th>Key id</th><th>Label</th><th>Scopes</th><th>Status</th><th class="hide-sm">Last used</th><th class="actions"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>
          @for (k of keys(); track k.id) {
            <tr>
              <td><code>{{ k.keyId }}</code><span class="cell-sub">{{ fmt(k.createdAt) }}</span></td>
              <td>{{ k.label ?? '—' }}</td>
              <td>@for (s of k.scopes; track s) { <span class="tag tag-info">{{ humanize(s) }}</span> }</td>
              <td>@if (k.status === 'ACTIVE') { <span class="tag tag-success">Active</span> } @else { <span class="tag tag-secondary">Revoked</span> }</td>
              <td class="nowrap hide-sm">{{ fmt(k.lastUsedAt) }}</td>
              <td class="nowrap actions">
                @if (k.status === 'ACTIVE') {
                  <button type="button" class="btn btn-text btn-sm" (click)="editScopes(k)">Scopes</button>
                  <button type="button" class="btn btn-text btn-sm" (click)="rotate(k)">Rotate</button>
                  <button type="button" class="btn btn-text btn-sm danger" (click)="revoke(k)">Revoke</button>
                }
              </td>
            </tr>
          } @empty { <tr><td colspan="6" class="muted-text">No keys yet.</td></tr> }
        </tbody>
      </table>
      <form class="stack mt-2" (submit)="$event.preventDefault(); issue()">
        <h3>Issue a key</h3>
        <div class="field"><label for="pv-label">Label</label>
          <input class="input w-full" id="pv-label" name="label" maxlength="128" placeholder="e.g. production agent" [value]="label()" (input)="label.set($any($event.target).value)" /></div>
        <fieldset class="field"><legend>Scopes</legend>
          @for (s of scopeList; track s.value) {
            <label class="check" [title]="s.hint"><input type="checkbox" [checked]="newScopes().includes(s.value)" (change)="toggle(newScopes, s.value)" /> {{ s.label }}</label>
          }
        </fieldset>
        @if (formError()) { <div class="field-error" role="alert">{{ formError() }}</div> }
        <div class="dialog-actions">
          <button type="button" class="btn btn-text" (click)="closeKeys()">Close</button>
          <button type="submit" class="btn btn-primary" data-testid="issue-key" [disabled]="busy() || !newScopes().length">Issue key</button>
        </div>
      </form>
    </mm-dialog>

    <mm-reason-dialog [action]="action()" [ready]="!scopesFor() || scopeDraft().length > 0" (closed)="action.set(null); scopesFor.set(null)">
      @if (scopesFor()) {
        <fieldset class="field"><legend>Scopes</legend>
          @for (s of scopeList; track s.value) {
            <label class="check" [title]="s.hint"><input type="checkbox" [checked]="scopeDraft().includes(s.value)" (change)="toggle(scopeDraft, s.value)" /> {{ s.label }}</label>
          }
        </fieldset>
      }
    </mm-reason-dialog>
    <mm-copy-fallback />`,
  styles: `.retry { align-self: flex-start; } .mono { font-family: var(--mm-mono); }`,
})
export class ProvidersPage {
  private readonly api = inject(ApiService);
  private readonly messages = inject(ToastService);
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
  readonly prompts = signal<PromptTemplate[]>([]);
  readonly promptId = signal('');
  readonly scopesFor = signal<ProviderKey | null>(null);
  readonly scopeDraft = signal<KeyScope[]>([]);

  toggle(list: WritableSignal<KeyScope[]>, s: KeyScope): void {
    list.update(v => v.includes(s) ? v.filter(x => x !== s) : SCOPES.map(x => x.value).filter(x => x === s || v.includes(x)));
  }

  openEdit(p: Provider | null): void {
    this.formError.set('');
    this.editing.set({ id: p?.id ?? null, code: p?.code ?? '', name: p?.name ?? '', description: p?.description ?? '' });
  }

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
    this.issued.set(null);
    this.formError.set('');
    this.label.set('');
    this.newScopes.set(['PREDICTIONS', 'SETTLE_REQUEST']);
    this.loadKeys();
    if (!this.prompts().length) {
      this.api.prompts().subscribe({ next: list => {
        const usable = list.filter(t => t.content.includes(KEY_PLACEHOLDER));
        this.prompts.set(usable);
        this.promptId.set(usable[0]?.id ?? '');
      } });
    }
  }

  closeKeys(): void {
    if (this.busy()) return;
    this.issued.set(null);
    this.keysFor.set(null);
    this.keys.set([]);
    this.resource.reload();
  }

  issue(): void {
    const p = this.keysFor();
    if (!p || this.busy()) return;
    this.run(this.api.issueKey(p.id, this.label().trim(), this.newScopes()), k => { this.issued.set(k); this.label.set(''); this.loadKeys(); });
  }

  rotate(k: ProviderKey): void {
    const p = this.keysFor();
    if (!p || this.busy()) return;
    this.run(this.api.rotateKey(p.id, k.id), issued => { this.issued.set(issued); this.loadKeys(); });
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
  copyPrompt(k: IssuedKey): void {
    this.api.promptForAgent(this.promptId(), false).subscribe({
      next: r => void this.clipboard.copy(r.content.split(KEY_PLACEHOLDER).join(k.apiKey), 'Prompt for the agent'),
      error: e => this.messages.add({ severity: 'error', summary: 'Copy failed', detail: apiErrorText(e) }),
    });
  }

  private loadKeys(): void {
    const p = this.keysFor();
    if (!p) return;
    this.api.providerKeys(p.id).subscribe({ next: k => this.keys.set(k), error: e => this.formError.set(apiErrorText(e)) });
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
