'use client';

import { ReactNode } from 'react';
import { Shield } from 'lucide-react';
import type { ThemeConfig } from '@prisma/client';

interface MinimalLayoutProps {
  theme: ThemeConfig;
  children: ReactNode;
}

export function MinimalLayout({ theme, children }: MinimalLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-surface-container-lowest">
      <div className="w-full max-w-[380px]">
        {/* Header Ultra Limpo */}
        <div className="flex flex-col items-center text-center mb-10">
          {theme.logoLightUrl || theme.logoDarkUrl ? (
            <>
              {theme.logoLightUrl && (
                <img
                  src={theme.logoLightUrl}
                  alt={theme.projectName}
                  className={`h-24 w-auto max-w-[360px] object-contain mb-6 ${theme.logoDarkUrl ? 'dark:hidden' : ''}`}
                />
              )}
              {theme.logoDarkUrl && (
                <img
                  src={theme.logoDarkUrl}
                  alt={theme.projectName}
                  className={`h-24 w-auto max-w-[360px] object-contain mb-6 ${theme.logoLightUrl ? 'hidden dark:block' : ''}`}
                />
              )}
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Shield size={20} />
              </div>
              <h1 className="text-xl font-semibold text-on-surface">Fazer login no {theme.projectName}</h1>
            </>
          )}
        </div>

        {/* Formulário sem bordas grandes ou fundos */}
        <div className="bg-transparent">
          {children}
        </div>
      </div>
      
      {/* Footer minimalista */}
      <footer className="mt-16 text-center text-[11px] uppercase tracking-widest text-on-surface-variant/50">
        &copy; {new Date().getFullYear()} {theme.companyName || theme.projectName}
      </footer>
    </div>
  );
}
