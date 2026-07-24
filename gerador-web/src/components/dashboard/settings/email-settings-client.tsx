'use client';

import { useState, useTransition } from 'react';
import { Mail, Server, Save, Loader2, Send, Settings, TestTube2 } from 'lucide-react';
import { toast } from 'sonner';
import { updateEmailConfig } from '@/actions/email-config';
import { sendTestEmail } from '@/actions/test-email';

interface EmailSettingsClientProps {
  initialConfig: any;
}

// ═══════════════════════════════════════
// Brand Icons
// ═══════════════════════════════════════

function ResendIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M2 6l10 7 10-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ═══════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════

function StatusDot({ active }: { active: boolean }) {
  return <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-green-500' : 'bg-outline-variant/30'}`} />;
}

function InputField({ label, placeholder, value, onChange, type = 'text', helpText, required = false, className = '' }: any) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input bg-surface-container-lowest mt-1"
        placeholder={placeholder}
        value={value || ''}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        required={required}
      />
      {helpText && <p className="text-[11px] text-on-surface-variant mt-1">{helpText}</p>}
    </div>
  );
}

// ═══════════════════════════════════════

type EmailSection = 'provider' | 'sender' | 'test';

const EMAIL_SECTIONS: { id: EmailSection; label: string; icon: any }[] = [
  { id: 'provider', label: 'Provedor', icon: Server },
  { id: 'sender', label: 'Remetente', icon: Mail },
  { id: 'test', label: 'Testar Envio', icon: TestTube2 },
];

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════

