'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Loader2, Shield, Briefcase, Sparkles, Building2 } from 'lucide-react';
import { loginAction, verify2FALogin } from '@/actions/auth';
import { requestMagicLink } from '@/actions/magic-link';
import Link from 'next/link';
import type { AuthConfig } from '@prisma/client';
import { toast } from 'sonner';

const MAGIC_LINK_ERRORS: Record<string, string> = {
  invalid_token: 'Link inválido. Solicite um novo Magic Link.',
  expired_token: 'Link expirado ou já utilizado. Solicite um novo.',
  account_inactive: 'Conta inativa. Contate o administrador.',
  internal: 'Erro interno. Tente novamente.',
  // OAuth errors
  invalid_provider: 'Provedor de autenticação inválido.',
  provider_disabled: 'Este método de login não está habilitado.',
  provider_not_configured: 'Provedor OAuth não configurado. Contate o administrador.',
  oauth_denied: 'Acesso negado pelo provedor. Tente novamente.',
  csrf_mismatch: 'Erro de segurança. Tente novamente.',
  no_email: 'Não foi possível obter o e-mail da sua conta. Verifique as permissões.',
  oauth_error: 'Erro ao autenticar com o provedor. Tente novamente.',
  invalid_callback: 'Callback inválido. Tente novamente.',
};

