'use client';

import { ReactNode } from 'react';
import { Sparkles, Shield } from 'lucide-react';
import type { ThemeConfig } from '@prisma/client';

interface SplitLayoutProps {
  theme: ThemeConfig;
  children: ReactNode;
}

export function SplitLayout({ theme, children }: SplitLayoutProps) {
  return (
    <div className="min-h-screen flex w-full bg-surface">
      {/* Lado Esquerdo - Branding (Dinâmico com Cor Primária) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12">
        {/* Fundo dinâmico usando a cor primária */}
        <div 
          className="absolute inset-0 z-0" 
          style={{ background: 'var(--primary)' }} 
        />
        
        {/* Overlay de gradiente escuro para dar profundidade e contraste */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-black/10 to-black/40 z-0" />
        
        {/* Logo no topo esquerdo */}
        <div className="relative z-10">
          {theme.logoDarkUrl ? (
            <img
              src={theme.logoDarkUrl}
              alt={theme.projectName}
              className="h-20 w-auto max-w-[320px] object-contain brightness-0 invert" // Força ficar branco
            />
          ) : theme.logoLightUrl ? (
            <img
              src={theme.logoLightUrl}
              alt={theme.projectName}
              className="h-20 w-auto max-w-[320px] object-contain brightness-0 invert" // Força ficar branco
            />
          ) : (
            <div className="flex items-center gap-3 text-white">
              <Shield size={32} />
              <span className="font-bold text-xl">{theme.projectName}</span>
            </div>
          )}
        </div>

        {/* Mensagem central */}
        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center px-4 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium mb-6">
            {theme.loginPillText || 'Bem-vindo ao Sistema'}
          </div>
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            {theme.loginTitleText || 'Acesso centralizado para a sua organização.'}
          </h2>
          <p className="text-white/80 text-lg">
            {theme.loginSubtitleText || 'Plataforma corporativa de autenticação e gestão de acessos com segurança avançada.'}
          </p>
        </div>

        {/* Footer esquerdo */}
        <div className="relative z-10 text-white/60 text-sm">
          &copy; {new Date().getFullYear()} {theme.companyName || theme.projectName}.
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        {/* Mobile Header (Visível apenas se o lado esquerdo sumir) */}
        <div className="absolute top-8 left-8 lg:hidden flex items-center gap-3">
          {theme.logoLightUrl || theme.logoDarkUrl ? (
            <>
              {theme.logoLightUrl && (
                <img
                  src={theme.logoLightUrl}
                  alt={theme.projectName}
                  className={`h-8 w-auto max-w-[150px] object-contain ${theme.logoDarkUrl ? 'dark:hidden' : ''}`}
                />
              )}
              {theme.logoDarkUrl && (
                <img
                  src={theme.logoDarkUrl}
                  alt={theme.projectName}
                  className={`h-8 w-auto max-w-[150px] object-contain ${theme.logoLightUrl ? 'hidden dark:block' : ''}`}
                />
              )}
            </>
          ) : (
             <>
               <Shield className="text-primary" size={24} />
               <span className="font-bold text-xl text-on-surface">{theme.projectName}</span>
             </>
          )}
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-on-surface">Entrar na conta</h1>
            <p className="text-sm text-on-surface-variant mt-1">Preencha seus dados para continuar</p>
          </div>
          
          {children}
        </div>
      </div>
    </div>
  );
}
