import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { AuthModal } from './components/AuthModal';
import type { User } from './types';

type Mode = 'signin' | 'signup';
type AuthCtx = { user: User | null; ready: boolean; openAuth: (mode?: Mode) => void; setUser: (u: User | null) => void; logout: () => Promise<void> };

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<Mode | null>(null);

  useEffect(() => {
    api<{ user: User | null }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, ready, setUser, logout, openAuth: (mode = 'signin') => setModal(mode) }}>
      {children}
      {modal && <AuthModal mode={modal} onMode={setModal} onClose={() => setModal(null)} onDone={(u) => { setUser(u); setModal(null); }} />}
    </Ctx.Provider>
  );
}
