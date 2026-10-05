import { useEffect, useState } from 'react';

type Theme = 'auto' | 'light' | 'dark';
const ORDER: Theme[] = ['auto', 'light', 'dark'];
const LABEL: Record<Theme, string> = { auto: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark' };

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('jwt-theme');
    return stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
  });

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => root.setAttribute('data-theme', theme === 'auto' ? (mq.matches ? 'dark' : 'light') : theme);
    apply();
    localStorage.setItem('jwt-theme', theme);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  return (
    <button
      className="ghost"
      onClick={() => setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
      title="Cycles auto -> light -> dark"
    >
      {LABEL[theme]}
    </button>
  );
}
