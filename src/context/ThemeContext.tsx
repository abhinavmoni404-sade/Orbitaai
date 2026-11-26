import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ThemePreference } from '../types/orbita';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setThemePreference: (next: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try {
      const saved = window.sessionStorage.getItem('orbita_theme');
      if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
    } catch {
      // ignore
    }
    return 'light';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(preference));

  const applyTheme = useCallback((pref: ThemePreference) => {
    const resolved = resolveTheme(pref);
    setResolvedTheme(resolved);
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    applyTheme(preference);
    try {
      window.sessionStorage.setItem('orbita_theme', preference);
    } catch {
      // ignore
    }
  }, [preference, applyTheme]);

  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference, applyTheme]);

  const setThemePreference = useCallback((next: ThemePreference) => {
    setPreference(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference((prev) => {
      const curr = resolveTheme(prev);
      return curr === 'dark' ? 'light' : 'dark';
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setThemePreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
