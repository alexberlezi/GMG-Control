'use client';

import { useState, useTransition } from 'react';
import { KeyRound, Lock, Clock, Bot, Save, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { updateAuthConfig } from '@/actions/auth-config';

interface SecuritySettingsClientProps {
  initialConfig: any;
}

// ═══════════════════════════════════════
// Sub-components (outside to prevent re-creation)
// ═══════════════════════════════════════

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${checked ? 'bg-primary' : 'bg-outline-variant/30'}`}
    >
      <span className="sr-only">Toggle</span>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-green-500' : 'bg-outline-variant/30'}`} />;
}

function InputField({ label, placeholder, value, onChange, type = 'text', helpText, icon: Icon }: any) {
  return (
    <div>
      <label className="label flex items-center gap-2">
        {Icon && <Icon size={14} />}
        {label}
      </label>
      <input
        type={type}
        className="input bg-surface-container-lowest mt-1"
        placeholder={placeholder}
        value={value || ''}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
      {helpText && <p className="text-[11px] text-on-surface-variant mt-1">{helpText}</p>}
    </div>
  );
}

function ToggleItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-outline-variant/20 hover:bg-surface-container-lowest transition-colors">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

// ═══════════════════════════════════════

type SecuritySection = 'passwords' | 'bruteforce' | 'sessions' | 'captcha';

const SECTIONS: { id: SecuritySection; label: string; icon: any }[] = [
  { id: 'passwords', label: 'Política de Senhas', icon: KeyRound },
  { id: 'bruteforce', label: 'Força Bruta', icon: Lock },
  { id: 'sessions', label: 'Sessões', icon: Clock },
  { id: 'captcha', label: 'Anti-Bot (CAPTCHA)', icon: Bot },
];

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════

