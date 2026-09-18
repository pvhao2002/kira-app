import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {AppState, Platform} from 'react-native';

const KEY = 'kira-life-session';
const BIOMETRIC_KEY = 'kira-life-biometric';
const LOCK_BACKGROUND_KEY = 'kira-life-lock-background';
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

const storage = Platform.OS === 'web'
  ? {
    get: () => AsyncStorage.getItem(KEY),
    set: (v: string) => AsyncStorage.setItem(KEY, v),
    remove: () => AsyncStorage.removeItem(KEY)
  }
  : {
    get: () => SecureStore.getItemAsync(KEY),
    set: (v: string) => SecureStore.setItemAsync(KEY, v),
    remove: () => SecureStore.deleteItemAsync(KEY)
  };

export type AuthUser = {
  id: number;
  email: string;
  fullName: string;
  phone?: string | null;
  roles: string[];
  version: number
};
type Session = { accessToken: string; refreshToken: string; expiresAt: number; user: AuthUser };
type MobileSession = { accessToken: string; expiresInSeconds: number; user: AuthUser; refreshToken: string };

export class ApiError extends Error {
  constructor(public status: number, public code: string, public fieldErrors?: Record<string, string>, public traceId?: string) {
    super(code);
    this.name = 'ApiError';
  }
}

function correlationId() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function errorDetail(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

async function callAuth(path: string, body: unknown): Promise<MobileSession> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1/auth/mobile${path}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
  } catch {
    throw new ApiError(0, 'NETWORK');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(response.status, payload?.code || (response.status === 401 ? 'BAD_CREDENTIALS' : 'NETWORK'));
  }
  return response.json();
}

function toSession(s: MobileSession): Session {
  return {
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    expiresAt: Date.now() + s.expiresInSeconds * 1000,
    user: s.user
  };
}

export type BiometricKind = 'none' | 'face' | 'generic';
type AuthCtx = {
  ready: boolean;
  session: Session | null;
  unlocked: boolean;
  biometric: BiometricKind;
  biometricEnabled: boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  lockWhenBackground: boolean;
  setLockWhenBackground: (enabled: boolean) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
  authHeader: () => Record<string, string>;
  requestJson: <T>(path: string, init?: RequestInit) => Promise<T>;
  updateProfile: (body: { fullName: string; phone?: string | null; version: number }) => Promise<void>;
  changePassword: (body: { currentPassword: string; newPassword: string }) => Promise<void>;
};
const Context = createContext<AuthCtx | null>(null);

