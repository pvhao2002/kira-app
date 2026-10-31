import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { api, useApi } from '../api';
import { useAuth } from '../auth';
import { DifficultyBadge, ErrorBox, Spinner, TechBadge } from '../components/Badge';
import { Markdown, useMarkdown } from '../components/Markdown';
import { date, num } from '../format';
import type { ArticleDetail } from '../types';

const action = 'w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors';

export function Article() {
  const { slug } = useParams();
  const { data: a, error, setData, reload } = useApi<ArticleDetail>(`/articles/${slug}`);
  const { user, openAuth } = useAuth();
  const { html, headings } = useMarkdown(a?.bodyMd ?? '');
  const [active, setActive] = useState('');
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (a) document.title = `${a.title} · KnowStack`;
    return () => {
      document.title = 'KnowStack';
      speechSynthesis?.cancel();
    };
  }, [a]);

  useEffect(() => {
    const els = headings.map((h) => document.getElementById(h.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver((entries) => {
      const hit = entries.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top)[0];
      if (hit) setActive(hit.target.id);
    }, { rootMargin: '-80px 0px -70% 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [headings, html]);

  if (error) return <ErrorBox message={error.status === 404 ? 'This guide does not exist or is not published yet.' : error.message} onRetry={error.status === 404 ? undefined : reload} />;
  if (!a) return <Spinner />;

  async function toggleBookmark() {
    if (!user) return openAuth();
    await api(`/articles/${a!.slug}/bookmark`, { method: a!.bookmarked ? 'DELETE' : 'POST' });
    setData({ ...a!, bookmarked: !a!.bookmarked, saves: a!.saves + (a!.bookmarked ? -1 : 1) });
  }

  function copyLink() {
    navigator.clipboard.writeText(location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function exportMd() {
    const url = URL.createObjectURL(new Blob([`# ${a!.title}\n\n${a!.bodyMd}`], { type: 'text/markdown' }));
    Object.assign(document.createElement('a'), { href: url, download: `${a!.slug}.md` }).click();
    URL.revokeObjectURL(url);
  }

  function listen() {
    if (speaking) return speechSynthesis.cancel(), setSpeaking(false);
    const text = document.querySelector('.prose-ks')?.textContent ?? '';
    const u = new SpeechSynthesisUtterance(`${a!.title}. ${text}`);
    u.onend = u.onerror = () => setSpeaking(false);
    speechSynthesis.speak(u);
    setSpeaking(true);
  }

  return (
    <div className="flex gap-space-xl w-full max-w-[1200px] mx-auto">
      <article className="flex-1 min-w-0 max-w-[860px]">
        <nav className="flex items-center gap-1 text-on-surface-variant font-body-sm text-body-sm mb-space-md flex-wrap" aria-label="Breadcrumb">
          <span className="material-symbols-outlined text-title-md">home</span>
          <Link to="/" className="hover:text-primary">Library</Link>
          <span className="material-symbols-outlined text-title-md">chevron_right</span>
          <Link to={`/tracks/${a.categorySlug}`} className="hover:text-primary">{a.categoryName}</Link>
        </nav>
        {a.status === 'draft' && <div className="mb-space-md"><ErrorBox message="Draft preview — only admins can see this page." /></div>}
        <div className="flex flex-wrap items-center gap-2 mb-space-md">
          <DifficultyBadge level={a.difficulty} />
          {a.source === 'ai' && (
            <span className="px-2 py-0.5 rounded bg-secondary-container/15 text-secondary font-badge-label text-badge-label flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">verified</span> AI drafted · staff reviewed
            </span>
          )}
          {a.tags.map((t) => <TechBadge key={t}>{t}</TechBadge>)}
        </div>
        <h1 className="font-display-xl-mobile text-display-xl-mobile md:font-display-xl md:text-display-xl text-on-surface tracking-tight">{a.title}</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant mt-space-md max-w-[68ch]">{a.summary}</p>

        <div className="flex flex-wrap items-center justify-between gap-space-md py-space-md my-space-lg border-y border-outline-variant/30">
          <div className="flex flex-wrap items-center gap-space-md text-on-surface-variant font-body-sm text-body-sm">
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-title-md text-outline">visibility</span>{num(a.views)} views</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-title-md text-outline">bookmark_added</span>{num(a.saves)} saves</span>
            <span>{date(a.publishedAt)} · {a.readMinutes} min read</span>
          </div>
          <div className="flex items-center gap-1 print:hidden">
            <button type="button" onClick={listen} className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-surface-container text-on-surface font-badge-label text-badge-label hover:bg-surface-container-high">
              <span className="material-symbols-outlined text-title-md text-primary">{speaking ? 'stop_circle' : 'play_circle'}</span>{speaking ? 'Stop' : 'Listen'}
            </button>
            <button type="button" aria-label={a.bookmarked ? 'Remove bookmark' : 'Bookmark'} aria-pressed={a.bookmarked} onClick={toggleBookmark} className={`${action} ${a.bookmarked ? 'text-primary' : ''}`}>
              <span className="material-symbols-outlined text-title-md" style={a.bookmarked ? { fontVariationSettings: "'FILL' 1" } : undefined}>bookmark</span>
            </button>
            <button type="button" aria-label="Copy link" onClick={copyLink} className={action}>
              <span className="material-symbols-outlined text-title-md">{copied ? 'check' : 'content_copy'}</span>
            </button>
            <button type="button" aria-label="Save as PDF" onClick={() => window.print()} className={action}>
              <span className="material-symbols-outlined text-title-md">picture_as_pdf</span>
            </button>
          </div>
        </div>

        <Markdown html={html} />

        <div className="mt-space-xl p-space-lg rounded-xl bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-space-md print:hidden">
          <div>
            <p className="font-title-md text-title-md text-on-surface">Still have a follow-up question?</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Send it to the knowledge pipeline for a staff-reviewed breakdown.</p>
          </div>
          <Link to="/ask" className="px-space-md py-2 bg-primary text-on-primary rounded-xl font-badge-label text-badge-label whitespace-nowrap">Ask a Question</Link>
        </div>
      </article>

      <aside className="hidden xl:block w-60 shrink-0 print:hidden">
        <div className="sticky top-24 flex flex-col gap-space-lg">
          {headings.length > 0 && (
            <nav aria-label="On this page">
              <span className="font-label-caps text-label-caps uppercase text-outline">On this page</span>
              <ul className="mt-space-sm border-l border-outline-variant/40">
                {headings.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className={`block -ml-px border-l py-1 font-body-sm text-body-sm transition-colors ${h.depth === 3 ? 'pl-6' : 'pl-3'} ${active === h.id ? 'border-[#6366f1] text-[#818cf8]' : 'border-transparent text-[#64748b] hover:text-on-surface'}`}>
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <div className="flex justify-between"><span>Difficulty</span><DifficultyBadge level={a.difficulty} /></div>
            <div className="flex justify-between"><span>Reading time</span><span className="text-on-surface">{a.readMinutes} min</span></div>
            <button type="button" onClick={exportMd} className="mt-2 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#334155] hover:bg-[#1e293b] text-on-surface font-badge-label text-badge-label">
              <span className="material-symbols-outlined text-title-md">download</span> Export Markdown
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
