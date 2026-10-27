'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'steg-theme';
const DEFAULT_MODE: ThemeMode = 'system';

const ThemeContext = createContext<{
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}>({mode: DEFAULT_MODE, resolved: 'light', setMode: () => {}});

function resolveSystem(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStored(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* storage unavailable — fall through to default */
  }
  return DEFAULT_MODE;
}

function applyTheme(mode: ThemeMode): ResolvedTheme {
  const resolved: ResolvedTheme = mode === 'system' ? resolveSystem() : mode;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

function subscribeMedia(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function readSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribeMedia, readSystemDark, () => false);
}

export function ThemeProvider({children}: {children: ReactNode}) {
  // Lazy initializer (render-time, not an effect) so the first client render
  // already matches the class applied pre-hydration by THEME_INIT_SCRIPT.
  const [mode, setModeState] = useState<ThemeMode>(() =>
    typeof window === 'undefined' ? DEFAULT_MODE : readStored(),
  );
  const systemDark = usePrefersDark();
  const resolved: ResolvedTheme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  // Effect only syncs the external system (DOM class); no state writes here.
  useEffect(() => {
    applyTheme(mode);
  }, [mode, systemDark]);

  const setMode = useCallback((next: ThemeMode) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — theme still applies for the session */
    }
    setModeState(next);
  }, []);

  const value = useMemo(() => ({mode, resolved, setMode}), [mode, resolved, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Blocking inline script for <head>: applies the stored/system theme before
 * first paint so there is no flash of the wrong theme (UI_UX §3.3).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('${STORAGE_KEY}')||'system';var d=m==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches:m==='dark';document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