export function AuthProvider({children}: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [biometric, setBiometric] = useState<BiometricKind>('none');
  const [biometricEnabled, setBiometricEnabledState] = useState(true);
  const [lockWhenBackground, setLockWhenBackgroundState] = useState(true);
  const [ready, setReady] = useState(false);
  const current = useRef<Session | null>(null);

  async function persist(next: Session | null) {
    current.current = next;
    setSession(next);
    if (next) await storage.set(JSON.stringify(next)); else await storage.remove();
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      let restored: Session | null = null;
      try {
        const raw = await storage.get();
        if (raw) {
          const saved: Session = JSON.parse(raw);
          restored = saved.expiresAt - 60000 > Date.now() ? saved : toSession(await callAuth('/refresh', {refreshToken: saved.refreshToken}));
        }
      } catch {
        await storage.remove();
      }
      let kind: BiometricKind = 'none';
      try {
        if (await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync()) {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          kind = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? 'face' : 'generic';
        }
      } catch { /* biometric hardware check unavailable, treat as none */
      }
      let biometricPreference = true;
      let lockPreference = true;
      try {
        const preferences = Object.fromEntries(await AsyncStorage.multiGet([BIOMETRIC_KEY, LOCK_BACKGROUND_KEY]));
        biometricPreference = preferences[BIOMETRIC_KEY] !== 'false';
        lockPreference = preferences[LOCK_BACKGROUND_KEY] !== 'false';
      } catch { /* use the secure defaults */
      }
      if (!mounted) return;
      if (restored) await persist(restored);
      setBiometric(kind);
      setBiometricEnabledState(biometricPreference);
      setLockWhenBackgroundState(lockPreference);
      setUnlocked(!restored || kind === 'none' || !biometricPreference);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if ((state === 'background' || state === 'inactive') && current.current && lockWhenBackground && biometricEnabled && biometric !== 'none') {
        setUnlocked(false);
      }
    });
    return () => subscription.remove();
  }, [biometric, biometricEnabled, lockWhenBackground]);

  async function login(email: string, password: string) {
    const next = toSession(await callAuth('/login', {email, password}));
    await persist(next);
    setUnlocked(true);
  }

  async function logout() {
    const refreshToken = current.current?.refreshToken;
    await persist(null);
    setUnlocked(false);
    if (refreshToken) await callAuth('/logout', {refreshToken}).catch(() => {
    });
  }

  async function unlockWithBiometrics() {
    if (!current.current || biometric === 'none' || !biometricEnabled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: biometric === 'face' ? 'Xác thực bằng Face ID' : 'Xác thực sinh trắc học',
      disableDeviceFallback: false
    });
    if (result.success) setUnlocked(true);
    return result.success;
  }

  async function setBiometricEnabled(enabled: boolean) {
    setBiometricEnabledState(enabled);
    await AsyncStorage.setItem(BIOMETRIC_KEY, String(enabled)).catch(() => {
    });
    if (!enabled) setUnlocked(true);
  }

  async function setLockWhenBackground(enabled: boolean) {
    setLockWhenBackgroundState(enabled);
    await AsyncStorage.setItem(LOCK_BACKGROUND_KEY, String(enabled)).catch(() => {
    });
  }

  function authHeader(): Record<string, string> {
    return current.current ? {Authorization: `Bearer ${current.current.accessToken}`} : {};
  }

  async function requestRaw(path: string, init: RequestInit = {}, allowRetry = true): Promise<Response> {
    if (!current.current) throw new ApiError(401, 'UNAUTHORIZED');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${current.current.accessToken}`);
    if (!headers.has('X-Correlation-ID')) headers.set('X-Correlation-ID', correlationId());
    if (init.body != null && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, {...init, headers});
    } catch (error) {
      console.error('[API] request failed before receiving a response', {
        method: init.method || 'GET',
        path,
        error: errorDetail(error)
      });
      throw new ApiError(0, 'NETWORK');
    }
    if (response.status === 401 && allowRetry) {
      const refreshToken = current.current.refreshToken;
      try {
        await persist(toSession(await callAuth('/refresh', {refreshToken})));
      } catch {
        await persist(null);
        setUnlocked(false);
        throw new ApiError(401, 'UNAUTHORIZED');
      }
      return requestRaw(path, init, false);
    }
    return response;
  }

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await requestRaw(path, init);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const traceId = payload?.traceId || response.headers.get('X-Correlation-ID') || undefined;
      const code = payload?.code || 'UNKNOWN';
      console.error('[API] request rejected', {
        method: init?.method || 'GET',
        path,
        status: response.status,
        code,
        traceId
      });
      throw new ApiError(response.status, code, payload?.fieldErrors, traceId);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('[API] response body could not be parsed as JSON', {
        method: init?.method || 'GET',
        path,
        status: response.status,
        traceId: response.headers.get('X-Correlation-ID') || undefined,
        error: errorDetail(error)
      });
      throw error;
    }
  }

  async function updateProfile(body: { fullName: string; phone?: string | null; version: number }) {
    const user = await requestJson<AuthUser>('/api/v1/auth/profile', {method: 'PUT', body: JSON.stringify(body)});
    const saved = current.current;
    if (saved) await persist({...saved, user});
  }

  async function changePassword(body: { currentPassword: string; newPassword: string }) {
    await requestJson<void>('/api/v1/auth/change-password', {method: 'POST', body: JSON.stringify(body)});
  }

  return <Context.Provider value={{
    ready,
    session,
    unlocked,
    biometric,
    biometricEnabled,
    setBiometricEnabled,
    lockWhenBackground,
    setLockWhenBackground,
    login,
    logout,
    unlockWithBiometrics,
    authHeader,
    requestJson,
    updateProfile,
    changePassword
  }}>{children}</Context.Provider>;
}

export function useAuth() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('Missing AuthProvider');
  return ctx;
}

export function authErrorCode(error: unknown) {
  return error instanceof ApiError ? error.code : 'NETWORK';
}
