import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, ApiError, useApi } from '../api';
import { useAuth } from '../auth';
import { ErrorBox } from '../components/Badge';
import { Markdown, useMarkdown } from '../components/Markdown';
import { ago } from '../format';
import { DIFFICULTY_LABEL, type Category, type Difficulty } from '../types';

const DRAFT_KEY = 'ks-question-draft';
const LANGS = ['Java 21', 'PostgreSQL', 'Go 1.22', 'Python 3.12', 'TypeScript'];
const COMPANIES = ['Google', 'Amazon', 'Meta', 'Stripe', 'Fintech / HFT'];
const URGENCY = [
  { value: 'interview', title: 'Upcoming Interview (< 48 hours)', note: 'Fast-tracks the question to the top of the review queue', badge: 'High Priority' },
  { value: 'standard', title: 'Standard Track Prep & Review', note: 'Standard review cycle (usually 4–12 hours)' },
  { value: 'research', title: 'Deep Architecture Research', note: 'Thorough benchmark analysis & source references' },
] as const;

type Form = { title: string; domain: string; difficulty: Difficulty; context: string; code: string; codeLang: string; companies: string[]; urgency: string };
const empty: Form = { title: '', domain: '', difficulty: 'senior', context: '', code: '', codeLang: 'Java 21', companies: [], urgency: 'standard' };

const loadDraft = (): Form => {
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') };
  } catch {
    return empty;
  }
};

const field = 'w-full px-3 py-2.5 bg-[#0f172a] text-on-surface placeholder:text-outline font-body-md text-body-md rounded-lg border border-[#334155] focus:outline-none focus:border-[#6366f1] transition-colors';
const label = 'font-title-md text-title-md text-on-surface';

type Similar = { slug: string; title: string; summary: string; category: string; match: number };
type Mine = { id: number; title: string; status: string; createdAt: number; articleSlug: string | null; articleStatus: string | null };

