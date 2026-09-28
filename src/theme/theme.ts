import { useEffect, useState } from 'react';

const KEY = 'mm-theme';
const listeners = new Set<(t: 'light' | 'dark') => void>();

export function readTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch {
    // fallback if localStorage disabled
  }
  return 'dark';
}

export function applyTheme(theme: 'light' | 'dark') {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.setAttribute('data-mm-theme', theme);
  root.style.colorScheme = theme;

  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // ignore storage error
  }
  listeners.forEach((fn) => fn(theme));
}

export function useTheme(): ['light' | 'dark', (t: 'light' | 'dark') => void] {
  const [theme, setLocal] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    listeners.add(setLocal);
    applyTheme(readTheme());

    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        applyTheme(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(setLocal);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return [theme, applyTheme];
}
