'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function ThemeWatcher({ defaultTheme }: { defaultTheme: string }) {
  const pathname = usePathname();

  useEffect(() => {
    // Roda toda vez que a URL (pathname) mudar (client-side navigation)
    const local = localStorage.getItem('theme');
    const isAuth = pathname.startsWith('/login') || pathname.startsWith('/setup');
    const root = document.documentElement;

    if (isAuth) {
      if (defaultTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } else {
      if (local === 'dark' || (!local && defaultTheme === 'dark')) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [pathname, defaultTheme]);

  return null;
}
