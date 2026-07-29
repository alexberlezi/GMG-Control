'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Rocket, Building2, UserCog, Palette, Mail, CheckCircle2,
  ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, Shield,
} from 'lucide-react';
import { executeSetup } from '@/actions/setup';

const STEPS = [
  { icon: Rocket, title: 'Projeto', desc: 'Identifique seu projeto' },
  { icon: Building2, title: 'Empresa', desc: 'Dados da organização' },
  { icon: UserCog, title: 'Administrador', desc: 'Crie o superadmin' },
  { icon: Palette, title: 'Identidade', desc: 'Visual e branding' },
  { icon: Mail, title: 'Email & Login', desc: 'Configurações de acesso' },
  { icon: CheckCircle2, title: 'Confirmação', desc: 'Revise e finalize' },
];

const COLOR_PRESETS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Orange', value: '#F97316' },
];

interface FormData {
  projectName: string;
  projectSlug: string;
  companyName: string;
  companyCnpj: string;
  companyEmail: string;
  companyPhone: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPasswordConfirm: string;
  primaryColor: string;
  defaultTheme: string;
  loginLayout: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  skipEmailConfig: boolean;
  emailProvider: string;
  emailApiKey: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  emailPasswordEnabled: boolean;
  magicLinkEnabled: boolean;
  otpEnabled: boolean;
  turnstileEnabled: boolean;
  turnstileSiteKey: string;
  turnstileSecretKey: string;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState<FormData>({
    projectName: '',
    projectSlug: '',
    companyName: '',
    companyCnpj: '',
    companyEmail: '',
    companyPhone: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',
    primaryColor: '#3B82F6',
    defaultTheme: 'dark',
    loginLayout: 'centered',
    logoLightUrl: '',
    logoDarkUrl: '',
    faviconUrl: '',
    skipEmailConfig: false,
    emailProvider: 'resend',
    emailApiKey: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    fromEmail: '',
    fromName: '',
    emailPasswordEnabled: true,
    magicLinkEnabled: false,
    otpEnabled: false,
    turnstileEnabled: false,
    turnstileSiteKey: '',
    turnstileSecretKey: '',
  });

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'projectName') {
        next.projectSlug = slugify(value as string);
      }
      return next;
    });
    setError('');
  }, []);

  function validateStep(): boolean {
    switch (step) {
      case 0:
        if (!form.projectName.trim()) { setError('Nome do projeto é obrigatório'); return false; }
        break;
      case 2:
        if (!form.adminName.trim()) { setError('Nome é obrigatório'); return false; }
        if (!form.adminEmail.trim()) { setError('Email é obrigatório'); return false; }
        if (form.adminPassword.length < 8) { setError('Senha deve ter pelo menos 8 caracteres'); return false; }
        if (!/[A-Z]/.test(form.adminPassword)) { setError('Senha deve conter pelo menos uma letra maiúscula'); return false; }
        if (!/[0-9]/.test(form.adminPassword)) { setError('Senha deve conter pelo menos um número'); return false; }
        if (form.adminPassword !== form.adminPasswordConfirm) { setError('Senhas não conferem'); return false; }
        break;
      case 4:
        if (!form.skipEmailConfig) {
          if (!form.fromEmail.trim()) { setError('Email de envio é obrigatório'); return false; }
          if (form.emailProvider === 'resend' && !form.emailApiKey.trim()) { setError('API Key do Resend é obrigatória'); return false; }
          if (form.emailProvider === 'smtp' && !form.smtpHost.trim()) { setError('Host SMTP é obrigatório'); return false; }
        }
        break;
    }
    return true;
  }

  function nextStep() {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }

  function prevStep() {
    if (step > 0) setStep(s => s - 1);
    setError('');
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');

    const result = await executeSetup({
      ...form,
      smtpPort: form.smtpPort ? parseInt(form.smtpPort) : undefined,
    });

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'Erro ao configurar o sistema');
      setLoading(false);
    }
  }

  function getPasswordStrength(): { score: number; label: string; color: string } {
    const p = form.adminPassword;
    if (!p) return { score: 0, label: '', color: '' };
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const labels = ['', 'Fraca', 'Regular', 'Boa', 'Forte', 'Muito forte'];
    const colors = ['', 'bg-error', 'bg-warning', 'bg-warning', 'bg-tertiary', 'bg-tertiary'];
    return { score, label: labels[score], color: colors[score] };
  }

  const strength = getPasswordStrength();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      {/* Background effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: `radial-gradient(circle, ${form.primaryColor} 0%, transparent 70%)` }} />
        <div className="absolute -bottom-[30%] -left-[15%] w-[500px] h-[500px] rounded-full opacity-5"
          style={{ background: `radial-gradient(circle, ${form.primaryColor} 0%, transparent 70%)` }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl relative z-10"
      >
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-lowest border border-outline-variant/30 mb-4">
            <Shield className="w-5 h-5" style={{ color: form.primaryColor }} />
            <span className="text-sm font-semibold text-on-surface">AuthForge</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface">Configuração Inicial</h1>
          <p className="text-on-surface-variant text-sm mt-1">Configure seu sistema de autenticação</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <button
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  i === step
                    ? 'bg-primary text-white shadow-md'
                    : i < step
                      ? 'bg-surface-container-low text-primary cursor-pointer hover:bg-surface-container'
                      : 'bg-surface-container-low text-on-surface-variant/50 cursor-not-allowed'
                }`}
              >
                <s.icon size={14} />
                <span className="hidden sm:inline">{s.title}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`w-4 h-0.5 mx-0.5 rounded-full transition-colors ${
                  i < step ? 'bg-primary/40' : 'bg-outline-variant/30'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="card p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Step 0: Project */}
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-on-surface">Dados do Projeto</h2>
                    <p className="text-sm text-on-surface-variant mt-1">Identifique seu projeto de autenticação</p>
                  </div>
                  <div>
                    <label className="label">Nome do Projeto *</label>
                    <input className="input" placeholder="Meu Projeto" value={form.projectName}
                      onChange={e => updateField('projectName', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Slug (URL-friendly)</label>
                    <input className="input" value={form.projectSlug}
                      onChange={e => updateField('projectSlug', e.target.value)} />
                    <p className="text-xs text-on-surface-variant mt-1">Gerado automaticamente do nome</p>
                  </div>
                </div>
              )}

              {/* Step 1: Company */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-on-surface">Dados da Empresa</h2>
                    <p className="text-sm text-on-surface-variant mt-1">Informações da sua organização (opcional)</p>
                  </div>
                  <div>
                    <label className="label">Nome da Empresa</label>
                    <input className="input" placeholder="Empresa LTDA" value={form.companyName}
                      onChange={e => updateField('companyName', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">CNPJ</label>
                      <input className="input" placeholder="00.000.000/0000-00" value={form.companyCnpj}
                        onChange={e => updateField('companyCnpj', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Telefone</label>
                      <input className="input" placeholder="+55 11 99999-9999" value={form.companyPhone}
                        onChange={e => updateField('companyPhone', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Email de Contato</label>
                    <input className="input" type="email" placeholder="contato@empresa.com" value={form.companyEmail}
                      onChange={e => updateField('companyEmail', e.target.value)} />
                  </div>
                </div>
              )}

              {/* Step 2: Admin */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-on-surface">Administrador</h2>
                    <p className="text-sm text-on-surface-variant mt-1">Crie o superadmin do sistema (Owner)</p>
                  </div>
                  <div>
                    <label className="label">Nome Completo *</label>
                    <input className="input" placeholder="João Silva" value={form.adminName}
                      onChange={e => updateField('adminName', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Email *</label>
                    <input className="input" type="email" placeholder="admin@empresa.com" value={form.adminEmail}
                      onChange={e => updateField('adminEmail', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Senha *</label>
                    <div className="relative">
                      <input className="input pr-10"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 8 caracteres"
                        value={form.adminPassword}
                        onChange={e => updateField('adminPassword', e.target.value)} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {form.adminPassword && (
                      <div className="mt-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                              i <= strength.score ? strength.color : 'bg-outline-variant/30'
                            }`} />
                          ))}
                        </div>
                        <p className="text-xs text-on-surface-variant mt-1">{strength.label}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                          {[
                            { ok: form.adminPassword.length >= 8, text: 'Mín. 8 caracteres' },
                            { ok: /[A-Z]/.test(form.adminPassword), text: 'Letra maiúscula' },
                            { ok: /[0-9]/.test(form.adminPassword), text: 'Número' },
                          ].map(r => (
                            <span key={r.text} className={`text-[11px] flex items-center gap-1 ${r.ok ? 'text-green-400' : 'text-on-surface-variant/60'}`}>
                              {r.ok ? '✓' : '○'} {r.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label">Confirmar Senha *</label>
                    <input className="input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Repita a senha"
                      value={form.adminPasswordConfirm}
                      onChange={e => updateField('adminPasswordConfirm', e.target.value)} />
                  </div>
                </div>
              )}

              {/* Step 3: Visual */}
              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-on-surface">Identidade Visual</h2>
                    <p className="text-sm text-on-surface-variant mt-1">Defina as cores e o tema do sistema</p>
                  </div>

                  <div>
                    <label className="label">Cor Primária</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {COLOR_PRESETS.map(c => (
                        <button key={c.value} onClick={() => updateField('primaryColor', c.value)}
                          className={`w-9 h-9 rounded-lg transition-all ${
                            form.primaryColor === c.value ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'
                          }`}
                          style={{ background: c.value }}
                          title={c.name} />
                      ))}
                      <div className="relative">
                        <input type="color" value={form.primaryColor}
                          onChange={e => updateField('primaryColor', e.target.value)}
                          className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="label">Tema Padrão</label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {['dark', 'light'].map(theme => (
                        <button key={theme} onClick={() => updateField('defaultTheme', theme)}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            form.defaultTheme === theme
                              ? 'border-primary bg-primary/5'
                              : 'border-outline-variant/30 hover:border-outline-variant'
                          }`}>
                          <div className={`w-full h-16 rounded-lg mb-2 ${
                            theme === 'dark' ? 'bg-[#0a0a0b]' : 'bg-[#f8f9fb]'
                          } border border-outline-variant/20`}>
                            <div className={`w-1/3 h-full rounded-l-lg ${
                              theme === 'dark' ? 'bg-[#111113]' : 'bg-[#f3f4f7]'
                            }`} />
                          </div>
                          <span className="text-sm font-medium text-on-surface capitalize">{theme === 'dark' ? 'Escuro' : 'Claro'}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label">Layout de Login</label>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      {[
                        { key: 'centered', label: 'Centralizado' },
                        { key: 'split', label: 'Dividido' },
                        { key: 'minimal', label: 'Minimalista' },
                      ].map(l => (
                        <button key={l.key} onClick={() => updateField('loginLayout', l.key)}
                          className={`p-3 rounded-xl border-2 transition-all text-center ${
                            form.loginLayout === l.key
                              ? 'border-primary bg-primary/5'
                              : 'border-outline-variant/30 hover:border-outline-variant'
                          }`}>
                          <span className="text-xs font-medium text-on-surface">{l.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logo & Favicon Uploads */}
                  <div className="border-t border-outline-variant/20 pt-5">
                    <label className="label">Logotipos & Favicon</label>
                    <p className="text-xs text-on-surface-variant mb-3">Formatos aceitos: PNG, JPG, SVG, WebP. Máx 2MB.</p>
                    <div className="grid grid-cols-3 gap-4">
                      {([
                        { key: 'logoDarkUrl' as const, label: 'Logo Escuro', desc: 'Para fundo escuro', type: 'logo-dark' },
                        { key: 'logoLightUrl' as const, label: 'Logo Claro', desc: 'Para fundo claro', type: 'logo-light' },
                        { key: 'faviconUrl' as const, label: 'Favicon', desc: 'Ícone da aba', type: 'favicon' },
                      ] as const).map((item) => (
                        <div key={item.key} className="flex flex-col items-center">
                          <label
                            className={`relative w-full aspect-[3/2] rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-1 overflow-hidden group ${
                              form[item.key]
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-outline-variant/40 hover:border-outline-variant bg-surface-container-low/30 hover:bg-surface-container-low/50'
                            }`}
                          >
                            {form[item.key] ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={form[item.key]}
                                  alt={item.label}
                                  className={`max-h-full max-w-[80%] object-contain p-2 ${item.key === 'logoLightUrl' ? 'rounded bg-white/90' : ''}`}
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-xs text-white font-medium">Trocar</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant/50"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                                <span className="text-[10px] text-on-surface-variant/70">Upload</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/x-icon"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 2 * 1024 * 1024) {
                                  setError('Arquivo muito grande. Máximo 2MB.');
                                  return;
                                }
                                const fd = new FormData();
                                fd.append('file', file);
                                fd.append('type', item.type);
                                try {
                                  const res = await fetch('/api/setup/upload', { method: 'POST', body: fd });
                                  const data = await res.json();
                                  if (data.url) {
                                    updateField(item.key, data.url);
                                    setError('');
                                  } else {
                                    setError(data.error || 'Erro no upload');
                                  }
                                } catch {
                                  setError('Erro ao enviar arquivo');
                                }
                              }}
                            />
                          </label>
                          <span className="text-xs font-medium text-on-surface mt-2">{item.label}</span>
                          <span className="text-[10px] text-on-surface-variant">{item.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Email & Login */}
              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-on-surface">Email & Login</h2>
                    <p className="text-sm text-on-surface-variant mt-1">Configure o envio de emails e métodos de login</p>
                  </div>

                  {/* Skip Email Config Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low/30">
                    <div>
                      <p className="text-sm font-medium text-on-surface">Configurar email depois</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">Pule esta etapa e configure no painel admin</p>
                    </div>
                    <button
                      onClick={() => updateField('skipEmailConfig', !form.skipEmailConfig)}
                      className={`toggle ${form.skipEmailConfig ? 'active' : ''}`}
                    />
                  </div>

                  {!form.skipEmailConfig && (
                    <>
                      {/* Email Provider */}
                      <div>
                        <label className="label">Provedor de Email</label>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                          {['resend', 'smtp'].map(p => (
                            <button key={p} onClick={() => updateField('emailProvider', p)}
                              className={`p-3 rounded-xl border-2 transition-all text-center ${
                                form.emailProvider === p ? 'border-primary bg-primary/5' : 'border-outline-variant/30 hover:border-outline-variant'
                              }`}>
                              <span className="text-sm font-medium text-on-surface">{p === 'resend' ? 'Resend (API)' : 'SMTP'}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {form.emailProvider === 'resend' ? (
                        <div>
                          <label className="label">API Key *</label>
                          <input className="input" placeholder="re_xxxxxxxxxxxx" value={form.emailApiKey}
                            onChange={e => updateField('emailApiKey', e.target.value)} />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="label">Host SMTP *</label>
                              <input className="input" placeholder="smtp.gmail.com" value={form.smtpHost}
                                onChange={e => updateField('smtpHost', e.target.value)} />
                            </div>
                            <div>
                              <label className="label">Porta</label>
                              <input className="input" placeholder="587" value={form.smtpPort}
                                onChange={e => updateField('smtpPort', e.target.value)} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="label">Usuário SMTP</label>
                              <input className="input" value={form.smtpUser}
                                onChange={e => updateField('smtpUser', e.target.value)} />
                            </div>
                            <div>
                              <label className="label">Senha SMTP</label>
                              <input className="input" type="password" value={form.smtpPass}
                                onChange={e => updateField('smtpPass', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Email de Envio *</label>
                          <input className="input" placeholder="noreply@app.com" value={form.fromEmail}
                            onChange={e => updateField('fromEmail', e.target.value)} />
                        </div>
                        <div>
                          <label className="label">Nome de Envio</label>
                          <input className="input" placeholder={form.projectName || 'AuthForge'} value={form.fromName}
                            onChange={e => updateField('fromName', e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}

                  {form.skipEmailConfig && (
                    <div className="alert alert-info">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                      <span>Emails não serão enviados até que você configure o provedor no painel admin em <strong>Configurações → Email</strong>.</span>
                    </div>
                  )}

                  {/* Auth Methods */}
                  <div>
                    <label className="label">Métodos de Login</label>
                    <div className="space-y-2 mt-2">
                      {[
                        { key: 'emailPasswordEnabled' as const, label: 'Email + Senha', locked: true },
                        { key: 'magicLinkEnabled' as const, label: 'Magic Link (email)' },
                        { key: 'otpEnabled' as const, label: 'OTP por Email (6 dígitos)' },
                      ].map(m => (
                        <div key={m.key} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low/50">
                          <span className="text-sm text-on-surface">{m.label}</span>
                          <button
                            onClick={() => !m.locked && updateField(m.key, !form[m.key])}
                            className={`toggle ${form[m.key] ? 'active' : ''} ${m.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-2">
                      OAuth e LDAP podem ser configurados no painel admin após a instalação.
                    </p>
                  </div>

                  {/* Turnstile */}
                  <div className="border-t border-outline-variant/20 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <label className="label mb-0">Cloudflare Turnstile</label>
                        <p className="text-xs text-on-surface-variant">Proteção anti-bot nos formulários públicos</p>
                      </div>
                      <button onClick={() => updateField('turnstileEnabled', !form.turnstileEnabled)}
                        className={`toggle ${form.turnstileEnabled ? 'active' : ''}`} />
                    </div>
                    {form.turnstileEnabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label text-xs">Site Key</label>
                          <input className="input" placeholder="0x..." value={form.turnstileSiteKey}
                            onChange={e => updateField('turnstileSiteKey', e.target.value)} />
                        </div>
                        <div>
                          <label className="label text-xs">Secret Key</label>
                          <input className="input" type="password" value={form.turnstileSecretKey}
                            onChange={e => updateField('turnstileSecretKey', e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Confirmation */}
              {step === 5 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-on-surface">Confirmar Instalação</h2>
                    <p className="text-sm text-on-surface-variant mt-1">Revise as configurações antes de finalizar</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: 'Projeto', value: form.projectName },
                      { label: 'Empresa', value: form.companyName || '—' },
                      { label: 'Admin', value: `${form.adminName} (${form.adminEmail})` },
                      { label: 'Cor Primária', value: form.primaryColor, isColor: true },
                      { label: 'Tema', value: form.defaultTheme === 'dark' ? 'Escuro' : 'Claro' },
                      { label: 'Layout Login', value: form.loginLayout },
                      { label: 'Branding', value: [
                        form.logoDarkUrl && '✓ Logo Escuro',
                        form.logoLightUrl && '✓ Logo Claro',
                        form.faviconUrl && '✓ Favicon',
                      ].filter(Boolean).join(', ') || '— Nenhum enviado' },
                      { label: 'Email Provider', value: form.skipEmailConfig ? '⏳ Pendente — configurar no admin' : (form.emailProvider === 'resend' ? 'Resend' : 'SMTP') },
                      { label: 'Login Methods', value: [
                        form.emailPasswordEnabled && 'Email/Senha',
                        form.magicLinkEnabled && 'Magic Link',
                        form.otpEnabled && 'OTP',
                      ].filter(Boolean).join(', ') },
                      { label: 'Turnstile', value: form.turnstileEnabled ? 'Ativado' : 'Desativado' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between py-2 border-b border-outline-variant/10">
                        <span className="text-sm text-on-surface-variant">{item.label}</span>
                        <div className="flex items-center gap-2">
                          {'isColor' in item && item.isColor && (
                            <div className="w-4 h-4 rounded-full border border-outline-variant/20" style={{ background: item.value }} />
                          )}
                          <span className="text-sm font-medium text-on-surface">{item.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-4 p-3 rounded-lg bg-error-container text-on-error-container text-sm">
              {error}
            </motion.div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-outline-variant/20">
            <button onClick={prevStep} disabled={step === 0}
              className="btn btn-secondary btn-sm disabled:invisible">
              <ChevronLeft size={16} /> Voltar
            </button>

            {step < STEPS.length - 1 ? (
              <button onClick={nextStep} className="btn btn-primary btn-sm">
                Próximo <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading}
                className="btn btn-primary btn-sm" style={{ background: form.primaryColor }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                {loading ? 'Configurando...' : 'Iniciar Sistema'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
