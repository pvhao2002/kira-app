import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import type { User } from '../types';

type Mode = 'signin' | 'signup';

const input =
  'w-full px-3 py-2 bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-sm text-body-sm rounded-lg border border-outline-variant/40 focus:outline-none focus:border-primary transition-colors';
const label = 'font-label-caps text-label-caps text-on-surface-variant font-medium';

export function AuthModal({ mode, onMode, onClose, onDone }: { mode: Mode; onMode: (m: Mode) => void; onClose: () => void; onDone: (u: User) => void }) {
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user } = await api<{ user: User }>(mode === 'signin' ? '/auth/login' : '/auth/register', { body: form });
      onDone(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Network error, try again');
    } finally {
      setBusy(false);
    }
  }

  const tab = (m: Mode, text: string) => (
    <button
      type="button"
      onClick={() => { onMode(m); setError(''); }}
      className={`py-1.5 text-center font-badge-label text-badge-label rounded-md transition-all ${
        mode === m ? 'font-semibold bg-primary-container text-on-primary-container shadow-sm' : 'font-medium text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-surface-dim/80 backdrop-blur-md overflow-y-auto" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="relative w-full max-w-md bg-surface-container rounded-xl shadow-2xl border border-outline-variant/30 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-outline-variant/20">
          <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-surface">
            Know<span className="text-[#818cf8]">Stack</span>
          </span>
          <button aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors" type="button">
            <span className="material-symbols-outlined text-title-md">close</span>
          </button>
        </div>
        <div className="px-6 pt-4 pb-2 text-center">
          <h3 id="auth-title" className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">
            {mode === 'signin' ? 'Welcome back to KnowStack' : 'Join KnowStack'}
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Access technical interview blueprints &amp; engineering vault</p>
        </div>
        <div className="px-6 pt-3">
          <div className="grid grid-cols-2 p-1 bg-surface-container-lowest rounded-lg">
            {tab('signin', 'Sign In')}
            {tab('signup', 'Create Account')}
          </div>
        </div>
        <form className="p-6 flex flex-col gap-3.5" onSubmit={submit}>
          {mode === 'signup' && (
            <div className="flex flex-col gap-1">
              <label className={label} htmlFor="auth-name">Display Name</label>
              <input id="auth-name" className={input} required maxLength={60} placeholder="Alex Chen" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className={label} htmlFor="auth-email">Work Email</label>
            <input id="auth-email" className={input} type="email" required autoComplete="email" placeholder="alex@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={label} htmlFor="auth-password">Password</label>
            <input
              id="auth-password" className={input} type="password" required minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="••••••••••••"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {error && <p role="alert" className="font-body-sm text-body-sm text-error">{error}</p>}
          <button disabled={busy} className="w-full mt-2 py-2.5 px-4 rounded-xl font-badge-label text-badge-label font-bold text-on-primary bg-gradient-to-r from-primary-container via-primary to-secondary transition-all hover:opacity-95 shadow-md flex items-center justify-center gap-2 disabled:opacity-60" type="submit">
            <span className="material-symbols-outlined text-title-md">{mode === 'signin' ? 'lock_open' : 'person_add'}</span>
            <span>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign In to KnowStack' : 'Create Account'}</span>
          </button>
          <p className="text-center font-body-sm text-body-sm text-outline pt-1">Sessions stay active for 30 days on this device.</p>
        </form>
      </div>
    </div>
  );
}
