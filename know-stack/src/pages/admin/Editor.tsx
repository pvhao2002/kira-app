import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { api, useApi } from '../../api';
import { DifficultyBadge, ErrorBox, Spinner } from '../../components/Badge';
import { Markdown, useMarkdown } from '../../components/Markdown';
import { ago, num } from '../../format';
import { DIFFICULTY_LABEL, type Category, type Difficulty } from '../../types';

type Row = { id: number; slug: string; title: string; status: 'draft' | 'published'; source: 'human' | 'ai'; difficulty: Difficulty; categorySlug: string; views: number; updatedAt: number };
type Full = Row & { summary: string; bodyMd: string; tags: string[]; question: { title: string; context: string; author: string } | null };
type Draft = { title: string; summary: string; bodyMd: string; categorySlug: string; difficulty: Difficulty; tags: string };

const input = 'w-full px-3 py-2 bg-[#0f172a] text-on-surface placeholder:text-outline font-body-sm text-body-sm rounded-lg border border-[#334155] focus:outline-none focus:border-[#6366f1]';
const ghost = 'flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[#334155] hover:bg-[#1e293b] hover:border-[#475569] text-on-surface font-badge-label text-badge-label disabled:opacity-50';
const lbl = 'font-label-caps text-label-caps text-outline uppercase';

export default function Editor() {
  const { id } = useParams();
  return id ? <EditArticle key={id} id={Number(id)} /> : <ArticleList />;
}

