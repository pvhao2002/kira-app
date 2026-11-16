import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { api, ApiError, useApi } from '../api';
import { useAuth } from '../auth';
import { DifficultyBadge, ErrorBox, Spinner, TechBadge } from '../components/Badge';
import { Icon } from '../components/Icon';
import { studyMode, TrackDirectory } from '../components/Study';
import { DIFFICULTY_LABEL, type ArticleItem, type Category, type Difficulty } from '../types';

type Stats = { tags: { tag: string; count: number }[] };

export function Library() {
  const { category } = useParams();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const { user, ready, openAuth } = useAuth();
  const mode = studyMode(pathname, params.toString());
  const saved = mode === 'saved';
  const workspace = mode === 'workspace';
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState<number | null>(null);
  const savingRef = useRef(false);
  useEffect(() => setSearch(params.get('q') ?? ''), [params]);
  const query = new URLSearchParams(params);
  if (category) query.set('category', category);
  const list = useApi<ArticleItem[]>(mode === 'tracks' || (saved && !user) ? null : `/articles?${query}`);
  const { data: stats } = useApi<Stats>('/stats');
  const categories = useApi<Category[]>('/categories');
  const current = categories.data?.find((c) => c.slug === category);
  useEffect(() => { list.reload(); }, [user?.id, list.reload]);
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };
  async function toggleBookmark(a: ArticleItem) {
    if (!user) return openAuth();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(a.id);
    setSaveError('');
    try {
      await api(`/articles/${a.slug}/bookmark`, { method: a.bookmarked ? 'DELETE' : 'POST' });
      // Refetch the current query: navigation/account may have changed during the save.
      list.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) openAuth();
      setSaveError('Could not update your saved guide. Please try again.');
    } finally { savingRef.current = false; setSaving(null); }
  }
  const title = mode === 'tracks' ? 'Find your next focus.' : saved ? 'Your saved guides.' : mode === 'track' ? current?.name ?? 'Interview track' : mode === 'results' ? 'Find the guide you need.' : 'What are you studying today?';
  const articles = list.data ?? [];
  const recommended = workspace ? articles[0] : undefined;
  const guides = recommended ? articles.slice(1) : articles;
  const renderCard = (a: ArticleItem, featured = false) => <article className={`ks-guide ${featured ? 'ks-guide-featured' : ''}`} key={a.id}>
    <div className="ks-guide-top"><span className="ks-eyebrow">{featured ? 'Recommended reading' : categories.data?.find((c) => c.slug === a.categorySlug)?.name ?? 'Guide'}</span><button type="button" className="ks-icon-button" aria-label={a.bookmarked ? `Remove ${a.title} from saved guides` : `Save ${a.title}`} aria-pressed={a.bookmarked} disabled={saving !== null} onClick={() => toggleBookmark(a)}><Icon name="bookmark" className={a.bookmarked ? 'text-primary' : ''} /></button></div>
    <DifficultyBadge level={a.difficulty} />
    <Link to={`/articles/${a.slug}`} className="ks-guide-title"><h2>{a.title}</h2></Link>
    <p>{a.summary}</p>
    <div className="ks-guide-tags">{a.tags.slice(0, 3).map((tag) => <TechBadge key={tag}>{tag}</TechBadge>)}</div>
    <div className="ks-guide-bottom"><span><Icon name="schedule" /> {a.readMinutes} min read{a.source === 'ai' ? ' · AI drafted' : ''}</span><Link to={`/articles/${a.slug}`}>Read guide <Icon name="arrow_forward" /></Link></div>
  </article>;

  return <div className="ks-study">
    <div className="ks-page-heading"><div><div className="ks-eyebrow">KnowStack / {saved ? 'Saved guides' : mode === 'tracks' || mode === 'track' ? 'Interview tracks' : 'Study workspace'}</div><h1>{title}</h1><p>{mode === 'tracks' ? 'Pick a technical domain. Build understanding, one guide at a time.' : saved ? 'Keep the ideas you want to revisit within reach.' : mode === 'track' ? `${current?.count ?? '—'} published guides to explore at your own pace.` : 'Explore a concept, work through a guide, and make it stick.'}</p></div>{workspace && <Link to="/tracks" className="ks-button">Explore tracks <Icon name="arrow_forward" /></Link>}</div>
    {mode === 'tracks' ? <>{categories.error ? <ErrorBox message={categories.error.message} onRetry={categories.reload} /> : !categories.data ? <Spinner /> : <TrackDirectory categories={categories.data} />}<div className="ks-study-note"><Icon name="help" /><div><strong>Have a specific question?</strong><p>Share the problem you’re working through.</p></div><Link to="/ask">Ask a question <Icon name="arrow_forward" /></Link></div></> : <>
      {workspace && <div className="ks-workspace-grid"><div>{list.loading ? <Spinner /> : list.error ? <ErrorBox message={list.error.message} onRetry={list.reload} /> : recommended ? renderCard(recommended, true) : <div className="ks-empty">New guides will appear here when published.</div>}</div><aside className="ks-desk"><span className="ks-eyebrow">Your study desk</span><h2>A little focus.<br />A deeper understanding.</h2><p>Save useful guides and return when you’re ready to dig in.</p><Link to="/?bookmarked=1" className="ks-desk-link"><Icon name="bookmark" /> Saved guides <Icon name="arrow_forward" /></Link><Link to="/ask" className="ks-desk-link"><Icon name="help" /> Ask a question <Icon name="arrow_forward" /></Link></aside></div>}
      {workspace && categories.data && <section className="ks-track-section"><div className="ks-section-heading"><h2>Choose a track</h2><Link to="/tracks">All tracks <Icon name="arrow_forward" /></Link></div><TrackDirectory categories={categories.data.slice(0, 3)} compact /></section>}
      <section><div className="ks-section-heading"><h2>{workspace ? 'Explore the library' : saved ? 'Saved for later' : 'Guides'}</h2>{!list.loading && list.data && <span className="text-outline text-body-sm">{guides.length} {guides.length === 1 ? 'guide' : 'guides'}</span>}</div>
      <div className="ks-filters"><form onSubmit={(e) => { e.preventDefault(); setParam('q', search.trim()); }} className="ks-library-search"><Icon name="search" /><input aria-label="Search the library" placeholder="Search concepts, patterns, questions…" value={search} onChange={(e) => setSearch(e.target.value)} /><button type="submit" aria-label="Search library"><Icon name="arrow_forward" /></button></form><select aria-label="Difficulty" value={params.get('difficulty') ?? ''} onChange={(e) => setParam('difficulty', e.target.value)}><option value="">All levels</option>{(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}</select><select aria-label="Tag" value={params.get('tag') ?? ''} onChange={(e) => setParam('tag', e.target.value)}><option value="">All topics</option>{stats?.tags.map((t) => <option key={t.tag} value={t.tag}>{t.tag}</option>)}</select><select aria-label="Sort" value={params.get('sort') ?? 'popular'} onChange={(e) => setParam('sort', e.target.value === 'popular' ? '' : e.target.value)}><option value="popular">Popular</option><option value="recent">Newest</option></select></div>
      {['q', 'difficulty', 'tag', 'sort'].some((k) => params.get(k)) && <button className="ks-text-button" onClick={() => setParams(saved ? { bookmarked: '1' } : {})}>Clear filters</button>}
      {saveError && <p role="alert" className="text-error mb-4">{saveError}</p>}
      {saved && !ready ? <Spinner /> : saved && !user ? <div className="ks-empty"><Icon name="bookmark" /><h2>Your study desk travels with you.</h2><p>Sign in to save guides and revisit them here.</p><button className="ks-button" onClick={() => openAuth()}>Sign in to view saved guides</button></div> : list.loading ? <div role="status" aria-live="polite"><Spinner /><span className="sr-only">Updating guides</span></div> : list.error ? <ErrorBox message={list.error.message} onRetry={list.reload} /> : !guides.length ? <div className="ks-empty"><h2>{saved ? 'Your reading list starts here.' : 'No guides match yet.'}</h2><p>{saved ? 'Save a guide from the library to come back to it later.' : 'Try another topic or clear your filters.'}</p><Link to={saved ? '/' : '/ask'} className="ks-button">{saved ? 'Explore the library' : 'Ask a question'}</Link></div> : <div className="ks-guide-grid">{guides.map((a) => renderCard(a))}</div>}
      </section>
    </>}
  </div>;
}
