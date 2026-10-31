import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useApi } from '../api';
import { useAuth } from '../auth';
import type { Category } from '../types';
import { useTrack } from '../useTrack';

const sideLink = ({ isActive }: { isActive: boolean }) =>
  `flex items-center px-space-sm py-2 rounded-xl transition-colors ${
    isActive ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
  }`;

const topLink = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-xl font-body-sm text-body-sm transition-colors ${isActive ? 'text-on-surface bg-surface-container' : 'text-on-surface-variant hover:text-on-surface'}`;

export const Logo = () => (
  <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-white">
    Know<span className="text-[#818cf8]">Stack</span>
  </span>
);

export function Shell() {
  useTrack();
  const { user, openAuth, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState(params.get('q') ?? '');
  const search = useRef<HTMLInputElement>(null);
  const { data: categories } = useApi<Category[]>('/categories');

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/');
  };

  const sidebar = (
    <div className="p-space-md flex flex-col gap-space-lg">
      <div>
        <span className="font-label-caps text-label-caps uppercase text-outline px-space-sm tracking-wider">Categorized Paths</span>
        <nav className="mt-space-sm flex flex-col gap-1">
          {categories?.map((c) => (
            <NavLink key={c.slug} to={`/tracks/${c.slug}`} className={sideLink}>
              <span className="material-symbols-outlined mr-space-sm text-title-md">{c.icon}</span>
              <span className="font-body-sm text-body-sm truncate flex-1">{c.name}</span>
              <span className="font-label-caps text-label-caps text-outline">{c.count}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      {user?.isAdmin && (
        <div>
          <span className="font-label-caps text-label-caps uppercase text-outline px-space-sm tracking-wider">Admin Studio</span>
          <nav className="mt-space-sm flex flex-col gap-1">
            {[
              ['/admin/agents', 'smart_toy', 'Agent Studio & CU'],
              ['/admin/questions', 'inbox', 'Question Queue'],
              ['/admin/editor', 'edit_note', 'AI Article Editor'],
              ['/admin/analytics', 'insights', 'Analytics'],
            ].map(([to, icon, text]) => (
              <NavLink key={to} to={to} className={sideLink}>
                <span className="material-symbols-outlined mr-space-sm text-title-md">{icon}</span>
                <span className="font-body-sm text-body-sm truncate">{text}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </div>
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/20">
        <div className="w-full h-16 px-margin-mobile md:px-space-lg flex items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md min-w-0">
            <button className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container" aria-label="Open navigation" onClick={() => setDrawer(true)} type="button">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <Link to="/" aria-label="KnowStack home"><Logo /></Link>
            <form onSubmit={submit} className="hidden md:flex items-center bg-surface-container-low px-space-md py-1.5 rounded-xl w-64 xl:w-80 text-on-surface-variant">
              <span className="material-symbols-outlined text-outline text-title-md mr-space-sm">search</span>
              <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" placeholder="Search concepts, algorithms, questions..." className="bg-transparent flex-1 min-w-0 font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none" />
              <kbd className="px-1.5 py-0.5 text-label-caps font-label-caps bg-surface-container-high rounded">⌘K</kbd>
            </form>
          </div>
          <nav className="hidden lg:flex items-center gap-1">
            <NavLink to="/" end className={topLink}>Knowledge Library</NavLink>
            <NavLink to="/tracks" className={topLink}>Interview Tracks</NavLink>
            <NavLink to="/ask" className={topLink}>Ask Question</NavLink>
            {user?.isAdmin && <NavLink to="/admin/analytics" className={topLink}>Admin Studio</NavLink>}
          </nav>
          <div className="flex items-center gap-1">
            <button title="Bookmarks" aria-label="Bookmarks" type="button" onClick={() => (user ? navigate('/?bookmarked=1') : openAuth())} className="w-9 h-9 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-title-md">bookmark</span>
            </button>
            {user ? (
              <div className="relative">
                <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Account menu" className="w-9 h-9 rounded-xl bg-primary-container text-on-primary-container font-badge-label text-badge-label font-bold">
                  {user.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                </button>
                {menu && (
                  <div className="absolute right-0 mt-2 w-60 bg-surface-container-high border border-white/10 rounded-xl shadow-[0_8px_24px_-4px_rgba(0,0,0,0.45)] p-2" onMouseLeave={() => setMenu(false)}>
                    <div className="px-3 py-2">
                      <p className="font-title-md text-title-md text-on-surface truncate">{user.name}</p>
                      <p className="font-body-sm text-body-sm text-outline truncate">{user.email}</p>
                    </div>
                    <Link to="/?bookmarked=1" onClick={() => setMenu(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-highest">
                      <span className="material-symbols-outlined text-title-md">bookmarks</span> My bookmarks
                    </Link>
                    <Link to="/ask" onClick={() => setMenu(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-highest">
                      <span className="material-symbols-outlined text-title-md">help</span> My questions
                    </Link>
                    <button type="button" onClick={() => { setMenu(false); logout(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg font-body-sm text-body-sm text-on-surface-variant hover:bg-surface-container-highest">
                      <span className="material-symbols-outlined text-title-md">logout</span> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => openAuth()} className="ml-1 px-space-md py-2 bg-primary text-on-primary rounded-xl font-badge-label text-badge-label font-semibold hover:opacity-95">
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <aside className="hidden lg:flex fixed left-0 top-16 bottom-0 w-72 bg-surface-container-lowest z-40 flex-col justify-between overflow-y-auto">
        {sidebar}
        <SidebarFooter />
      </aside>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-[55] bg-surface-dim/80 backdrop-blur-sm" onClick={() => setDrawer(false)}>
          <aside className="w-72 max-w-[85vw] h-full bg-surface-container-lowest overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="h-16 px-space-md flex items-center justify-between">
              <Logo />
              <button aria-label="Close navigation" onClick={() => setDrawer(false)} className="w-9 h-9 rounded-xl text-on-surface-variant hover:bg-surface-container" type="button">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={submit} className="mx-space-md flex items-center bg-surface-container-low px-3 py-2 rounded-xl">
              <span className="material-symbols-outlined text-outline mr-2">search</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" placeholder="Search..." className="bg-transparent flex-1 min-w-0 font-body-sm text-body-sm text-on-surface focus:outline-none" />
            </form>
            <nav className="px-space-md pt-space-md flex flex-col gap-1">
              <NavLink to="/" end className={sideLink}>Knowledge Library</NavLink>
              <NavLink to="/tracks" end className={sideLink}>Interview Tracks</NavLink>
              <NavLink to="/ask" className={sideLink}>Ask Question</NavLink>
            </nav>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        <main className="w-full min-h-screen pt-16 px-margin-mobile md:px-space-lg pb-space-xl bg-surface">
          <div className="pt-space-lg">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}

function SidebarFooter() {
  return (
    <div className="p-space-md bg-surface-container-low/40">
      <div className="flex items-center justify-between text-outline">
        <span className="font-label-caps text-label-caps">Engine v2.4</span>
        <span className="flex items-center gap-1 font-label-caps text-label-caps text-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
          Syncd
        </span>
      </div>
    </div>
  );
}
