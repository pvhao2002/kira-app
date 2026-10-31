import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, ApiError, useApi } from '../api';
import { useAuth } from '../auth';
import { DifficultyBadge, ErrorBox, Spinner, TechBadge } from '../components/Badge';
import { compact, num } from '../format';
import { DIFFICULTY_LABEL, type ArticleDetail, type ArticleItem, type Category, type Difficulty } from '../types';

type Stats = { articles: number; newThisWeek: number; questions: number; tags: { tag: string; count: number }[]; difficulties: Record<Difficulty, number> };

const LEVEL_TEXT: Record<Difficulty, string> = { junior: 'text-secondary', mid: 'text-primary-fixed-dim', senior: 'text-tertiary', staff: 'text-error' };
const chip = (on: boolean) =>
  `px-3 py-1 rounded-xl font-badge-label text-badge-label transition-colors ${on ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'}`;
const select = 'appearance-none bg-surface-container hover:bg-surface-container-high text-on-surface font-body-sm text-body-sm pl-3 pr-8 py-2 rounded-xl focus:outline-none cursor-pointer transition-colors';

export function Library() {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, openAuth } = useAuth();
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);

  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (category) query.set('category', category);
  for (const k of ['difficulty', 'tag', 'sort', 'bookmarked']) if (params.get(k)) query.set(k, params.get(k)!);
  const list = useApi<ArticleItem[]>(`/articles?${query}`);
  const { data: stats } = useApi<Stats>('/stats');
  const { data: categories } = useApi<Category[]>('/categories');
  const current = categories?.find((c) => c.slug === category);
  const bookmarked = params.get('bookmarked') === '1';

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  async function toggleBookmark(a: ArticleItem) {
    if (!user) return openAuth();
    try {
      await api(`/articles/${a.slug}/bookmark`, { method: a.bookmarked ? 'DELETE' : 'POST' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) openAuth(); // session expired
      return; // icon keeps its old state, so it never shows a save that didn't happen
    }
    list.setData((list.data ?? []).map((x) => (x.id === a.id ? { ...x, bookmarked: !a.bookmarked, saves: x.saves + (a.bookmarked ? -1 : 1) } : x)).filter((x) => !bookmarked || x.bookmarked));
  }

  const crumb = bookmarked ? 'MY BOOKMARKS' : q ? `SEARCH: “${q}”` : current ? current.name.toUpperCase() : 'ALL TRACKS';
  const [featured, ...rest] = list.data ?? [];

  return (
    <div className="flex flex-col gap-space-lg w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center gap-2 text-on-surface-variant font-label-caps text-label-caps flex-wrap">
            <Link to="/" className="hover:text-primary transition-colors">LIBRARY</Link>
            <span>/</span>
            <span className="text-primary font-semibold">{crumb}</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-secondary font-badge-label text-badge-label ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> Live Catalog
            </span>
          </div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface font-bold tracking-tight">
            {current ? `${current.name} Track` : 'KnowStack Knowledge & Interview Prep Vault'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            Curated, in-depth architectural guides, low-level runtime breakdowns, and production-tested interview blueprints.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <Link to="/ask" className="flex items-center gap-2 px-space-md py-2 bg-primary text-on-primary rounded-xl font-badge-label text-badge-label whitespace-nowrap transition-opacity hover:opacity-95 shadow-md">
            <span className="material-symbols-outlined text-title-md">add_task</span> Ask a Question
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md p-space-md bg-surface-container-low rounded-xl">
        <Stat icon="verified_user" tone="bg-primary-container/20 text-primary" value={num(stats?.articles ?? 0)} note={`+${stats?.newThisWeek ?? 0} this week`} label="Published Deep-Dives" />
        <Stat icon="forum" tone="bg-secondary-container/20 text-secondary" value={num(stats?.questions ?? 0)} note="community" label="Questions Submitted" />
        <Stat icon="auto_awesome" tone="bg-tertiary-container/20 text-tertiary" value={String(categories?.length ?? 0)} note="tracks" label="Categorized Learning Paths" />
      </div>

      <div className="flex flex-col gap-space-sm p-space-md bg-surface-container-lowest rounded-xl">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
          <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); setParam('q', search.trim() || null); }}>
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-title-md">search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search the library" className="w-full pl-11 pr-4 py-2.5 bg-surface-container text-on-surface placeholder:text-outline font-body-sm text-body-sm rounded-xl focus:outline-none focus:bg-surface-container-high transition-colors" placeholder="Search patterns, algorithms, concurrency bugs, data stores..." />
          </form>
          <div className="flex flex-wrap items-center gap-space-sm">
            <div className="relative">
              <select aria-label="Tag" className={select} value={params.get('tag') ?? ''} onChange={(e) => setParam('tag', e.target.value || null)}>
                <option value="">Tags: All</option>
                {stats?.tags.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-title-md pointer-events-none">expand_more</span>
            </div>
            <div className="relative">
              <select aria-label="Sort" className={select} value={params.get('sort') ?? 'popular'} onChange={(e) => setParam('sort', e.target.value === 'popular' ? null : e.target.value)}>
                <option value="popular">Sort: Most Popular</option>
                <option value="recent">Sort: Recently Published</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-title-md pointer-events-none">swap_vert</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="font-label-caps text-label-caps text-outline uppercase mr-1">Categories:</span>
          <button type="button" className={chip(!category)} onClick={() => navigate(`/?${params}`)}>All ({stats?.articles ?? 0})</button>
          {categories?.map((c) => (
            <button key={c.slug} type="button" className={chip(category === c.slug)} onClick={() => navigate(`/tracks/${c.slug}?${params}`)}>
              {c.name} ({c.count})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="font-label-caps text-label-caps text-outline uppercase mr-1">Seniority:</span>
          <div className="flex flex-wrap items-center gap-1.5 bg-surface-container p-1 rounded-xl">
            <button type="button" onClick={() => setParam('difficulty', null)} className={`px-2.5 py-0.5 rounded-lg font-badge-label text-badge-label ${!params.get('difficulty') ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>All Levels</button>
            {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
              <button key={d} type="button" aria-pressed={params.get('difficulty') === d} onClick={() => setParam('difficulty', d)} className={`px-2.5 py-0.5 rounded-lg font-badge-label text-badge-label transition-colors ${LEVEL_TEXT[d]} ${params.get('difficulty') === d ? 'bg-surface-container-high' : 'hover:bg-surface-container-high'}`}>
                {DIFFICULTY_LABEL[d]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-space-lg">
        <div className="xl:col-span-3 flex flex-col gap-space-lg">
          {list.error ? (
            <ErrorBox message={list.error.message} onRetry={list.reload} />
          ) : !list.data ? (
            <Spinner />
          ) : list.data.length === 0 ? (
            <div className="p-space-xl rounded-xl bg-surface-container-low text-center flex flex-col items-center gap-space-sm">
              <span className="material-symbols-outlined text-headline-lg text-outline">{bookmarked ? 'bookmark' : 'search_off'}</span>
              <p className="font-title-md text-title-md text-on-surface">{bookmarked ? 'No bookmarks yet' : 'No guides match these filters'}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {bookmarked ? 'Save guides with the bookmark icon to study them later.' : 'Try clearing a filter, or ask the community to cover it.'}
              </p>
              <Link to="/ask" className="text-primary font-body-sm text-body-sm underline">Submit a question</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              <Featured article={featured} onBookmark={toggleBookmark} />
              {rest.map((a) => <Card key={a.id} article={a} categories={categories} onBookmark={toggleBookmark} />)}
            </div>
          )}
        </div>
        <aside className="flex flex-col gap-space-md">
          <div className="p-space-md bg-surface-container-low rounded-xl flex flex-col gap-3">
            <span className="font-label-caps text-label-caps uppercase text-outline">Seniority Mix</span>
            {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => {
              const n = stats?.difficulties[d] ?? 0;
              const pct = stats?.articles ? (n / stats.articles) * 100 : 0;
              return (
                <div key={d} className="flex flex-col gap-1">
                  <div className="flex justify-between font-body-sm text-body-sm"><span className={LEVEL_TEXT[d]}>{DIFFICULTY_LABEL[d]}</span><span className="text-on-surface-variant">{n}</span></div>
                  <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden"><div className="h-full bg-primary-container" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
          <div className="p-space-md bg-surface-container-low rounded-xl flex flex-col gap-3">
            <span className="font-label-caps text-label-caps uppercase text-outline">Popular Tags</span>
            <div className="flex flex-wrap gap-2">
              {stats?.tags.map((t) => (
                <button key={t.tag} type="button" onClick={() => setParam('tag', t.tag)} className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-code-inline text-code-inline">
                  {t.tag} <span className="text-outline">{t.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="p-space-md rounded-xl bg-primary-container/15 border border-primary-container/30 flex flex-col gap-2">
            <span className="material-symbols-outlined text-primary text-headline-md">psychology</span>
            <p className="font-title-md text-title-md text-on-surface">Stuck on a tricky interview question?</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Submit it and get a curated deep-dive reviewed by staff engineers.</p>
            <Link to="/ask" className="font-badge-label text-badge-label text-primary inline-flex items-center gap-1">Ask Question <span className="material-symbols-outlined text-title-md">arrow_forward</span></Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon, tone, value, note, label }: { icon: string; tone: string; value: string; note: string; label: string }) {
  return (
    <div className="flex items-center gap-4 p-space-sm rounded-lg bg-surface-container-lowest/60">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${tone}`}><span className="material-symbols-outlined text-headline-md">{icon}</span></div>
      <div className="flex flex-col">
        <div className="flex items-baseline gap-2">
          <span className="font-headline-md text-headline-md font-bold text-on-surface">{value}</span>
          <span className="font-label-caps text-label-caps text-secondary font-medium">{note}</span>
        </div>
        <span className="font-body-sm text-body-sm text-on-surface-variant">{label}</span>
      </div>
    </div>
  );
}

function BookmarkButton({ article, onBookmark }: { article: ArticleItem; onBookmark: (a: ArticleItem) => void }) {
  return (
    <button type="button" aria-label={article.bookmarked ? 'Remove bookmark' : 'Bookmark'} aria-pressed={article.bookmarked} onClick={() => onBookmark(article)} className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high transition-colors ${article.bookmarked ? 'text-primary' : 'text-outline hover:text-on-surface'}`}>
      <span className="material-symbols-outlined text-title-md" style={article.bookmarked ? { fontVariationSettings: "'FILL' 1" } : undefined}>bookmark</span>
    </button>
  );
}

function Featured({ article: a, onBookmark }: { article: ArticleItem; onBookmark: (a: ArticleItem) => void }) {
  const { data } = useApi<ArticleDetail>(`/articles/${a.slug}`);
  // First non-diagram code block of the guide, shown in the terminal panel.
  const snippet = /```(\w*)\n([\s\S]*?)```/g;
  let code: { lang: string; text: string } | null = null;
  for (const m of data?.bodyMd.matchAll(snippet) ?? []) if (m[1] !== 'mermaid') { code = { lang: m[1] || 'text', text: m[2].trim() }; break; }
  return (
    <article className="md:col-span-2 group flex flex-col lg:flex-row bg-surface-container-low hover:bg-surface-container rounded-xl overflow-hidden transition-all duration-200">
      <div className="lg:w-7/12 p-space-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-primary-container/25 text-primary-fixed-dim font-badge-label text-badge-label font-medium">FEATURED MASTERCLASS</span>
              <DifficultyBadge level={a.difficulty} />
            </div>
            <BookmarkButton article={a} onBookmark={onBookmark} />
          </div>
          <Link to={`/articles/${a.slug}`} className="block group-hover:text-primary transition-colors">
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface leading-tight mb-2">{a.title}</h2>
          </Link>
          <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-3 mb-4">{a.summary}</p>
          <div className="flex flex-wrap items-center gap-2 mb-4">{a.tags.map((t) => <TechBadge key={t}>{t}</TechBadge>)}</div>
        </div>
        <div className="flex items-center justify-between pt-4 gap-2 flex-wrap">
          <Meta article={a} />
          <Link to={`/articles/${a.slug}`} className="inline-flex items-center gap-1 font-title-md text-title-md text-primary group-hover:translate-x-1 transition-transform">
            Read Guide <span className="material-symbols-outlined text-title-md">arrow_forward</span>
          </Link>
        </div>
      </div>
      <div className="lg:w-5/12 bg-surface-container-lowest p-space-md flex flex-col justify-between min-w-0">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-1.5 text-outline font-label-caps text-label-caps uppercase">
            <span className="material-symbols-outlined text-title-md text-primary">terminal</span>
            <span>{code ? `SNIPPET.${code.lang}` : 'GUIDE'}</span>
          </div>
          {a.source === 'ai' && <span className="font-label-caps text-label-caps px-1.5 py-0.5 rounded bg-surface-container text-secondary">AI + REVIEWED</span>}
        </div>
        <pre className="bg-surface-container-low p-3 rounded-lg overflow-x-auto font-code-block text-code-block max-h-64"><code className="block text-primary-fixed-dim">{code?.text ?? a.summary}</code></pre>
        <div className="flex items-center justify-between pt-3 text-outline font-body-sm text-body-sm">
          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-title-md text-secondary">visibility</span>{compact(a.views)} views</span>
          <span className="font-label-caps text-label-caps text-on-surface-variant">{a.readMinutes} MIN READ</span>
        </div>
      </div>
    </article>
  );
}

function Card({ article: a, categories, onBookmark }: { article: ArticleItem; categories?: Category[]; onBookmark: (a: ArticleItem) => void }) {
  const cat = categories?.find((c) => c.slug === a.categorySlug);
  return (
    <article className="group flex flex-col justify-between p-space-lg bg-surface-container-low hover:bg-surface-container rounded-xl transition-all duration-200">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyBadge level={a.difficulty} />
            {cat && (
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-primary font-badge-label text-badge-label flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">{cat.icon}</span>{cat.name}
              </span>
            )}
          </div>
          <BookmarkButton article={a} onBookmark={onBookmark} />
        </div>
        <Link to={`/articles/${a.slug}`} className="block group-hover:text-primary transition-colors">
          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface leading-snug mb-2">{a.title}</h3>
        </Link>
        <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-3 mb-4">{a.summary}</p>
        <div className="flex flex-wrap gap-2 mb-4">{a.tags.slice(0, 3).map((t) => <TechBadge key={t}>{t}</TechBadge>)}</div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Meta article={a} />
        <Link to={`/articles/${a.slug}`} aria-label={`Read ${a.title}`} className="text-primary"><span className="material-symbols-outlined">arrow_forward</span></Link>
      </div>
    </article>
  );
}

const Meta = ({ article: a }: { article: ArticleItem }) => (
  <div className="flex items-center gap-3 text-on-surface-variant font-body-sm text-body-sm flex-wrap">
    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-title-md text-outline">schedule</span>{a.readMinutes} min</span>
    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-title-md text-outline">visibility</span>{compact(a.views)}</span>
    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-title-md text-outline">bookmark_added</span>{compact(a.saves)}</span>
  </div>
);