function ArticleList() {
  const list = useApi<Row[]>('/admin/articles');
  const { data: categories } = useApi<Category[]>('/categories');
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function create() {
    try {
      const a = await api<{ id: number }>('/admin/articles', { body: { title: 'Untitled draft', categorySlug: categories?.[0]?.slug, difficulty: 'senior', bodyMd: '' } });
      navigate(`/admin/editor/${a.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-space-lg max-w-[1100px]">
      <header className="flex flex-wrap items-end justify-between gap-space-md">
        <div>
          <span className={lbl}>Admin Studio</span>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">AI Article Studio</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Drafts from the question queue and agents, plus everything published.</p>
        </div>
        <button type="button" onClick={create} disabled={!categories} className="flex items-center gap-1.5 px-space-md h-9 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white font-badge-label text-badge-label">
          <span className="material-symbols-outlined text-title-md">add</span>New Article
        </button>
      </header>
      {error && <ErrorBox message={error} />}
      {list.error ? <ErrorBox message={list.error.message} onRetry={list.reload} /> : !list.data ? <Spinner /> : (
        <div className="rounded-xl bg-surface-container-low overflow-x-auto">
          <table className="w-full text-left font-body-sm text-body-sm min-w-[640px]">
            <thead className="text-outline">
              <tr className="border-b border-outline-variant/30">
                {['Title', 'Status', 'Difficulty', 'Views', 'Updated'].map((h) => <th key={h} className="px-space-md py-3 font-label-caps text-label-caps uppercase font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.data.map((a) => (
                <tr key={a.id} className="border-b border-outline-variant/15 last:border-0 hover:bg-surface-container">
                  <td className="px-space-md py-3">
                    <Link to={`/admin/editor/${a.id}`} className="text-on-surface hover:text-primary font-semibold">{a.title}</Link>
                    <span className="block text-outline font-label-caps text-label-caps">{a.source === 'ai' ? 'AI DRAFTED' : 'HUMAN'} · {a.categorySlug}</span>
                  </td>
                  <td className="px-space-md py-3"><StatusPill status={a.status} /></td>
                  <td className="px-space-md py-3"><DifficultyBadge level={a.difficulty} /></td>
                  <td className="px-space-md py-3 text-on-surface-variant">{num(a.views)}</td>
                  <td className="px-space-md py-3 text-on-surface-variant">{ago(a.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const StatusPill = ({ status }: { status: string }) => (
  <span className={`px-2 py-0.5 rounded-full font-badge-label text-badge-label ${status === 'published' ? 'bg-secondary-container/20 text-secondary' : 'bg-[rgba(245,158,11,0.12)] text-[#fbbf24]'}`}>
    {status === 'published' ? 'Published' : 'Draft · Needs review'}
  </span>
);

function EditArticle({ id }: { id: number }) {
  const navigate = useNavigate();
  const { data: article, error: loadError } = useApi<Full>(`/admin/articles/${id}`);
  const { data: categories } = useApi<Category[]>('/categories');
  const [d, setD] = useState<Draft | null>(null);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [slug, setSlug] = useState('');
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<'write' | 'split' | 'preview'>('split');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiModel, setAiModel] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  const rev = useRef(0); // bumps on every edit, so a save only clears `dirty` if nothing changed meanwhile
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const { html, headings } = useMarkdown(d?.bodyMd ?? '');

  useEffect(() => {
    if (!article) return;
    setD({ title: article.title, summary: article.summary, bodyMd: article.bodyMd, categorySlug: article.categorySlug, difficulty: article.difficulty, tags: article.tags.join(', ') });
    setStatus(article.status);
    setSlug(article.slug);
    setPrompt(article.question ? `${article.question.title}\n\n${article.question.context}` : article.title);
  }, [article]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const blocker = useBlocker(() => dirtyRef.current);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (confirm('You have unsaved changes. Leave without saving?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  if (loadError) return <ErrorBox message={loadError.message} />;
  if (!d) return <Spinner />;

  // Functional update: AI calls resolve seconds later and must not revert edits made meanwhile.
  const update = (patch: Partial<Draft>) => {
    setD((prev) => ({ ...prev!, ...patch }));
    rev.current++;
    setDirty(true);
  };
  const words = d.bodyMd.split(/\s+/).filter(Boolean).length;

  async function save(nextStatus = status) {
    setBusy('save');
    setMsg(null);
    const sentRev = rev.current;
    try {
      const r = await api<{ slug: string; status: 'draft' | 'published' }>(`/admin/articles/${id}`, { method: 'PUT', body: { ...d, status: nextStatus } });
      setStatus(r.status);
      setSlug(r.slug);
      if (rev.current === sentRev) setDirty(false);
      setMsg({ ok: true, text: r.status === 'published' ? 'Published to the library' : 'Draft saved' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy('');
    }
  }

  async function generate(instruction?: string) {
    setBusy(instruction ?? 'generate');
    setMsg(null);
    try {
      const r = await api<{ markdown: string; model: string }>('/admin/ai/draft', {
        body: { prompt, difficulty: DIFFICULTY_LABEL[d!.difficulty], instruction, current: instruction ? d!.bodyMd : undefined },
      });
      if (!r.markdown.trim()) throw new Error('The model returned an empty draft');
      update({ bodyMd: r.markdown.trim() });
      setAiModel(r.model);
      setMsg({ ok: true, text: 'AI draft inserted — review before publishing' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    if (!confirm('Delete this article permanently?')) return;
    await api(`/admin/articles/${id}`, { method: 'DELETE' });
    dirtyRef.current = false; // the blocker reads the ref; state wouldn't update before navigate()
    navigate('/admin/editor');
  }

  /** Wraps the selection (or inserts a snippet) in the body textarea. */
  function insert(before: string, after = '', placeholder = '') {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const sel = value.slice(s, e) || placeholder;
    update({ bodyMd: value.slice(0, s) + before + sel + after + value.slice(e) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  }

  const tools: [string, string, () => void][] = [
    ['H2', 'title', () => insert('\n## ', '\n', 'Section')],
    ['H3', 'title', () => insert('\n### ', '\n', 'Subsection')],
    ['Bold', 'format_bold', () => insert('**', '**', 'bold')],
    ['Italic', 'format_italic', () => insert('_', '_', 'italic')],
    ['Inline code', 'code', () => insert('`', '`', 'code')],
    ['Code block', 'integration_instructions', () => insert('\n```java\n', '\n```\n', '// code')],
    ['Mermaid', 'account_tree', () => insert('\n```mermaid\ngraph LR\n  ', '\n```\n', 'A --> B')],
    ['Callout', 'lightbulb', () => insert('\n> [!TIP]\n> ', '\n', 'Interview tip')],
    ['Table', 'table_chart', () => insert('\n| Column | Column |\n|---|---|\n| ', ' | |\n', 'value')],
  ];

  return (
    <div className="flex flex-col gap-space-md">
      <nav className="flex items-center gap-1 text-on-surface-variant font-body-sm text-body-sm flex-wrap">
        <span>Admin Studio</span><span className="material-symbols-outlined text-title-md">chevron_right</span>
        <Link to="/admin/editor" className="hover:text-primary">AI Article Editor</Link><span className="material-symbols-outlined text-title-md">chevron_right</span>
        <span className="text-on-surface">{status === 'draft' ? 'Draft' : 'Article'} #{id}</span>
      </nav>

      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-space-md">
        <div className="min-w-0">
          <h1 className="font-headline-md text-headline-md text-on-surface truncate">{d.title || 'Untitled'}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 font-body-sm text-body-sm text-on-surface-variant">
            <StatusPill status={status} />
            {article?.source === 'ai' && <span className="text-secondary">AI generated</span>}
            <span><span className="material-symbols-outlined text-title-md align-middle">description</span> {num(words)} words</span>
            <span><span className="material-symbols-outlined text-title-md align-middle">schedule</span> {Math.max(1, Math.ceil(words / 220))} min read</span>
            {dirty && <span className="text-[#fbbf24]">Unsaved changes</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="flex p-0.5 rounded-lg border border-[#334155]">
            {(['write', 'split', 'preview'] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} type="button" onClick={() => setView(v)} className={`px-3 h-8 rounded-md font-badge-label text-badge-label capitalize ${view === v ? 'bg-[#1e293b] text-on-surface' : 'text-on-surface-variant'}`}>{v}</button>
            ))}
          </div>
          {status === 'published' && <a href={`/articles/${slug}`} target="_blank" rel="noreferrer" className={ghost}><span className="material-symbols-outlined text-title-md">open_in_new</span>View</a>}
          <button type="button" onClick={() => save()} disabled={!!busy} className={ghost}><span className="material-symbols-outlined text-title-md">save</span>{busy === 'save' ? 'Saving…' : 'Save'}</button>
          {status === 'published' ? (
            <button type="button" onClick={() => save('draft')} disabled={!!busy} className={ghost}><span className="material-symbols-outlined text-title-md">unpublished</span>Unpublish</button>
          ) : (
            <button type="button" onClick={() => save('published')} disabled={!!busy || words < 50} title={words < 50 ? 'Write at least 50 words first' : undefined} className="flex items-center gap-1.5 px-space-md h-9 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white font-badge-label text-badge-label disabled:opacity-50">
              <span className="material-symbols-outlined text-title-md">publish</span>Publish to Library
            </button>
          )}
        </div>
      </header>
      {msg && (msg.ok ? <p role="status" className="font-body-sm text-body-sm text-secondary">{msg.text}</p> : <ErrorBox message={msg.text} />)}

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-space-md">
        <aside className="flex flex-col gap-space-md">
          <section className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-title-md text-title-md text-on-surface"><span className="material-symbols-outlined text-primary">smart_toy</span>AI Synthesis Engine</span>
              <span className="font-label-caps text-label-caps text-secondary">{busy && busy !== 'save' ? 'RUNNING' : 'READY'}</span>
            </div>
            {article?.question && <p className="font-body-sm text-body-sm text-outline">From a question by <span className="text-on-surface">{article.question.author}</span></p>}
            <label className={lbl} htmlFor="ai-prompt">Prompt question</label>
            <textarea id="ai-prompt" className={`${input} min-h-28`} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <button type="button" onClick={() => (d.bodyMd.trim() && !confirm('Replace the current body with a new AI draft?') ? null : generate())} disabled={!!busy} className="flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white font-badge-label text-badge-label disabled:opacity-50">
              <span className={`material-symbols-outlined text-title-md ${busy === 'generate' ? 'animate-spin' : ''}`}>{busy === 'generate' ? 'progress_activity' : 'auto_fix_high'}</span>
              {d.bodyMd.trim() ? 'Re-prompt AI' : 'Generate Draft'}
            </button>
            <span className={`${lbl} pt-2`}>Instant copilot tasks</span>
            {[
              ['warning', 'Add edge cases and common traps'],
              ['quiz', 'Generate 3 more mock interview Q&As'],
              ['account_tree', 'Add or improve a Mermaid architecture diagram'],
              ['spellcheck', 'Fact-check and fix technical inaccuracies'],
            ].map(([icon, text]) => (
              <button key={text} type="button" disabled={!!busy || !d.bodyMd.trim()} onClick={() => generate(text)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-left font-body-sm text-body-sm text-on-surface-variant disabled:opacity-50">
                <span className={`material-symbols-outlined text-title-md text-primary ${busy === text ? 'animate-spin' : ''}`}>{busy === text ? 'progress_activity' : icon}</span>{text}
              </button>
            ))}
            {aiModel && <p className="font-label-caps text-label-caps text-outline">MODEL: {aiModel}</p>}
          </section>

          <section className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-3">
            <span className="font-title-md text-title-md text-on-surface">Article details</span>
            <label className={lbl} htmlFor="ed-title">Title</label>
            <input id="ed-title" className={input} value={d.title} onChange={(e) => update({ title: e.target.value })} />
            <label className={lbl} htmlFor="ed-summary">Summary</label>
            <textarea id="ed-summary" className={`${input} min-h-20`} maxLength={500} value={d.summary} onChange={(e) => update({ summary: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className={lbl} htmlFor="ed-cat">Category</label>
                <select id="ed-cat" className={input} value={d.categorySlug} onChange={(e) => update({ categorySlug: e.target.value })}>
                  {categories?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={lbl} htmlFor="ed-diff">Interview level</label>
                <select id="ed-diff" className={input} value={d.difficulty} onChange={(e) => update({ difficulty: e.target.value as Difficulty })}>
                  {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((k) => <option key={k} value={k}>{DIFFICULTY_LABEL[k]}</option>)}
                </select>
              </div>
            </div>
            <label className={lbl} htmlFor="ed-tags">Tags (comma separated)</label>
            <input id="ed-tags" className={input} value={d.tags} onChange={(e) => update({ tags: e.target.value })} />
            {headings.length > 0 && (
              <div className="pt-2">
                <span className={lbl}>Outline</span>
                <ul className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{headings.map((h) => <li key={h.id} className={h.depth === 3 ? 'pl-4' : ''}>{h.text}</li>)}</ul>
              </div>
            )}
            <button type="button" onClick={remove} className="mt-2 self-start font-body-sm text-body-sm text-error hover:underline">Delete article</button>
          </section>
        </aside>

        <section className="rounded-xl bg-surface-container-low overflow-hidden flex flex-col min-h-[70vh]">
          {view !== 'preview' && (
            <div className="flex items-center gap-1 px-2 h-11 border-b border-outline-variant/30 overflow-x-auto">
              {tools.map(([name, icon, fn]) => (
                <button key={name} type="button" title={name} aria-label={name} onClick={fn} className="w-8 h-8 shrink-0 rounded flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high">
                  {name.startsWith('H') && name.length === 2 ? <span className="font-label-caps text-label-caps">{name}</span> : <span className="material-symbols-outlined text-title-md">{icon}</span>}
                </button>
              ))}
            </div>
          )}
          <div className={`flex-1 grid ${view === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {view !== 'preview' && (
              <textarea ref={area} aria-label="Article markdown" spellCheck={false} value={d.bodyMd} onChange={(e) => update({ bodyMd: e.target.value })} placeholder="Write markdown, or generate a draft with AI…" className="w-full h-full min-h-[60vh] p-space-md bg-[#0d1117] text-on-surface font-code-block text-code-block resize-none focus:outline-none" />
            )}
            {view !== 'write' && (
              <div className="p-space-lg overflow-y-auto max-h-[80vh] lg:border-l border-outline-variant/30">
                {d.bodyMd.trim() ? <Markdown html={html} /> : <p className="text-outline font-body-sm text-body-sm">Nothing to preview yet.</p>}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
