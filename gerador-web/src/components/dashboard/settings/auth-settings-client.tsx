'use client';

import { useState, useTransition } from 'react';
import { Mail, Link2, Server, Shield, Loader2, Save, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { updateAuthConfig } from '@/actions/auth-config';
import { saveLdapConfig, testLdapConnectionAction } from '@/actions/ldap-config';

interface AuthSettingsClientProps {
  initialConfig: any;
}

// ═══════════════════════════════════════
// Brand SVG Icons
// ═══════════════════════════════════════

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function MicrosoftIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 23 23" fill="none">
      <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
      <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
    </svg>
  );
}

// ═══════════════════════════════════════
// Stable sub-components
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

function ToggleRow({ title, description, checked, onChange, disabled = false, warning = null }: any) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-on-surface">{title}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">{description}</p>
        </div>
        <Switch checked={checked} onChange={onChange} disabled={disabled} />
      </div>
      {warning && (
        <div className="mt-2 text-[11px] text-amber-500 bg-amber-500/10 p-2 rounded-md">
          {warning}
        </div>
      )}
    </div>
  );
}

function InputField({ label, placeholder, value, onChange, type = 'text', helpText }: any) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input bg-surface-container-lowest mt-1"
        placeholder={placeholder}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
      {helpText && <p className="text-[11px] text-on-surface-variant mt-1">{helpText}</p>}
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-green-500' : 'bg-outline-variant/30'}`} />
  );
}

// ═══════════════════════════════════════

type AuthMethod = 'email' | 'magiclink' | 'google' | 'github' | 'microsoft' | 'ldap' | 'security';

interface MethodItem {
  id: AuthMethod;
  label: string;
  icon: any;
  isBrandIcon?: boolean;
  configKey?: string;
}

const AUTH_METHODS: MethodItem[] = [
  { id: 'email', label: 'E-mail e Senha', icon: Mail, configKey: 'emailPasswordEnabled' },
  { id: 'magiclink', label: 'Magic Link', icon: Link2, configKey: 'magicLinkEnabled' },
  { id: 'google', label: 'Google', icon: GoogleIcon, isBrandIcon: true, configKey: 'googleEnabled' },
  { id: 'github', label: 'GitHub', icon: GitHubIcon, isBrandIcon: true, configKey: 'githubEnabled' },
  { id: 'microsoft', label: 'Microsoft', icon: MicrosoftIcon, isBrandIcon: true, configKey: 'microsoftEnabled' },
  { id: 'ldap', label: 'LDAP / Active Directory', icon: Server, configKey: 'ldapEnabled' },
  { id: 'security', label: 'MFA / 2FA', icon: Shield },
];

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════