export default function SecuritySettingsClient({ initialConfig }: SecuritySettingsClientProps) {
  const [config, setConfig] = useState(initialConfig);
  const [isPending, startTransition] = useTransition();
  const [activeSection, setActiveSection] = useState<SecuritySection>('passwords');

  const handleSave = async () => {
    startTransition(async () => {
      const dataToSave = {
        passwordMinLength: parseInt(config.passwordMinLength, 10),
        requireUppercase: config.requireUppercase,
        requireNumber: config.requireNumber,
        requireSpecialChar: config.requireSpecialChar,
        passwordExpirationEnabled: config.passwordExpirationEnabled,
        passwordExpirationDays: parseInt(config.passwordExpirationDays, 10),
        maxLoginAttempts: parseInt(config.maxLoginAttempts, 10),
        lockoutDuration: parseInt(config.lockoutDuration, 10),
        sessionMaxAge: parseInt(config.sessionMaxAge, 10),
        turnstileEnabled: config.turnstileEnabled,
        turnstileSiteKey: config.turnstileSiteKey,
        turnstileSecretKey: config.turnstileSecretKey,
      };
      const res = await updateAuthConfig(dataToSave);
      if (res.success) toast.success('Políticas de segurança salvas.');
      else toast.error(res.error || 'Erro ao salvar políticas.');
    });
  };

  // ═══════════════════════════════════════
  // Panel renderers
  // ═══════════════════════════════════════

  const renderPasswordsPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-on-surface">Política de Senhas</h3>
        <p className="text-sm text-on-surface-variant mt-1">Defina requisitos de complexidade e ciclo de vida das senhas.</p>
      </div>

      {/* Min length slider */}
      <div>
        <label className="label">Tamanho Mínimo da Senha</label>
        <div className="flex items-center gap-4 mt-2">
          <input type="range" min="6" max="32" value={config.passwordMinLength}
            onChange={e => setConfig({ ...config, passwordMinLength: e.target.value })}
            className="flex-1 accent-primary" />
          <span className="font-mono bg-surface-container-highest px-3 py-1.5 rounded-lg text-sm font-bold min-w-[80px] text-center">
            {config.passwordMinLength} chars
          </span>
        </div>
      </div>

      {/* Complexity toggles */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Requisitos de Complexidade</p>
        <ToggleItem label="Exigir Letra Maiúscula (A-Z)" checked={config.requireUppercase}
          onChange={(v) => setConfig({ ...config, requireUppercase: v })} />
        <ToggleItem label="Exigir Número (0-9)" checked={config.requireNumber}
          onChange={(v) => setConfig({ ...config, requireNumber: v })} />
        <ToggleItem label="Exigir Símbolo (!@#$%)" checked={config.requireSpecialChar}
          onChange={(v) => setConfig({ ...config, requireSpecialChar: v })} />
      </div>

      {/* Password expiration */}
      <div className="pt-4 border-t border-outline-variant/10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="font-semibold text-on-surface">Expiração de Senha</span>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Obriga troca periódica de senha.</p>
          </div>
          <Switch checked={config.passwordExpirationEnabled}
            onChange={(v) => setConfig({ ...config, passwordExpirationEnabled: v })} />
        </div>
        {config.passwordExpirationEnabled && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <InputField label="Dias até expirar" type="number" value={config.passwordExpirationDays}
              onChange={(v: string) => setConfig({ ...config, passwordExpirationDays: v })}
              helpText="90 dias = padrão recomendado" />
          </div>
        )}
      </div>

      <div className="pt-4 flex justify-end">
        <button onClick={handleSave} disabled={isPending} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl">
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar
        </button>
      </div>
    </div>
  );

  const renderBruteForcePanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-on-surface">Defesa contra Força Bruta</h3>
        <p className="text-sm text-on-surface-variant mt-1">Proteção contra tentativas de adivinhação de senhas.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField label="Tentativas Máximas" type="number" value={config.maxLoginAttempts}
          onChange={(v: string) => setConfig({ ...config, maxLoginAttempts: v })}
          helpText="Erros permitidos antes do bloqueio" />
        <InputField label="Tempo de Bloqueio (minutos)" type="number"
          value={Math.floor(config.lockoutDuration / 60)}
          onChange={(v: string) => setConfig({ ...config, lockoutDuration: parseInt(v || '1', 10) * 60 })}
          helpText="15 min = padrão recomendado" />
      </div>

      <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Como funciona</h4>
        <ul className="text-xs text-on-surface-variant space-y-2">
          <li className="flex gap-2"><span className="text-primary">•</span> Após X tentativas falhas, a conta é bloqueada temporariamente</li>
          <li className="flex gap-2"><span className="text-primary">•</span> O bloqueio é por IP + conta, protegendo contra ataques distribuídos</li>
          <li className="flex gap-2"><span className="text-primary">•</span> O tempo de bloqueio dobra a cada novo ciclo de falhas</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Admins podem desbloquear contas manualmente</li>
        </ul>
      </div>

      <div className="pt-4 flex justify-end">
        <button onClick={handleSave} disabled={isPending} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl">
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar
        </button>
      </div>
    </div>
  );

  const renderSessionsPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-on-surface">Gerenciamento de Sessões</h3>
        <p className="text-sm text-on-surface-variant mt-1">Configure o tempo de vida das sessões de login.</p>
      </div>

      <InputField label="Tempo Máximo de Sessão (horas)" type="number" icon={Clock}
        value={Math.floor(config.sessionMaxAge / 3600)}
        onChange={(v: string) => setConfig({ ...config, sessionMaxAge: parseInt(v || '1', 10) * 3600 })}
        helpText="720 horas = 30 dias. Força re-login após este período." />

      <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Sobre sessões</h4>
        <ul className="text-xs text-on-surface-variant space-y-2">
          <li className="flex gap-2"><span className="text-primary">•</span> Cada sessão gera um token único armazenado em cookie HttpOnly</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Sessões inativas são limpas automaticamente</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Usuários podem ver e revogar sessões ativas no perfil</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Admins podem encerrar sessões de qualquer usuário</li>
        </ul>
      </div>

      <div className="pt-4 flex justify-end">
        <button onClick={handleSave} disabled={isPending} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl">
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar
        </button>
      </div>
    </div>
  );

  const renderCaptchaPanel = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-on-surface">Cloudflare Turnstile</h3>
          <p className="text-sm text-on-surface-variant mt-1">CAPTCHA invisível para proteger contra bots.</p>
        </div>
        <Switch checked={config.turnstileEnabled}
          onChange={(v) => setConfig({ ...config, turnstileEnabled: v })} />
      </div>

      {config.turnstileEnabled && (
        <div className="space-y-4">
          <InputField label="Site Key (Pública)" placeholder="0x4AAAA..." value={config.turnstileSiteKey}
            onChange={(v: string) => setConfig({ ...config, turnstileSiteKey: v })}
            helpText="Chave pública usada no widget do frontend" />
          <InputField label="Secret Key (Privada)" type="password" placeholder="0x4AAAA..." value={config.turnstileSecretKey}
            onChange={(v: string) => setConfig({ ...config, turnstileSecretKey: v })}
            helpText="Chave privada para validação no backend" />
        </div>
      )}

      <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Sobre o Turnstile</h4>
        <ul className="text-xs text-on-surface-variant space-y-2">
          <li className="flex gap-2"><span className="text-primary">•</span> CAPTCHA invisível — sem puzzles para o usuário</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Protege formulários de login, registro e magic link</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Gratuito até 1M de verificações/mês</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Configure em <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">dash.cloudflare.com</a></li>
        </ul>
      </div>

      {!config.turnstileEnabled && (
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
          <p className="text-xs text-amber-500">⚠️ Sem proteção CAPTCHA, o sistema fica vulnerável a ataques automatizados de força bruta.</p>
        </div>
      )}

      <div className="pt-4 flex justify-end">
        <button onClick={handleSave} disabled={isPending} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl">
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar
        </button>
      </div>
    </div>
  );

  const renderPanel = () => {
    switch (activeSection) {
      case 'passwords': return renderPasswordsPanel();
      case 'bruteforce': return renderBruteForcePanel();
      case 'sessions': return renderSessionsPanel();
      case 'captcha': return renderCaptchaPanel();
      default: return null;
    }
  };

  const getSectionStatus = (id: SecuritySection): boolean => {
    switch (id) {
      case 'passwords': return config.passwordMinLength >= 8;
      case 'bruteforce': return config.maxLoginAttempts > 0;
      case 'sessions': return config.sessionMaxAge > 0;
      case 'captcha': return !!config.turnstileEnabled;
      default: return false;
    }
  };

  return (
    <div className="flex gap-6 min-h-[500px]">

      {/* ── Sidebar ── */}
      <div className="w-72 shrink-0">
        <div className="card bg-surface p-3 sticky top-6">
          <div className="px-3 py-2 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Segurança</p>
          </div>
          <nav className="space-y-0.5">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              const isConfigured = getSectionStatus(section.id);

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? 'bg-primary/20' : 'bg-surface-container-lowest'
                  }`}>
                    <Icon size={16} />
                  </div>
                  <span className="text-sm font-semibold flex-1">{section.label}</span>
                  <StatusDot active={isConfigured} />
                </button>
              );
            })}
          </nav>

          {/* Security summary */}
          <div className="mt-4 mx-3 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Resumo</p>
            <div className="space-y-1.5 text-xs text-on-surface-variant">
              <div className="flex items-center justify-between">
                <span>Senha mínima</span>
                <span className="font-mono font-bold text-on-surface">{config.passwordMinLength} chars</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Bloqueio após</span>
                <span className="font-mono font-bold text-on-surface">{config.maxLoginAttempts} tentativas</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Sessão</span>
                <span className="font-mono font-bold text-on-surface">{Math.floor(config.sessionMaxAge / 3600)}h</span>
              </div>
              <div className="flex items-center justify-between">
                <span>CAPTCHA</span>
                <span className={`font-bold ${config.turnstileEnabled ? 'text-green-500' : 'text-amber-500'}`}>
                  {config.turnstileEnabled ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Config Panel ── */}
      <div className="flex-1">
        <div className="card bg-surface p-8">
          {renderPanel()}
        </div>
      </div>
    </div>
  );
}