export function LoginForm({ authConfig }: { authConfig: AuthConfig }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => {
    const errorParam = searchParams.get('error');
    return errorParam ? MAGIC_LINK_ERRORS[errorParam] || '' : '';
  });
  const [activeTab, setActiveTab] = useState<'standard' | 'ldap'>('standard');
  const [step, setStep] = useState<'login' | '2fa'>('login');
  const [preAuthToken, setPreAuthToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);


  const hasSocial = authConfig.googleEnabled || authConfig.githubEnabled || authConfig.microsoftEnabled;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await loginAction({ email, password, isLdap: activeTab === 'ldap' });

    if (result.success) {
      if ('requires2FA' in result && result.requires2FA) {
        setPreAuthToken(result.preAuthToken!);
        setStep('2fa');
        setLoading(false);
      } else if ('redirectTo' in result && result.redirectTo) {
        router.push(result.redirectTo);
      } else {
        router.push('/dashboard');
      }
    } else {
      setError(result.error || 'Erro ao fazer login');
      setLoading(false);
    }
  }

  async function handle2FASubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await verify2FALogin(preAuthToken, twoFactorCode);

    if (result.success) {
      if (result.redirectTo) {
        router.push(result.redirectTo);
      } else {
        router.push('/dashboard');
      }
    } else {
      setError(result.error || 'Código inválido');
      setLoading(false);
      setTwoFactorCode('');
    }
  }

  function handleSocialLogin(provider: string) {
    window.location.href = `/api/auth/${provider}`;
  }

  async function handleMagicLink() {
    if (!email) {
      setError('Informe seu e-mail para receber o Magic Link.');
      return;
    }
    setMagicLinkLoading(true);
    setError('');
    const result = await requestMagicLink(email);
    if (result.success) {
      setMagicLinkSent(true);
      toast.success('Magic Link enviado! Verifique sua caixa de e-mail.');
    } else {
      setError(result.error || 'Erro ao enviar Magic Link.');
    }
    setMagicLinkLoading(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      {step === '2fa' ? (
        <form onSubmit={handle2FASubmit} className="space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-on-surface">Autenticação em Duas Etapas</h2>
            <p className="text-sm text-on-surface-variant mt-2">
              Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador.
            </p>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-3 mb-6 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-xl text-center">
              {error}
            </motion.div>
          )}

          <div>
            <label className="label text-center">Código de Segurança</label>
            <input
              type="text"
              className="input text-center text-2xl tracking-widest bg-surface-container-lowest focus:bg-surface py-3"
              placeholder="000000"
              value={twoFactorCode}
              onChange={e => setTwoFactorCode(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 8))}
              required
              autoComplete="one-time-code"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || twoFactorCode.length < 6}
            className="btn-primary w-full py-2.5 mt-4 rounded-xl flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Verificando...</>
            ) : (
              'Verificar e Entrar'
            )}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setStep('login');
              setPreAuthToken('');
              setPassword('');
              setTwoFactorCode('');
            }}
            className="btn-ghost w-full py-2 mt-2 text-sm text-on-surface-variant"
          >
            Voltar ao Login
          </button>
        </form>
      ) : (
        <>
          {/* LDAP / Standard Tabs */}
          {authConfig.ldapEnabled && (
            <div className="flex bg-surface-container-lowest p-1 rounded-xl mb-6 border border-outline-variant/10">
              <button 
                onClick={() => setActiveTab('standard')}
                className={`flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2 rounded-lg transition-colors ${activeTab === 'standard' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <Lock size={14} /> Padrão
              </button>
              <button 
                onClick={() => setActiveTab('ldap')}
                className={`flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2 rounded-lg transition-colors ${activeTab === 'ldap' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <Building2 size={14} /> Corporativo
              </button>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-3 mb-6 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-xl text-center">
              {error}
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {authConfig.emailPasswordEnabled && (
              <>
                <div>
                  <label className="label">{activeTab === 'ldap' ? 'Usuário de Rede' : 'Email'}</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type={activeTab === 'ldap' ? 'text' : 'email'}
                      className="input input-icon-left bg-surface-container-lowest border-outline-variant/20 focus:bg-surface"
                      placeholder={activeTab === 'ldap' ? 'dominio\\usuario' : 'admin@empresa.com'}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label mb-0">Senha</label>
                    {activeTab === 'standard' && (
                      <Link href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                        Esqueceu a senha?
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="password"
                      className="input input-icon-left bg-surface-container-lowest border-outline-variant/20 focus:bg-surface"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 mt-2 rounded-xl flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> Conectando...</>
                  ) : (
                    <>{activeTab === 'ldap' ? 'Autenticar na Rede' : 'Entrar no Sistema'}</>
                  )}
                </button>
              </>
            )}

            {/* Magic Link */}
            {authConfig.magicLinkEnabled && activeTab === 'standard' && !magicLinkSent && (
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={magicLinkLoading}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${authConfig.emailPasswordEnabled ? 'bg-surface-container hover:bg-surface-container-high text-on-surface' : 'btn-primary'}`}
              >
                {magicLinkLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Enviando link...</>
                ) : (
                  <>Fazer login sem senha</>
                )}
              </button>
            )}

            {/* Magic Link Sent */}
            {magicLinkSent && (
              <div className="w-full py-3 px-4 rounded-xl text-sm bg-green-500/10 text-green-600 text-center border border-green-500/20">
                <p className="font-semibold">✓ Magic Link enviado!</p>
                <p className="text-xs mt-1 opacity-80">Verifique sua caixa de e-mail e clique no link para entrar.</p>
              </div>
            )}
          </form>

          {/* Social Login Separator */}
          {hasSocial && activeTab === 'standard' && (
            <div className="mt-8 mb-6 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant/20"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-surface px-4 text-on-surface-variant uppercase tracking-widest font-bold">Ou continue com</span>
              </div>
            </div>
          )}

          {/* Social Login Buttons */}
          {hasSocial && activeTab === 'standard' && (
            <div className="grid grid-cols-1 gap-3">
              {authConfig.googleEnabled && (
                <button type="button" onClick={() => handleSocialLogin('Google')} className="flex items-center justify-center gap-3 w-full py-2.5 bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/20 rounded-xl transition-colors text-sm font-semibold text-on-surface">
                  <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>
              )}
              {authConfig.microsoftEnabled && (
                <button type="button" onClick={() => handleSocialLogin('Microsoft')} className="flex items-center justify-center gap-3 w-full py-2.5 bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/20 rounded-xl transition-colors text-sm font-semibold text-on-surface">
                  <svg viewBox="0 0 21 21" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                  </svg>
                  Microsoft
                </button>
              )}
              {authConfig.githubEnabled && (
                <button type="button" onClick={() => handleSocialLogin('GitHub')} className="flex items-center justify-center gap-3 w-full py-2.5 bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/20 rounded-xl transition-colors text-sm font-semibold text-on-surface">
                  <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub
                </button>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
