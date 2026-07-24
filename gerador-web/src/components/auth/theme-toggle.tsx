'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial state on mount
    if (document.documentElement.classList.contains('dark')) {
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2 rounded-full bg-surface hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface border border-outline-variant/20 shadow-sm"
      aria-label="Alternar tema"
      title="Alternar entre tema Claro e Escuro"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
