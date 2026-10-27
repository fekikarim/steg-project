'use client';

import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

type AuthReason =
  | 'duplicate-email'
  | 'invalid-credentials'
  | 'locked'
  | 'rate-limited'
  | 'unknown';

interface AuthResult {
  ok: boolean;
  reason?: AuthReason;
  message?: string;
  fieldErrors?: Array<{field?: string; message?: string}>;
}

interface AuthContextValue {
  status: SessionStatus;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  status: 'loading',
  login: async () => ({ok: false, reason: 'unknown'}),
  register: async () => ({ok: false, reason: 'unknown'}),
  logout: async () => {},
  refreshSession: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function readJson(res: Response): Promise<{reason?: string; message?: string; fieldErrors?: Array<{field?: string; message?: string}>}> {
  try {
    return (await res.json()) as {reason?: string; message?: string; fieldErrors?: Array<{field?: string; message?: string}>};
  } catch {
    return {};
  }
}

/**
 * Browser-side session state. Tokens stay in httpOnly cookies managed by the
 * `/api/auth/*` route handlers — this context only ever sees `{ok}` /
 * `{authenticated}` booleans, never tokens (B0 task 5).
 */
export function AuthProvider({children}: {children: ReactNode}) {
  const [status, setStatus] = useState<SessionStatus>('loading');

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', {cache: 'no-store'});
      const data = (await res.json()) as {authenticated?: boolean};
      setStatus(data.authenticated ? 'authenticated' : 'anonymous');
    } catch {
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    // Initial session probe on mount. This is the one legitimate setState-in-
    // effect in the codebase (async auth bootstrap with no framework data
    // layer in B0); all other state initializes during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, password}),
      });
      if (res.ok) {
        setStatus('authenticated');
        return {ok: true};
      }
      const data = await readJson(res);
      return {ok: false, reason: data.reason as AuthReason | undefined, message: data.message, fieldErrors: data.fieldErrors};
    } catch {
      return {ok: false, reason: 'unknown'};
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {method: 'POST'});
    } finally {
      setStatus('anonymous');
    }
  }, []);

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    }): Promise<AuthResult> => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload),
        });
        if (res.ok || res.status === 201) {
          setStatus('authenticated');
          return {ok: true};
        }
        const data = await readJson(res);
        return {ok: false, reason: data.reason as AuthReason | undefined, message: data.message, fieldErrors: data.fieldErrors};
      } catch {
        return {ok: false, reason: 'unknown'};
      }
    },
    [],
  );

  const value = useMemo(
    () => ({status, login, register, logout, refreshSession}),
    [status, login, register, logout, refreshSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