export function Ask() {
  const { user, openAuth } = useAuth();
  const [form, setForm] = useState<Form>(loadDraft);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const [done, setDone] = useState(false);
  const [similarQ, setSimilarQ] = useState(form.title);
  const { data: categories } = useApi<Category[]>('/categories');
  const { data: similar } = useApi<Similar[]>(similarQ.length >= 8 ? `/questions/similar?q=${encodeURIComponent(similarQ)}` : null);
  const mine = useApi<Mine[]>(user ? '/questions/mine' : null);
  const { html } = useMarkdown(`${form.context}${form.code ? `\n\n\`\`\`\n${form.code}\n\`\`\`` : ''}`);

  useEffect(() => {
    const t = setTimeout(() => setSimilarQ(form.title), 500);
    return () => clearTimeout(t);
  }, [form.title]);
  useEffect(() => {
    if (!form.domain && categories?.length) setForm((f) => ({ ...f, domain: categories[0].slug }));
  }, [categories, form.domain]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleCompany = (c: string) => set('companies', form.companies.includes(c) ? form.companies.filter((x) => x !== c) : [...form.companies, c]);

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setSaved('Draft saved on this device');
    } catch {
      setSaved('Could not save the draft in this browser');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return openAuth();
    setBusy(true);
    setError('');
    try {
      await api('/questions', { body: form });
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setForm({ ...empty, domain: form.domain });
      setDone(true);
      mine.reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) openAuth();
      setError(err instanceof Error ? err.message : 'Could not submit');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-space-lg max-w-[1280px] mx-auto">
      <form onSubmit={submit} className="xl:col-span-2 flex flex-col gap-space-lg">
        <div>
          <div className="flex items-center gap-1 text-on-surface-variant font-body-sm text-body-sm mb-2">
            Community <span className="material-symbols-outlined text-title-md">chevron_right</span> <span className="text-primary">Submit Question</span>
          </div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">Submit a Technical Concept or Interview Question</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2 max-w-[68ch]">
            Stuck on a tricky system design problem, concurrency race condition, or framework quirk? Submit it for a curated breakdown and staff engineer verification.
          </p>
        </div>

        {done && (
          <div role="status" className="flex items-center gap-3 p-space-md rounded-xl bg-secondary-container/15 border border-secondary/30 text-secondary font-body-sm text-body-sm">
            <span className="material-symbols-outlined">task_alt</span> Question submitted to the knowledge pipeline. Track it under “Your questions”.
          </div>
        )}

        <section className="p-space-lg rounded-xl bg-surface-container-low flex flex-col gap-space-lg">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-baseline">
              <label htmlFor="q-title" className={label}>Question Title</label>
              <span className="font-label-caps text-label-caps text-outline">{form.title.length} / 120</span>
            </div>
            <input id="q-title" className={field} maxLength={120} required minLength={10} placeholder="e.g. How does REQUIRES_NEW interact with an outer rollback?" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
            <div className="flex flex-col gap-2">
              <label htmlFor="q-domain" className={label}>Primary Domain</label>
              <select id="q-domain" className={field} value={form.domain} onChange={(e) => set('domain', e.target.value)}>
                {categories?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className={`${label} mb-2`}>Target Difficulty</legend>
              <div className="grid grid-cols-4 gap-1 p-1 bg-[#0f172a] rounded-lg border border-[#334155]">
                {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
                  <button key={d} type="button" aria-pressed={form.difficulty === d} onClick={() => set('difficulty', d)} className={`py-1.5 rounded-md font-badge-label text-badge-label ${form.difficulty === d ? 'bg-[#6366f1] text-white' : 'text-on-surface-variant hover:text-on-surface'}`}>
                    {DIFFICULTY_LABEL[d].split(' ')[0].replace('-Level', '')}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-baseline flex-wrap gap-2">
              <label htmlFor="q-context" className={label}>Context & Architectural Details</label>
              <span className="flex items-center gap-1 font-label-caps text-label-caps text-secondary"><span className="material-symbols-outlined text-title-md">check</span>Markdown supported</span>
            </div>
            <p className="font-body-sm text-body-sm text-outline -mt-1">Describe the expected vs actual behavior, race condition, or interview scenario.</p>
            <textarea id="q-context" className={`${field} min-h-40 font-body-sm`} required minLength={20} value={form.context} onChange={(e) => set('context', e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="q-code" className={label}>Minimal Code Sample / Stack Trace</label>
            <div className="rounded-lg border border-[#1e293b] bg-[#0d1117] overflow-hidden">
              <div className="h-9 px-3 flex items-center gap-2 border-b border-[#1e293b] overflow-x-auto">
                <span className="font-label-caps text-label-caps text-outline">SYNTAX:</span>
                {LANGS.map((l) => (
                  <button key={l} type="button" onClick={() => set('codeLang', l)} className={`px-2 py-0.5 rounded font-label-caps text-label-caps whitespace-nowrap ${form.codeLang === l ? 'bg-[#1e293b] text-[#818cf8]' : 'text-outline hover:text-on-surface'}`}>{l}</button>
                ))}
              </div>
              <textarea id="q-code" spellCheck={false} className="w-full min-h-36 p-3 bg-transparent font-code-block text-code-block text-on-surface focus:outline-none" placeholder="@Transactional(propagation = Propagation.REQUIRED) ..." value={form.code} onChange={(e) => set('code', e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className={label}>Company / Domain Archetypes</span>
            <div className="flex flex-wrap gap-2">
              {COMPANIES.map((c) => (
                <button key={c} type="button" aria-pressed={form.companies.includes(c)} onClick={() => toggleCompany(c)} className={`px-3 py-1 rounded-full border font-badge-label text-badge-label ${form.companies.includes(c) ? 'border-[#6366f1] text-[#818cf8] bg-[#6366f1]/10' : 'border-[#334155] text-on-surface-variant hover:text-on-surface'}`}>{c}</button>
              ))}
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className={`${label} mb-2`}>Verification Urgency</legend>
            {URGENCY.map((u) => (
              <label key={u.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${form.urgency === u.value ? 'border-[#6366f1] bg-[#6366f1]/5' : 'border-[#334155] hover:bg-surface-container'}`}>
                <input type="radio" name="urgency" className="mt-1 accent-[#6366f1]" checked={form.urgency === u.value} onChange={() => set('urgency', u.value)} />
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-body-md text-body-md text-on-surface">{u.title}{'badge' in u && <span className="px-2 py-0.5 rounded-full bg-[rgba(245,158,11,0.12)] text-[#fbbf24] font-badge-label text-badge-label">{u.badge}</span>}</span>
                  <span className="block font-body-sm text-body-sm text-outline">{u.note}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </section>

        {error && <ErrorBox message={error} />}
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <div className="flex items-center gap-2">
            <button type="button" onClick={saveDraft} className="flex items-center gap-1.5 px-space-md h-9 rounded-lg border border-[#334155] hover:bg-[#1e293b] text-on-surface font-badge-label text-badge-label"><span className="material-symbols-outlined text-title-md">save</span>Save Draft</button>
            <button type="button" aria-pressed={preview} onClick={() => setPreview((p) => !p)} className="flex items-center gap-1.5 px-space-md h-9 rounded-lg border border-[#334155] hover:bg-[#1e293b] text-on-surface font-badge-label text-badge-label"><span className="material-symbols-outlined text-title-md">visibility</span>{preview ? 'Hide Preview' : 'Preview'}</button>
            {saved && <span role="status" className="font-body-sm text-body-sm text-outline">{saved}</span>}
          </div>
          <button type="submit" disabled={busy} className="flex items-center gap-2 px-space-lg h-10 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white font-badge-label text-badge-label font-semibold disabled:opacity-60">
            {user ? (busy ? 'Submitting…' : 'Submit to Knowledge Pipeline') : 'Sign in to Submit'}<span className="material-symbols-outlined text-title-md">arrow_forward</span>
          </button>
        </div>

        {preview && (
          <section aria-label="Preview" className="p-space-lg rounded-xl border border-dashed border-[#334155]">
            <span className="font-label-caps text-label-caps text-outline">PREVIEW MODE · How reviewers will see your inquiry</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface mt-2 mb-space-md">{form.title || 'Sample Title'}</h2>
            {form.context || form.code ? <Markdown html={html} /> : <p className="text-outline font-body-sm text-body-sm">No content provided yet.</p>}
          </section>
        )}
      </form>

      <aside className="flex flex-col gap-space-md">
        <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-3">
          <span className="flex items-center gap-2 font-title-md text-title-md text-on-surface"><span className="material-symbols-outlined text-[#fbbf24]">tips_and_updates</span>Crafting High-Yield Questions</span>
          {[
            ['State explicit constraints:', 'thread counts, database versions, network latency, or memory ceilings.'],
            ['Minimal runnable snippets:', 'strip proprietary boilerplate; keep only the critical path.'],
            ['Detail observed behavior:', 'exceptions thrown, deadlocks, or why the current solution fails at scale.'],
          ].map(([b, t]) => (
            <p key={b} className="flex gap-2 font-body-sm text-body-sm text-on-surface-variant"><span className="material-symbols-outlined text-secondary text-title-md">check_circle</span><span><strong className="text-on-surface">{b}</strong> {t}</span></p>
          ))}
        </div>

        <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-3">
          <span className="flex items-center gap-2 font-title-md text-title-md text-on-surface"><span className="material-symbols-outlined text-primary">find_in_page</span>Similar Answered Topics</span>
          <p className="font-body-sm text-body-sm text-on-surface-variant">These deep-dives might answer your question immediately:</p>
          {similarQ.length < 8 ? (
            <p className="font-body-sm text-body-sm text-outline">Start typing a title to search the library.</p>
          ) : !similar?.length ? (
            <p className="font-body-sm text-body-sm text-outline">No close matches yet.</p>
          ) : (
            similar.map((s) => (
              <Link key={s.slug} to={`/articles/${s.slug}`} className="block p-3 rounded-lg bg-surface-container hover:bg-surface-container-high">
                <span className="flex justify-between font-label-caps text-label-caps"><span className="text-outline uppercase">{s.category}</span><span className="text-secondary">{s.match}% Match</span></span>
                <span className="block font-body-sm text-body-sm text-on-surface font-semibold mt-1">{s.title}</span>
              </Link>
            ))
          )}
        </div>

        {user && (
          <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-2">
            <span className="font-title-md text-title-md text-on-surface">Your questions</span>
            {!mine.data?.length ? (
              <p className="font-body-sm text-body-sm text-outline">Nothing submitted yet.</p>
            ) : (
              mine.data.map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-outline-variant/20 last:border-0">
                  <div className="min-w-0">
                    {m.articleSlug && m.articleStatus === 'published' ? (
                      <Link to={`/articles/${m.articleSlug}`} className="block font-body-sm text-body-sm text-primary truncate">{m.title}</Link>
                    ) : (
                      <span className="block font-body-sm text-body-sm text-on-surface truncate">{m.title}</span>
                    )}
                    <span className="font-label-caps text-label-caps text-outline">{ago(m.createdAt)}</span>
                  </div>
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant whitespace-nowrap">
                    {m.articleStatus === 'published' ? 'answered' : m.status === 'drafted' ? 'in review' : m.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
