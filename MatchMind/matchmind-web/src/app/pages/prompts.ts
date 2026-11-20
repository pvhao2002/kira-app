import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { apiError } from '../core/http';
import { PromptTemplate } from '../core/models';
import { errorMessage, safeValue, viewState } from '../core/resource';
import { fmtDateTime, humanize } from '../shared/format';
import { ConfirmService, Dialog, ToastService } from '../shared/kit';
import { ResultTag, StateView } from '../shared/ui';

@Component({
  selector: 'mm-prompts',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
  imports: [FormsModule, Dialog, ResultTag, StateView],
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
          } @empty { <p class="muted-text">No prompt templates yet.</p> }
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
                  <button type="button" class="btn btn-outline btn-sm" (click)="copy()" data-testid="prompt-copy"><i class="pi pi-copy"></i> Copy</button>
                  @if (auth.isAdmin()) { <button type="button" class="btn btn-primary btn-sm" (click)="startEdit()" data-testid="prompt-edit"><i class="pi pi-pencil"></i> Edit</button> }
                } @else {
                  <button type="button" class="btn btn-text btn-sm" (click)="cancel()" data-testid="prompt-cancel">Cancel</button>
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="saving() || !dirty() || !draft().trim()" (click)="save()" data-testid="prompt-save">
                    <i class="pi" [class.pi-check]="!saving()" [class.pi-spinner]="saving()" [class.pi-spin]="saving()"></i> Save</button>
                }
              </div>
            </header>
            @if (conflict()) {
              <div class="alert alert-warn mb-2" role="alert">
                Someone saved a newer version while you were editing. Your text is still here: copy it, then reload to see their changes.
                <button type="button" class="btn btn-text btn-sm" (click)="reloadLatest()">Reload latest</button>
              </div>
            }
            @if (editing()) {
              <div class="stack">
                <div class="field"><label for="pr-desc">Description</label><input class="input w-full" id="pr-desc" [(ngModel)]="draftDescription" maxlength="2000" /></div>
                <label class="check"><input type="checkbox" id="pr-active" [(ngModel)]="draftActive" /> Active</label>
                <textarea class="input" [(ngModel)]="draft" aria-label="Prompt content" spellcheck="false" data-testid="prompt-content"></textarea>
                <small class="muted-text">{{ draft().length }} characters</small>
              </div>
            } @else {
              @if (p.description) { <p class="page-note mb-2">{{ p.description }}</p> }
              @if (p.content.includes(KEY_PLACEHOLDER)) {
                <p class="muted-text">
                  @if (auth.isAdmin()) { Copy fills in <code ngNonBindable>{{EXTERNAL_API_KEY}}</code> with the agent API key. Paste the copy only into your agent. }
                  @else { <code ngNonBindable>{{EXTERNAL_API_KEY}}</code> stands for the agent API key. Ask an admin to copy this prompt for an agent. }
                </p>
              }
              <pre class="prompt-view" data-testid="prompt-view">{{ p.content }}</pre>
            }
          </section>
        }
      </div>
    }

    <mm-dialog [open]="creating()" (closed)="creating.set(false)" header="New prompt template" width="min(720px, 95vw)">
      <form class="stack" (ngSubmit)="create()">
        <div class="field"><label for="np-name">Name</label><input class="input w-full" id="np-name" name="name" [(ngModel)]="newName" maxlength="128" required /></div>
        <div class="field"><label for="np-type">Type</label><input class="input w-full" id="np-type" name="type" [(ngModel)]="newType" placeholder="AI_PREDICTION" />
          <small class="muted-text">Upper-case letters, digits and underscores.</small></div>
        <div class="field"><label for="np-desc">Description</label><input class="input w-full" id="np-desc" name="desc" [(ngModel)]="newDescription" maxlength="2000" /></div>
        <div class="field"><label for="np-content">Content</label><textarea class="input" id="np-content" name="content" [(ngModel)]="newContent" rows="12"></textarea></div>
        @if (createError()) { <div class="field-error">{{ createError() }}</div> }
        <div class="dialog-actions">
          <button type="button" class="btn btn-text" (click)="creating.set(false)">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving() || !newName().trim() || !typeValid() || !newContent().trim()">
            @if (saving()) { <i class="pi pi-spinner pi-spin" aria-hidden="true"></i> } Create template</button>
        </div>
      </form>
    </mm-dialog>`,
})
export class PromptsPage {
  private readonly api = inject(ApiService);
  private readonly messages = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
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
  readonly creating = signal(false);
  readonly createError = signal('');
  readonly fmt = fmtDateTime;
  readonly humanize = humanize;
  readonly draft = signal('');
  readonly draftDescription = signal('');
  readonly draftActive = signal(true);
  /** Version the draft started from; a reload must not move it, or Save would overwrite a newer version. */
  private draftVersion = 0;
  readonly newName = signal('');
  readonly newType = signal('');
  readonly newDescription = signal('');
  readonly newContent = signal('');

  /** Route guard hook (app.routes.ts): leaving with unsaved edits asks first. */
  canLeave(): boolean | Promise<boolean> {
    return !(this.editing() && this.dirty()) || this.confirmDiscard();
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
    if (this.editing() && this.dirty() && !await this.confirmDiscard()) return;
    this.editing.set(false);
    this.conflict.set(false);
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
    this.editing.set(true);
  }

  async cancel(): Promise<void> {
    if (this.dirty() && !await this.confirmDiscard()) return;
    this.editing.set(false);
    this.conflict.set(false);
  }

  save(): void {
    const p = this.selected();
    if (!p) return;
    this.saving.set(true);
    this.api.updatePrompt(p.id, { content: this.draft(), description: this.draftDescription().trim() || null, active: this.draftActive(), expectedVersion: this.draftVersion })
      .subscribe({
        next: updated => {
          this.saving.set(false);
          this.editing.set(false);
          this.promptsRes.update(list => list?.map(x => x.id === updated.id ? updated : x));
          this.messages.add({ severity: 'success', summary: 'Prompt saved', detail: `${updated.name} is now version ${updated.version}.` });
        },
        error: e => {
          this.saving.set(false);
          const err = apiError(e);
          if (err.code === 'PROMPT_VERSION_CONFLICT') this.conflict.set(true);
          else this.messages.add({ severity: 'error', summary: 'Save failed', detail: err.message });
        },
      });
  }

  /** Refreshes from the server; the open draft is kept so nothing typed is lost. */
  reloadLatest(): void {
    this.api.prompts().subscribe({
      next: list => { this.promptsRes.set(list); this.conflict.set(false); },
      error: e => this.messages.add({ severity: 'error', summary: 'Reload failed', detail: apiError(e).message }),
    });
  }

  /** Admins copy what an agent needs, key included; viewers copy the stored text with the key placeholder. */
  readonly KEY_PLACEHOLDER = '{{EXTERNAL_API_KEY}}';

  copy(): void {
    const p = this.selected();
    if (!p) return;
    if (!this.auth.isAdmin()) { this.messages.copy(p.content, 'Prompt'); return; }
    this.api.promptForAgent(p.id).subscribe({
      next: r => this.messages.copy(r.content, 'Prompt with the API key'),
      error: e => this.messages.add({ severity: 'error', summary: 'Copy failed', detail: apiError(e).message }),
    });
  }

  readonly typeValid = computed(() => /^[A-Z][A-Z0-9_]{1,63}$/.test(this.newType().trim()));

  openCreate(): void {
    this.newName.set(''); this.newType.set(''); this.newDescription.set(''); this.newContent.set('');
    this.createError.set('');
    this.creating.set(true);
  }

  create(): void {
    this.saving.set(true);
    this.api.createPrompt({ name: this.newName().trim(), templateType: this.newType().trim(), content: this.newContent(), description: this.newDescription().trim() || null })
      .subscribe({
        next: p => { this.saving.set(false); this.creating.set(false); this.selectedId.set(p.id); this.promptsRes.reload(); this.messages.add({ severity: 'success', summary: 'Template created', detail: p.name }); },
        error: e => { this.saving.set(false); this.createError.set(apiError(e).message); },
      });
  }
}
