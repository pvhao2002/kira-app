import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useApi } from '../api';
import { useAuth } from '../auth';
import type { Category } from '../types';
import { useTrack } from '../useTrack';
import { Icon } from './Icon';

export const Logo = () => <span className="ks-logo"><span className="ks-logo-mark">k<span>_</span></span>Know<span>Stack</span></span>;

export function Shell() {
  useTrack();
  const { user, openAuth, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname, search: routeSearch } = useLocation();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [accountError, setAccountError] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const account = useRef<HTMLDetailsElement>(null);
  const { data: categories } = useApi<Category[]>('/categories');
  useEffect(() => { dialog.current?.close(); if (account.current) account.current.open = false; setQ(new URLSearchParams(routeSearch).get('q') ?? ''); }, [pathname, routeSearch]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.matchMedia('(max-width: 767px)').matches) {
          dialog.current?.showModal();
          dialog.current?.querySelector('input')?.focus();
        } else search.current?.focus();
      }
      if (e.key === 'Escape' && account.current) account.current.open = false;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const submit = (e: FormEvent) => { e.preventDefault(); navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/'); dialog.current?.close(); };
  const sidebar = <>
    <div className="ks-eyebrow ks-nav-label">Your workspace</div>
    <nav aria-label="Workspace" className="ks-nav">
      {[
        ['/', 'home', 'Study workspace'], ['/tracks', 'account_tree', 'Interview tracks'], ['/?bookmarked=1', 'bookmark', 'Saved guides'], ['/ask', 'help', 'Ask a question'],
      ].map(([to, icon, label]) => {
        const active = to === '/?bookmarked=1' ? pathname === '/' && params.get('bookmarked') === '1' : to === '/' ? pathname === '/' && params.get('bookmarked') !== '1' : pathname.startsWith(to);
        return <Link key={to} to={to} className={`ks-nav-link ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}><Icon name={icon} />{label}</Link>;
      })}
    </nav>
    <div className="ks-eyebrow ks-nav-label">Technical tracks</div>
    <nav aria-label="Technical tracks" className="ks-nav ks-category-nav">{categories?.map((c) => <NavLink key={c.slug} to={`/tracks/${c.slug}`} className={({ isActive }) => `ks-nav-link ${isActive ? 'is-active' : ''}`}><Icon name={c.icon} /><span>{c.name}</span><small>{c.count}</small></NavLink>)}</nav>
    {user?.isAdmin && <><div className="ks-eyebrow ks-nav-label">Admin Studio</div><nav className="ks-nav" aria-label="Admin Studio">{[['agents', 'Agent Studio'], ['questions', 'Question queue'], ['editor', 'Article editor'], ['analytics', 'Analytics']].map(([route, label]) => <NavLink className="ks-nav-link" key={route} to={`/admin/${route}`}>{label}</NavLink>)}</nav></>}
    <div className="ks-nav-footer"><span className="ks-eyebrow">One concept at a time.</span><p>Build knowledge that stays with you.</p></div>
  </>;
  return <>
    <header className="ks-header"><div className="ks-brand"><button type="button" className="ks-icon-button ks-mobile-menu" aria-label="Open navigation" onClick={() => dialog.current?.showModal()}><Icon name="menu" /></button><Link to="/" aria-label="KnowStack home"><Logo /></Link></div><form onSubmit={submit} className="ks-global-search"><Icon name="search" /><input ref={search} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" placeholder="Find something worth understanding" /><kbd>⌘ K</kbd></form><div className="ks-account">{user ? <details ref={account}><summary aria-label="Account menu">{user.name.slice(0, 1).toUpperCase()}</summary><div className="ks-account-menu"><strong>{user.name}</strong><Link to="/?bookmarked=1">Saved guides</Link><Link to="/ask">My questions</Link><button onClick={async () => { try { await logout(); if (account.current) account.current.open = false; } catch { setAccountError('Could not sign out. Try again.'); } }}>Sign out</button>{accountError && <p role="alert">{accountError}</p>}</div></details> : <button type="button" className="ks-button ks-signin" onClick={() => openAuth()}>Sign in</button>}</div></header>
    <aside className="ks-sidebar">{sidebar}</aside>
    <dialog className="ks-nav-dialog" ref={dialog} aria-label="Navigation" onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}><div className="ks-drawer-content" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) dialog.current?.close(); }}><div className="ks-drawer-heading"><Logo /><button type="button" className="ks-icon-button" aria-label="Close navigation" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div><form onSubmit={submit} className="ks-library-search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search navigation" placeholder="Search guides…" /><button type="submit" aria-label="Search"><Icon name="arrow_forward" /></button></form>{sidebar}</div></dialog>
    <main id="main-content" className="ks-main"><Outlet /></main>
  </>;
}