export default function AuthSettingsClient({ initialConfig }: AuthSettingsClientProps) {
  const [config, setConfig] = useState(initialConfig);
  const [isPending, startTransition] = useTransition();
  const [activeMethod, setActiveMethod] = useState<AuthMethod>('email');

  const [ldapForm, setLdapForm] = useState({
    ldapUrl: initialConfig.ldapUrl || '',
    ldapBaseDn: initialConfig.ldapBaseDn || '',
    ldapBindDn: initialConfig.ldapBindDn || '',
    ldapBindPassword: '',
    ldapSearchFilter: initialConfig.ldapSearchFilter || '(sAMAccountName={{username}})',
    ldapTlsEnabled: initialConfig.ldapTlsEnabled ?? false,
    ldapTlsAllowSelfSigned: initialConfig.ldapTlsAllowSelfSigned ?? false,
    ldapCaCert: initialConfig.ldapCaCert || '',
    ldapFallbackToLocal: initialConfig.ldapFallbackToLocal ?? true,
  });
  const [ldapSaving, setLdapSaving] = useState(false);
  const [ldapTesting, setLdapTesting] = useState(false);
  const [ldapTestResult, setLdapTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [ldapPasswordSaved, setLdapPasswordSaved] = useState(!!initialConfig.ldapBindPassword);

  const handleToggle = (key: string, value: boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    startTransition(async () => {
      const res = await updateAuthConfig({ [key]: value });
      if (res.success) toast.success('Configuração atualizada.');
      else { toast.error(res.error || 'Erro ao atualizar.'); setConfig(config); }
    });
  };

  const handleLdapSave = async () => {
    if (!ldapForm.ldapUrl || !ldapForm.ldapBaseDn || !ldapForm.ldapBindDn) {
      toast.error('Preencha pelo menos URL, Base DN e Bind DN.');
      return;
    }
    setLdapSaving(true);
    const res = await saveLdapConfig(ldapForm);
    if (res.success) {
      toast.success('Configuração LDAP salva!');
      if (ldapForm.ldapBindPassword) setLdapPasswordSaved(true);
      setLdapForm(prev => ({ ...prev, ldapBindPassword: '' }));
    } else toast.error(res.error || 'Erro ao salvar.');
    setLdapSaving(false);
  };

  const handleLdapTest = async () => {
    if (!ldapForm.ldapUrl || !ldapForm.ldapBaseDn || !ldapForm.ldapBindDn) {
      toast.error('Preencha pelo menos URL, Base DN e Bind DN.');
      return;
    }
    setLdapTesting(true);
    setLdapTestResult(null);
    const res = await testLdapConnectionAction({
      ldapUrl: ldapForm.ldapUrl, ldapBaseDn: ldapForm.ldapBaseDn, ldapBindDn: ldapForm.ldapBindDn,
      ldapBindPassword: ldapForm.ldapBindPassword, ldapSearchFilter: ldapForm.ldapSearchFilter, ldapTlsEnabled: ldapForm.ldapTlsEnabled,
      ldapTlsAllowSelfSigned: ldapForm.ldapTlsAllowSelfSigned, ldapCaCert: ldapForm.ldapCaCert,
    });
    setLdapTestResult(res);
    if (res.success) toast.success('Conexão LDAP bem-sucedida!');
    else toast.error(res.error || 'Falha na conexão.');
    setLdapTesting(false);
  };

  const handleOAuthSave = async (provider: 'google' | 'github' | 'microsoft') => {
    const keys: Record<string, { clientIdKey: string; clientSecretKey: string; enabledKey: string }> = {
      google: { clientIdKey: 'googleClientId', clientSecretKey: 'googleClientSecret', enabledKey: 'googleEnabled' },
      github: { clientIdKey: 'githubClientId', clientSecretKey: 'githubClientSecret', enabledKey: 'githubEnabled' },
      microsoft: { clientIdKey: 'microsoftClientId', clientSecretKey: 'microsoftClientSecret', enabledKey: 'microsoftEnabled' },
    };
    const k = keys[provider];
    startTransition(async () => {
      const res = await updateAuthConfig({
        [k.enabledKey]: config[k.enabledKey],
        [k.clientIdKey]: config[k.clientIdKey] || null,
        [k.clientSecretKey]: config[k.clientSecretKey] || null,
      });
      if (res.success) toast.success('Credenciais OAuth salvas!');
      else toast.error(res.error || 'Erro ao salvar.');
    });
  };

  // ═══════════════════════════════════════
  // Panel renderers
  // ═══════════════════════════════════════

  const renderEmailPanel = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-on-surface">E-mail e Senha</h3>
          <p className="text-sm text-on-surface-variant mt-1">Permite login clássico com credenciais de e-mail e senha.</p>
        </div>
        <Switch
          checked={config.emailPasswordEnabled}
          onChange={(v) => handleToggle('emailPasswordEnabled', v)}
          disabled={!config.magicLinkEnabled && !config.googleEnabled && !config.ldapEnabled}
        />
      </div>
      {!config.emailPasswordEnabled && (
        <div className="text-[11px] text-amber-500 bg-amber-500/10 p-3 rounded-xl">
          ⚠️ Apenas usuários com OAuth, LDAP ou Magic Link conseguirão logar.
        </div>
      )}
      <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Como funciona</h4>
        <ul className="text-xs text-on-surface-variant space-y-2">
          <li className="flex gap-2"><span className="text-primary">•</span> O usuário informa e-mail e senha no formulário de login</li>
          <li className="flex gap-2"><span className="text-primary">•</span> A senha é verificada usando hash Argon2id</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Rate limiting protege contra ataques de força bruta</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Suporta 2FA quando habilitado pelo usuário</li>
        </ul>
      </div>
    </div>
  );

  const renderMagicLinkPanel = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-on-surface">Magic Link (Sem Senha)</h3>
          <p className="text-sm text-on-surface-variant mt-1">Envia um link de acesso único para o e-mail do usuário.</p>
        </div>
        <Switch checked={config.magicLinkEnabled} onChange={(v) => handleToggle('magicLinkEnabled', v)} />
      </div>
      <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Como funciona</h4>
        <ul className="text-xs text-on-surface-variant space-y-2">
          <li className="flex gap-2"><span className="text-primary">•</span> O usuário informa apenas o e-mail</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Um link único com token JWT é enviado por e-mail</li>
          <li className="flex gap-2"><span className="text-primary">•</span> O link expira em 15 minutos</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Requer configuração de SMTP funcional</li>
        </ul>
      </div>
      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
        <p className="text-xs text-amber-500">⚠️ Requer configuração de e-mail SMTP ativa para funcionar.</p>
      </div>
    </div>
  );

  const renderOAuthPanel = (provider: 'google' | 'github' | 'microsoft') => {
    const labels = {
      google: {
        name: 'Google', BrandIcon: GoogleIcon, configKey: 'googleEnabled',
        clientIdKey: 'googleClientId', clientSecretKey: 'googleClientSecret',
        desc: 'Permite login usando conta Google Workspace.',
        consoleUrl: 'https://console.cloud.google.com/apis/credentials',
        consoleName: 'Google Cloud Console',
      },
      github: {
        name: 'GitHub', BrandIcon: GitHubIcon, configKey: 'githubEnabled',
        clientIdKey: 'githubClientId', clientSecretKey: 'githubClientSecret',
        desc: 'Permite login usando conta do GitHub.',
        consoleUrl: 'https://github.com/settings/developers',
        consoleName: 'GitHub Developer Settings',
      },
      microsoft: {
        name: 'Microsoft (Azure AD)', BrandIcon: MicrosoftIcon, configKey: 'microsoftEnabled',
        clientIdKey: 'microsoftClientId', clientSecretKey: 'microsoftClientSecret',
        desc: 'Permite login usando conta corporativa da Microsoft.',
        consoleUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps',
        consoleName: 'Azure Portal',
      },
    };
    const info = labels[provider];
    const callbackUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/callback/${provider}`;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-container-lowest border border-outline-variant/10 flex items-center justify-center">
              <info.BrandIcon size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">{info.name}</h3>
              <p className="text-sm text-on-surface-variant mt-0.5">{info.desc}</p>
            </div>
          </div>
          <Switch checked={config[info.configKey]} onChange={(v) => handleToggle(info.configKey, v)} />
        </div>

        <div className="space-y-4">
          <InputField label="Client ID" placeholder="Cole o Client ID do provedor"
            value={config[info.clientIdKey] || ''}
            onChange={(v: string) => setConfig((prev: any) => ({ ...prev, [info.clientIdKey]: v }))}
            helpText="Identificador público da aplicação OAuth" />

          <div>
            <label className="label">Client Secret</label>
            <input type="password" className="input bg-surface-container-lowest mt-1 font-mono text-sm"
              placeholder={config[info.clientSecretKey] ? '••••••••' : 'Cole o Client Secret'}
              value={config[info.clientSecretKey] || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig((prev: any) => ({ ...prev, [info.clientSecretKey]: e.target.value }))} />
            <p className="text-[11px] text-on-surface-variant mt-1">Chave secreta para autenticação server-side</p>
          </div>

          <div>
            <label className="label">Callback URL (Redirect URI)</label>
            <div className="flex gap-2 mt-1">
              <input type="text" readOnly className="input bg-surface-container-lowest font-mono text-xs flex-1" value={callbackUrl} />
              <button type="button" onClick={() => { navigator.clipboard.writeText(callbackUrl); toast.success('URL copiada!'); }}
                className="btn btn-secondary px-3 rounded-xl text-xs shrink-0">Copiar</button>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">Configure esta URL no console do provedor como Redirect URI</p>
          </div>

          <div className="flex gap-3 pt-2">
            <a href={info.consoleUrl} target="_blank" rel="noopener noreferrer"
              className="btn btn-secondary flex-1 rounded-xl text-center text-sm">
              Abrir {info.consoleName} ↗
            </a>
            <button onClick={() => handleOAuthSave(provider)} disabled={isPending}
              className="btn-primary flex items-center justify-center gap-2 flex-1 rounded-xl">
              {isPending ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Save size={16} /> Salvar</>}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLdapPanel = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-on-surface">LDAP / Active Directory</h3>
          <p className="text-sm text-on-surface-variant mt-1">Integração com servidor de diretório corporativo.</p>
        </div>
        <Switch checked={config.ldapEnabled} onChange={(v) => handleToggle('ldapEnabled', v)} />
      </div>

      {config.ldapEnabled && (
        <div className="space-y-4">
          <InputField label="URL do Servidor" placeholder="10.40.3.22 ou ldap://servidor:389" value={ldapForm.ldapUrl}
            onChange={(v: string) => setLdapForm(prev => ({ ...prev, ldapUrl: v }))} helpText="O protocolo ldap:// e a porta :389 são adicionados automaticamente se omitidos" />
          <InputField label="Base DN" placeholder="DC=empresa,DC=local" value={ldapForm.ldapBaseDn}
            onChange={(v: string) => setLdapForm(prev => ({ ...prev, ldapBaseDn: v }))} helpText="Raiz da árvore de busca no diretório" />
          <InputField label="Bind DN (Conta de Serviço)" placeholder="usuario@empresa.local ou CN=admin,DC=empresa,DC=local" value={ldapForm.ldapBindDn}
            onChange={(v: string) => setLdapForm(prev => ({ ...prev, ldapBindDn: v }))} helpText="Aceita formato UPN (user@dominio) ou DN completo" />

          <div>
            <label className="label">Senha do Bind</label>
            <input type="password" className="input bg-surface-container-lowest mt-1"
              placeholder={ldapPasswordSaved ? '••••••••' : 'Digite a senha de bind'}
              value={ldapForm.ldapBindPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLdapForm(prev => ({ ...prev, ldapBindPassword: e.target.value }))} />
            {ldapPasswordSaved && !ldapForm.ldapBindPassword ? (
              <p className="text-[11px] text-green-500 mt-1">✓ Senha salva no banco de dados. Deixe em branco para manter.</p>
            ) : (
              <p className="text-[11px] text-on-surface-variant mt-1">Encriptada com AES-256-GCM</p>
            )}
          </div>

          <InputField label="Filtro de Busca" placeholder="(sAMAccountName={{username}})" value={ldapForm.ldapSearchFilter}
            onChange={(v: string) => setLdapForm(prev => ({ ...prev, ldapSearchFilter: v }))} helpText="{{username}} será substituído pelo login do usuário" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ToggleRow title="TLS/SSL" description="Conexão criptografada" checked={ldapForm.ldapTlsEnabled}
              onChange={(v: boolean) => setLdapForm(prev => ({ ...prev, ldapTlsEnabled: v }))} />
            <ToggleRow title="Fallback Local" description="Se LDAP falhar, tenta senha local" checked={ldapForm.ldapFallbackToLocal}
              onChange={(v: boolean) => setLdapForm(prev => ({ ...prev, ldapFallbackToLocal: v }))} />
            
            {ldapForm.ldapTlsEnabled && (
              <ToggleRow title="Permitir Self-Signed" description="Para CA não pública" checked={ldapForm.ldapTlsAllowSelfSigned}
                onChange={(v: boolean) => setLdapForm(prev => ({ ...prev, ldapTlsAllowSelfSigned: v }))} warning={ldapForm.ldapTlsAllowSelfSigned ? "Aviso: Validação de certificado desligada." : null} />
            )}
          </div>

          {ldapForm.ldapTlsEnabled && !ldapForm.ldapTlsAllowSelfSigned && (
            <div>
              <label className="label">Certificado Root CA (Opcional)</label>
              <textarea className="input bg-surface-container-lowest mt-1 font-mono text-[10px]" rows={4}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                value={ldapForm.ldapCaCert}
                onChange={(e) => setLdapForm(prev => ({ ...prev, ldapCaCert: e.target.value }))} />
              <p className="text-[11px] text-on-surface-variant mt-1">Forneça o PEM da sua CA corporativa para validar o certificado TLS.</p>
            </div>
          )}

          {ldapTestResult && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
              ldapTestResult.success ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}>
              {ldapTestResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {ldapTestResult.success ? 'Conexão com o servidor LDAP bem-sucedida!' : ldapTestResult.error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={handleLdapTest} disabled={ldapTesting || !ldapForm.ldapUrl || !ldapForm.ldapBindDn} className="btn btn-secondary flex-1 rounded-xl">
              {ldapTesting ? <><Loader2 size={16} className="animate-spin" /> Testando...</> : <><Zap size={16} /> Testar Conexão</>}
            </button>
            <button onClick={handleLdapSave} disabled={ldapSaving || !ldapForm.ldapUrl || !ldapForm.ldapBaseDn || !ldapForm.ldapBindDn} className="btn btn-primary flex-1 rounded-xl">
              {ldapSaving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <><Save size={16} /> Salvar Configuração</>}
            </button>
          </div>
        </div>
      )}

      {!config.ldapEnabled && (
        <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 space-y-3">
          <h4 className="text-sm font-semibold text-on-surface">Como funciona</h4>
          <ul className="text-xs text-on-surface-variant space-y-2">
            <li className="flex gap-2"><span className="text-primary">•</span> Autentica usuários diretamente no Active Directory ou OpenLDAP</li>
            <li className="flex gap-2"><span className="text-primary">•</span> Provisão automática no primeiro login LDAP</li>
            <li className="flex gap-2"><span className="text-primary">•</span> Suporta fallback para senha local</li>
            <li className="flex gap-2"><span className="text-primary">•</span> Compatível com 2FA</li>
          </ul>
        </div>
      )}
    </div>
  );

  const renderSecurityPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-on-surface">Autenticação em Duas Etapas (MFA)</h3>
        <p className="text-sm text-on-surface-variant mt-1">Configure as políticas de duplo fator de autenticação.</p>
      </div>
      <ToggleRow title="Exigir Autenticação 2FA" description="Obriga todos os usuários a configurarem o Google Authenticator."
        checked={config.twoFactorRequired} onChange={(v: boolean) => handleToggle('twoFactorRequired', v)} />
      <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Sobre o 2FA</h4>
        <ul className="text-xs text-on-surface-variant space-y-2">
          <li className="flex gap-2"><span className="text-primary">•</span> Usa TOTP com Google Authenticator</li>
          <li className="flex gap-2"><span className="text-primary">•</span> 10 códigos de backup gerados automaticamente</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Segredos encriptados com AES-256-GCM</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Quando obrigatório, usuário é forçado a configurar após login</li>
        </ul>
      </div>
    </div>
  );

  const renderPanel = () => {
    switch (activeMethod) {
      case 'email': return renderEmailPanel();
      case 'magiclink': return renderMagicLinkPanel();
      case 'google': return renderOAuthPanel('google');
      case 'github': return renderOAuthPanel('github');
      case 'microsoft': return renderOAuthPanel('microsoft');
      case 'ldap': return renderLdapPanel();
      case 'security': return renderSecurityPanel();
      default: return null;
    }
  };

  return (
    <div className="flex gap-6 min-h-[600px]">

      {/* ── Sidebar ── */}
      <div className="w-72 shrink-0">
        <div className="card bg-surface p-3 sticky top-6">
          <div className="px-3 py-2 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Métodos de Autenticação</p>
          </div>
          <nav className="space-y-0.5">
            {AUTH_METHODS.map((method) => {
              const isActive = activeMethod === method.id;
              const isEnabled = method.configKey ? !!config[method.configKey] : false;

              return (
                <button
                  key={method.id}
                  onClick={() => setActiveMethod(method.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? 'bg-primary/20' : 'bg-surface-container-lowest'
                  }`}>
                    {method.isBrandIcon
                      ? <method.icon size={16} />
                      : <method.icon size={16} />
                    }
                  </div>
                  <span className="text-sm font-semibold flex-1">{method.label}</span>
                  {method.configKey && <StatusDot active={isEnabled} />}
                </button>
              );
            })}
          </nav>
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