export default function EmailSettingsClient({ initialConfig }: EmailSettingsClientProps) {
  const [config, setConfig] = useState(initialConfig);
  const [testEmail, setTestEmail] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isTesting, setIsTesting] = useState(false);
  const [activeSection, setActiveSection] = useState<EmailSection>('provider');

  const handleSave = async () => {
    startTransition(async () => {
      const dataToSave = {
        ...config,
        smtpPort: config.smtpPort ? parseInt(config.smtpPort.toString(), 10) : null
      };
      const res = await updateEmailConfig(dataToSave);
      if (res.success) toast.success('Configurações de e-mail salvas com sucesso.');
      else toast.error(res.error || 'Erro ao salvar configurações.');
    });
  };

  const handleTestEmail = async () => {
    if (!testEmail) { toast.error('Informe um e-mail válido para o teste.'); return; }
    setIsTesting(true);
    const res = await sendTestEmail(testEmail);
    if (res.success) { toast.success('E-mail de teste enviado com sucesso!'); setTestEmail(''); }
    else toast.error(res.error || 'Falha ao enviar o e-mail de teste.');
    setIsTesting(false);
  };

  const isProviderConfigured = () => {
    if (config.provider === 'resend') return !!config.apiKey;
    if (config.provider === 'smtp') return !!config.smtpHost && !!config.smtpPort;
    return false;
  };

  const isSenderConfigured = () => !!config.fromEmail && !!config.fromName;

  // ═══════════════════════════════════════
  // Panel renderers
  // ═══════════════════════════════════════

  const renderProviderPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-on-surface">Provedor de E-mail</h3>
        <p className="text-sm text-on-surface-variant mt-1">Escolha como o sistema despachará as mensagens.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setConfig({ ...config, provider: 'resend' })}
          className={`p-5 rounded-xl border flex flex-col items-center gap-3 transition-all ${
            config.provider === 'resend'
              ? 'bg-primary/10 border-primary text-primary ring-1 ring-primary/20'
              : 'bg-surface-container-lowest border-outline-variant/20 hover:bg-surface-container text-on-surface-variant'
          }`}
        >
          <ResendIcon size={28} />
          <div className="text-center">
            <span className="font-semibold text-sm block">Resend API</span>
            <span className="text-[11px] opacity-70">Serviço gerenciado</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setConfig({ ...config, provider: 'smtp' })}
          className={`p-5 rounded-xl border flex flex-col items-center gap-3 transition-all ${
            config.provider === 'smtp'
              ? 'bg-primary/10 border-primary text-primary ring-1 ring-primary/20'
              : 'bg-surface-container-lowest border-outline-variant/20 hover:bg-surface-container text-on-surface-variant'
          }`}
        >
          <Server size={28} />
          <div className="text-center">
            <span className="font-semibold text-sm block">Servidor SMTP</span>
            <span className="text-[11px] opacity-70">Servidor próprio</span>
          </div>
        </button>
      </div>

      {config.provider === 'resend' && (
        <div className="space-y-4 pt-4 border-t border-outline-variant/10">
          <h4 className="text-sm font-semibold text-on-surface">Credenciais Resend</h4>
          <InputField
            label="Chave da API (API Key)"
            type="password"
            placeholder="re_..."
            value={config.apiKey}
            onChange={(v: string) => setConfig({ ...config, apiKey: v })}
            helpText="Crie sua chave gratuitamente no painel do Resend."
          />
        </div>
      )}

      {config.provider === 'smtp' && (
        <div className="space-y-4 pt-4 border-t border-outline-variant/10">
          <h4 className="text-sm font-semibold text-on-surface">Credenciais SMTP</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField label="Host (Servidor)" placeholder="smtp.mailtrap.io" value={config.smtpHost}
              onChange={(v: string) => setConfig({ ...config, smtpHost: v })} className="md:col-span-2" />
            <InputField label="Porta" type="number" placeholder="587" value={config.smtpPort}
              onChange={(v: string) => setConfig({ ...config, smtpPort: v })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Usuário" placeholder="Seu usuário" value={config.smtpUser}
              onChange={(v: string) => setConfig({ ...config, smtpUser: v })} />
            <InputField label="Senha" type="password" placeholder="••••••••" value={config.smtpPass}
              onChange={(v: string) => setConfig({ ...config, smtpPass: v })} />
          </div>
        </div>
      )}

      <div className="pt-4 flex justify-end">
        <button onClick={handleSave} disabled={isPending} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl">
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar Configurações
        </button>
      </div>
    </div>
  );

  const renderSenderPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-on-surface">Dados do Remetente</h3>
        <p className="text-sm text-on-surface-variant mt-1">Configure o nome e e-mail que aparecerão como remetente nas mensagens.</p>
      </div>

      <div className="space-y-4">
        <InputField
          label="Nome de Exibição"
          placeholder="Ex: AuthForge Security"
          value={config.fromName}
          onChange={(v: string) => setConfig({ ...config, fromName: v })}
          helpText="O nome que aparece no campo 'De:' do e-mail"
        />
        <InputField
          label="E-mail de Envio"
          type="email"
          placeholder="Ex: noreply@seudominio.com"
          value={config.fromEmail}
          onChange={(v: string) => setConfig({ ...config, fromEmail: v })}
          helpText="O endereço de e-mail do remetente"
        />
      </div>

      <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Dicas</h4>
        <ul className="text-xs text-on-surface-variant space-y-2">
          <li className="flex gap-2"><span className="text-primary">•</span> Use um endereço <code className="text-primary">noreply@</code> para notificações automáticas</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Configure SPF/DKIM no seu DNS para evitar a caixa de spam</li>
          <li className="flex gap-2"><span className="text-primary">•</span> O domínio do e-mail deve estar verificado no provedor</li>
        </ul>
      </div>

      <div className="pt-4 flex justify-end">
        <button onClick={handleSave} disabled={isPending} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl">
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar Remetente
        </button>
      </div>
    </div>
  );

  const renderTestPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-on-surface">Envio de Teste</h3>
        <p className="text-sm text-on-surface-variant mt-1">Verifique se o AuthForge consegue enviar e-mails com as credenciais configuradas.</p>
      </div>

      {!isProviderConfigured() && (
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
          <p className="text-xs text-amber-500">⚠️ Configure e salve as credenciais do provedor antes de testar o envio.</p>
        </div>
      )}

      <div className="space-y-4">
        <InputField
          label="E-mail de Destino"
          type="email"
          placeholder="teste@seudominio.com"
          value={testEmail}
          onChange={(v: string) => setTestEmail(v)}
          helpText="O e-mail de teste será enviado para este endereço"
        />

        <button
          type="button"
          onClick={handleTestEmail}
          disabled={isTesting || !testEmail}
          className="w-full btn-primary flex items-center justify-center gap-2 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Disparar E-mail de Teste
        </button>
      </div>

      <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">O que o teste verifica</h4>
        <ul className="text-xs text-on-surface-variant space-y-2">
          <li className="flex gap-2"><span className="text-primary">•</span> Conexão com o provedor (Resend ou SMTP)</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Autenticação com as credenciais configuradas</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Entrega do e-mail ao destinatário</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Formato do remetente (From: nome e e-mail)</li>
        </ul>
      </div>
    </div>
  );

  const renderPanel = () => {
    switch (activeSection) {
      case 'provider': return renderProviderPanel();
      case 'sender': return renderSenderPanel();
      case 'test': return renderTestPanel();
      default: return null;
    }
  };

  const getSectionStatus = (id: EmailSection): boolean => {
    switch (id) {
      case 'provider': return isProviderConfigured();
      case 'sender': return isSenderConfigured();
      case 'test': return false;
      default: return false;
    }
  };

  return (
    <div className="flex gap-6 min-h-[500px]">

      {/* ── Sidebar ── */}
      <div className="w-72 shrink-0">
        <div className="card bg-surface p-3 sticky top-6">
          <div className="px-3 py-2 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Configurações</p>
          </div>
          <nav className="space-y-0.5">
            {EMAIL_SECTIONS.map((section) => {
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
                  {section.id !== 'test' && <StatusDot active={isConfigured} />}
                </button>
              );
            })}
          </nav>

          {/* Provider info */}
          <div className="mt-4 mx-3 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Provedor ativo</p>
            <div className="flex items-center gap-2">
              {config.provider === 'resend' ? <Mail size={14} className="text-primary" /> : <Server size={14} className="text-primary" />}
              <span className="text-sm font-semibold text-on-surface">{config.provider === 'resend' ? 'Resend API' : 'SMTP'}</span>
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
