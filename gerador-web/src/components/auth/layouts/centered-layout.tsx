'use client';

import { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import type { ThemeConfig } from '@prisma/client';

interface CenteredLayoutProps {
  theme: ThemeConfig;
  children: ReactNode;
}

export function CenteredLayout({ theme, children }: CenteredLayoutProps) {
  // O layout centralizado já tem um gradiente radial suave injetado via CSS, mas vamos colocar a base
  return (
    <div className="min-h-screen flex items-center justify-center relative p-4 bg-surface">
      {/* Background gradient sutil */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-[420px] bg-surface/80 backdrop-blur-xl border border-outline-variant/30 rounded-3xl shadow-2xl overflow-hidden relative z-10 p-8">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          {theme.logoLightUrl || theme.logoDarkUrl ? (
            <div className="flex justify-center mb-6">
              {theme.logoLightUrl && (
                <img
                  src={theme.logoLightUrl}
                  alt={theme.projectName}
                  className={`h-20 w-auto max-w-[280px] object-contain ${theme.logoDarkUrl ? 'dark:hidden' : ''}`}
                />
              )}
              {theme.logoDarkUrl && (
                <img
                  src={theme.logoDarkUrl}
                  alt={theme.projectName}
                  className={`h-20 w-auto max-w-[280px] object-contain ${theme.logoLightUrl ? 'hidden dark:block' : ''}`}
                />
              )}
            </div>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-4">
                <Sparkles size={24} />
              </div>
              <h1 className="text-2xl font-bold text-on-surface">{theme.projectName}</h1>
              <p className="text-sm text-on-surface-variant mt-1">Acesso Seguro ao Sistema</p>
            </>
          )}
        </div>

        {children}
      </div>
      
      {/* Footer */}
      <footer className="absolute bottom-6 left-0 w-full text-center text-xs text-on-surface-variant/60">
        &copy; {new Date().getFullYear()} {theme.companyName || theme.projectName}. Todos os direitos reservados.
      </footer>
    </div>
  );
}
