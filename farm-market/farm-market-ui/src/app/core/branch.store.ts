import {Service, computed, effect, inject, signal, untracked} from '@angular/core';
import {Api, apiResource} from './api';
import {BRANCHES, Branch, BranchTheme} from './mock-data';

const STORAGE_KEY = 'kirafarm-branch-themes';

function loadThemes(): BranchTheme[] {
  const defaults = BRANCHES.map(b => ({...b.defaultTheme}));
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as BranchTheme[] | null;
    if (Array.isArray(raw) && raw.length === defaults.length) return raw;
  } catch { /* storage may be unavailable */ }
  return defaults;
}

/** GET /branches item. */
interface ApiBranch {
  id: number;
  code: string;
  name: string;
  shortName: string;
  address: string;
  hours: string;
  open: boolean;
  themePrimary: string;
  themeAccent: string;
}

/** Current branch + per-branch theme. An effect writes the theme onto :root CSS variables. */
@Service()
export class BranchStore {
  private readonly api = inject(Api);
  private readonly list = signal<Branch[]>(BRANCHES);

  /** GET /branches (public), requested as soon as the store exists. */
  private readonly remote = apiResource<ApiBranch[]>(() => ({path: '/branches'}), {defaultValue: []});
  private applied = false;

  /** Reactive when read inside templates/computed; replaced by the API list once /branches answers. */
  get branches(): Branch[] {
    return this.list();
  }

  readonly index = signal(0);
  readonly themes = signal<BranchTheme[]>(loadThemes());
  readonly saved = signal(true);

  readonly current = computed(() => this.list()[this.index()] ?? this.list()[0]);
  /** Backend branch id (seeded 1..5 in the same order as BRANCHES). */
  readonly branchId = computed(() => this.index() + 1);
  readonly theme = computed(() => this.themes()[this.index()] ?? this.themes()[0]);

  constructor() {
    effect(() => {
      const t = this.theme();
      const root = document.documentElement.style;
      root.setProperty('--primary', t.primary);
      root.setProperty('--accent', t.accent);
    });
    // Apply the API list once; the local mock values stay if the call fails. Branch index i maps to backend id i + 1.
    effect(() => {
      // value() throws in the error state (mock branches stay in that case).
      const rows = this.remote.hasValue() ? this.remote.value() : [];
      if (this.applied || !rows.length) return;
      untracked(() => this.apply(rows));
    });
  }

  private apply(all: ApiBranch[]): void {
    this.applied = true;
    const rows = [...all].sort((x, y) => x.id - y.id);
    const prev = this.list();
    this.list.set(rows.map((b, i) => ({
      id: b.code.toLowerCase(), prefix: b.code, name: b.name, short: b.shortName, addr: b.address,
      dist: prev[i]?.dist ?? '', hours: b.hours, open: b.open,
      defaultTheme: {primary: b.themePrimary, accent: b.themeAccent}
    })));
    this.themes.set(rows.map(b => ({primary: b.themePrimary, accent: b.themeAccent})));
    this.saved.set(true);
    if (this.index() >= rows.length) this.index.set(0);
  }

  select(i: number): void {
    this.index.set(i);
  }

  themeOf(i: number): BranchTheme {
    return this.themes()[i] ?? this.themes()[0];
  }

  setTheme(key: keyof BranchTheme, value: string): void {
    this.themes.update(all => all.map((t, i) => (i === this.index() ? {...t, [key]: value} : t)));
    this.saved.set(false);
  }

  resetTheme(): void {
    const i = this.index();
    this.themes.update(all => all.map((t, j) => (j === i ? {...this.list()[i].defaultTheme} : t)));
    this.saved.set(false);
  }

  /** Local-only save (kept for backwards compatibility). */
  saveThemes(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.themes()));
    } catch { /* ignore */ }
    this.saved.set(true);
  }

  /** Admin only: PUT /admin/branches/{id}/theme for the current branch. Throws ApiError. */
  async saveTheme(): Promise<void> {
    const t = this.theme();
    await this.api.put(`/admin/branches/${this.branchId()}/theme`, {primary: t.primary, accent: t.accent});
    this.saved.set(true);
  }
}
