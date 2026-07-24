'use client';

import { useState, useTransition, useRef } from 'react';
import { Palette, Image as ImageIcon, LayoutTemplate, Save, Loader2, Info, UploadCloud, Type, Paintbrush } from 'lucide-react';
import { toast } from 'sonner';
import { updateThemeConfig } from '@/actions/theme-config';
import { uploadBrandingImage } from '@/actions/upload';

interface AppearanceSettingsClientProps {
  initialConfig: any;
}

// ═══════════════════════════════════════
// Sub-components (outside to prevent re-creation)
// ═══════════════════════════════════════

function StatusDot({ active }: { active: boolean }) {
  return <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-green-500' : 'bg-outline-variant/30'}`} />;
}

function InputField({ label, placeholder, value, onChange, type = 'text', helpText, required = false }: any) {
  return (
    <div>
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

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label mb-2 block">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm border border-outline-variant/20 flex-shrink-0 cursor-pointer">
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="input bg-surface-container-lowest font-mono uppercase"
          placeholder="#FFFFFF"
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════

type AppearanceSection = 'identity' | 'logos' | 'colors' | 'login';

const SECTIONS: { id: AppearanceSection; label: string; icon: any }[] = [
  { id: 'identity', label: 'Identidade', icon: Type },
  { id: 'logos', label: 'Logotipos', icon: ImageIcon },
  { id: 'colors', label: 'Cores e Tema', icon: Palette },
  { id: 'login', label: 'Tela de Login', icon: LayoutTemplate },
];

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════

export default function AppearanceSettingsClient({ initialConfig }: AppearanceSettingsClientProps) {
  const [config, setConfig] = useState(initialConfig);
  const [isPending, startTransition] = useTransition();
  const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<AppearanceSection>('identity');

  const handleSave = async () => {
    startTransition(async () => {
      const res = await updateThemeConfig(config);
      if (res.success) {
        toast.success('Aparência atualizada! A página será recarregada.');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error(res.error || 'Erro ao atualizar aparência.');
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string, configKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingState(prev => ({ ...prev, [type]: true }));
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    const res = await uploadBrandingImage(formData);
    if (res.success && res.url) {
      setConfig((prev: any) => ({ ...prev, [configKey]: res.url }));
      toast.success('Imagem enviada!');
    } else toast.error(res.error || 'Falha no upload.');
    setUploadingState(prev => ({ ...prev, [type]: false }));
    e.target.value = '';
  };

  const ImageUploader = ({ label, type, configKey, placeholderText, previewStyle }: any) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const imageUrl = config[configKey];
    const isUploading = uploadingState[type];
    return (
      <div>
        <label className="label mb-2 block">{label}</label>
        <div
          onClick={() => !isUploading && inputRef.current?.click()}
          className={`relative overflow-hidden group cursor-pointer border-2 border-dashed rounded-xl transition-all
            ${imageUrl ? 'border-outline-variant/30 bg-surface-container-lowest' : 'border-outline-variant/30 hover:border-primary/50 hover:bg-primary/5'}
            ${previewStyle}`}
        >
          <input type="file" ref={inputRef} className="hidden" accept="image/*"
            onChange={(e) => handleFileUpload(e, type, configKey)} />
          {isUploading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container/80 backdrop-blur-sm z-10">
              <Loader2 size={24} className="animate-spin text-primary mb-2" />
              <span className="text-xs font-medium text-primary">Enviando...</span>
            </div>
          ) : imageUrl ? (
            <>
              <div className="absolute inset-0 p-4 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
              </div>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white z-10">
                <UploadCloud size={24} className="mb-2" />
                <span className="text-xs font-medium">Trocar Imagem</span>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant">
              <UploadCloud size={24} className="mb-2 opacity-50" />
              <span className="text-xs font-medium">{placeholderText}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getSectionStatus = (id: AppearanceSection): boolean => {
    switch (id) {
      case 'identity': return !!config.projectName;
      case 'logos': return !!(config.logoLightUrl || config.logoDarkUrl);
      case 'colors': return !!config.primaryColor;
      case 'login': return !!config.loginLayout;
      default: return false;
    }
  };

  // ═══════════════════════════════════════
  // Panel renderers
  // ═══════════════════════════════════════

  const renderIdentityPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-on-surface">Identidade do Sistema</h3>
        <p className="text-sm text-on-surface-variant mt-1">Defina o nome e a empresa que aparecerão no topo do sistema e nos e-mails.</p>
      </div>

      <div className="space-y-4">
        <InputField
          label="Nome do Projeto"
          placeholder="Ex: AuthForge"
          value={config.projectName}
          onChange={(v: string) => setConfig({ ...config, projectName: v })}
          helpText="Aparece no menu lateral, e-mails e título das páginas"
          required
        />
        <InputField
          label="Nome da Empresa (Razão Social)"
          placeholder="Ex: Hidropan S.A."
          value={config.companyName}
          onChange={(v: string) => setConfig({ ...config, companyName: v })}
          helpText="Pode ser usado em rodapés e comunicações oficiais"
        />
      </div>

      <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Onde aparece</h4>
        <ul className="text-xs text-on-surface-variant space-y-2">
          <li className="flex gap-2"><span className="text-primary">•</span> Sidebar do painel de administração</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Tela de login e cadastro</li>
          <li className="flex gap-2"><span className="text-primary">•</span> E-mails transacionais (convites, magic link, 2FA)</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Título das abas do navegador</li>
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

  const renderLogosPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-on-surface">Logotipos</h3>
        <p className="text-sm text-on-surface-variant mt-1">Clique nos quadros para enviar as imagens da sua marca.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ImageUploader
          label="Favicon (Navegador)"
          type="favicon"
          configKey="faviconUrl"
          placeholderText="Upload Favicon"
          previewStyle="w-full h-36"
        />
        <ImageUploader
          label="Logo (Modo Claro)"
          type="logo-light"
          configKey="logoLightUrl"
          placeholderText="Upload Logo"
          previewStyle="w-full h-36 bg-white"
        />
        <ImageUploader
          label="Logo (Modo Escuro)"
          type="logo-dark"
          configKey="logoDarkUrl"
          placeholderText="Upload Logo"
          previewStyle="w-full h-36 bg-gray-900"
        />
      </div>

      <div className="p-5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Recomendações</h4>
        <ul className="text-xs text-on-surface-variant space-y-2">
          <li className="flex gap-2"><span className="text-primary">•</span> Use imagens em formato <strong>PNG</strong> ou <strong>SVG</strong> com fundo transparente</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Favicon ideal: 32x32 ou 64x64 pixels</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Logotipo ideal: largura máxima de 400px</li>
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

  const renderColorsPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-on-surface">Cores e Tema (White-Label)</h3>
        <p className="text-sm text-on-surface-variant mt-1">Estas cores serão injetadas globalmente em todo o sistema.</p>
      </div>

      <div className="space-y-6">
        <ColorInput label="Cor Primária (Botões, Menus ativos e Hover)" value={config.primaryColor} onChange={v => setConfig({ ...config, primaryColor: v })} />
        <ColorInput label="Cor Secundária (Sucesso, Badges)" value={config.secondaryColor} onChange={v => setConfig({ ...config, secondaryColor: v })} />
        <ColorInput label="Cor de Destaque / Accent (Focos, Animações)" value={config.accentColor} onChange={v => setConfig({ ...config, accentColor: v })} />
      </div>

      <div className="flex gap-3 bg-primary/10 p-4 rounded-xl text-primary">
        <Info size={20} className="shrink-0 mt-0.5" />
        <p className="text-sm">
          As alterações de cor serão aplicadas <strong>globalmente em tempo real</strong> após salvar.
          O sistema inteiro mudará para refletir as novas cores da sua marca.
        </p>
      </div>

      <div className="pt-4 flex justify-end">
        <button onClick={handleSave} disabled={isPending} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl">
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar Cores
        </button>
      </div>
    </div>
  );

  const renderLoginPanel = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-on-surface">Layout da Tela de Login</h3>
        <p className="text-sm text-on-surface-variant mt-1">Escolha o estilo visual para a tela de autenticação.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Centered */}
        <div
          onClick={() => setConfig({ ...config, loginLayout: 'centered' })}
          className={`cursor-pointer rounded-xl border-2 transition-all p-4 ${config.loginLayout === 'centered' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-outline-variant/30 hover:border-primary/50'}`}
        >
          <div className="h-24 bg-surface-container-lowest border border-outline-variant/20 rounded-lg flex items-center justify-center mb-3">
            <div className="w-16 h-20 bg-surface shadow-sm border border-outline-variant/10 rounded" />
          </div>
          <div className="font-semibold text-center text-sm">Centralizado</div>
          <div className="text-[10px] text-center text-on-surface-variant mt-1">Card clássico no centro</div>
        </div>

        {/* Split */}
        <div
          onClick={() => setConfig({ ...config, loginLayout: 'split' })}
          className={`cursor-pointer rounded-xl border-2 transition-all p-4 ${config.loginLayout === 'split' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-outline-variant/30 hover:border-primary/50'}`}
        >
          <div className="h-24 bg-surface-container-lowest border border-outline-variant/20 rounded-lg flex overflow-hidden mb-3">
            <div className="flex-1 bg-primary/20 flex items-center justify-center">
              <ImageIcon size={16} className="text-primary/50" />
            </div>
            <div className="flex-1 bg-surface flex items-center justify-center">
              <div className="w-10 h-14 bg-surface shadow-sm border border-outline-variant/10 rounded" />
            </div>
          </div>
          <div className="font-semibold text-center text-sm">Dividido (Split)</div>
          <div className="text-[10px] text-center text-on-surface-variant mt-1">Metade marca, metade form</div>
        </div>

        {/* Minimal */}
        <div
          onClick={() => setConfig({ ...config, loginLayout: 'minimal' })}
          className={`cursor-pointer rounded-xl border-2 transition-all p-4 ${config.loginLayout === 'minimal' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-outline-variant/30 hover:border-primary/50'}`}
        >
          <div className="h-24 bg-surface-container-lowest border border-outline-variant/20 rounded-lg flex flex-col justify-center px-4 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 mb-2" />
            <div className="w-2/3 h-2 bg-surface-container-high rounded mb-1" />
            <div className="w-1/2 h-2 bg-surface-container-high rounded" />
          </div>
          <div className="font-semibold text-center text-sm">Minimalista</div>
          <div className="text-[10px] text-center text-on-surface-variant mt-1">Foco total no formulário</div>
        </div>
      </div>

      {/* Theme Mode */}
      <div className="pt-6 border-t border-outline-variant/10">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-on-surface">Tema do Sistema</h4>
            <p className="text-xs text-on-surface-variant mt-1">Modo padrão para login e painel.</p>
          </div>
          <div className="flex bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/20">
            <button type="button" onClick={() => setConfig({ ...config, defaultTheme: 'light' })}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${config.defaultTheme === 'light' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}>
              Claro
            </button>
            <button type="button" onClick={() => setConfig({ ...config, defaultTheme: 'dark' })}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${config.defaultTheme === 'dark' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}>
              Escuro
            </button>
          </div>
        </div>
      </div>

      {/* Split layout texts */}
      {config.loginLayout === 'split' && (
        <div className="pt-6 border-t border-outline-variant/10 space-y-4">
          <h4 className="text-sm font-bold text-on-surface">Textos do Layout Dividido</h4>
          <InputField label="Badge (Pílula no topo)" value={config.loginPillText} placeholder="Ex: Bem-vindo ao Sistema"
            onChange={(v: string) => setConfig({ ...config, loginPillText: v })} />
          <InputField label="Título Principal" value={config.loginTitleText} placeholder="Ex: Acesso centralizado para a sua organização."
            onChange={(v: string) => setConfig({ ...config, loginTitleText: v })} />
          <div>
            <label className="label">Subtítulo (Descrição)</label>
            <textarea className="input bg-surface-container-lowest mt-1 min-h-[80px]" value={config.loginSubtitleText || ''}
              onChange={e => setConfig({ ...config, loginSubtitleText: e.target.value })}
              placeholder="Ex: Plataforma corporativa de autenticação e gestão de acessos." />
          </div>
        </div>
      )}

      <div className="pt-4 flex justify-end">
        <button onClick={handleSave} disabled={isPending} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl">
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar Layout
        </button>
      </div>
    </div>
  );

  const renderPanel = () => {
    switch (activeSection) {
      case 'identity': return renderIdentityPanel();
      case 'logos': return renderLogosPanel();
      case 'colors': return renderColorsPanel();
      case 'login': return renderLoginPanel();
      default: return null;
    }
  };

  return (
    <div className="flex gap-6 min-h-[500px]">

      {/* ── Sidebar ── */}
      <div className="w-72 shrink-0">
        <div className="card bg-surface p-3 sticky top-6">
          <div className="px-3 py-2 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Personalização</p>
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

          {/* Color preview */}
          <div className="mt-4 mx-3 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Cores atuais</p>
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-lg shadow-sm border border-outline-variant/10" style={{ backgroundColor: config.primaryColor }} title="Primária" />
              <div className="w-8 h-8 rounded-lg shadow-sm border border-outline-variant/10" style={{ backgroundColor: config.secondaryColor }} title="Secundária" />
              <div className="w-8 h-8 rounded-lg shadow-sm border border-outline-variant/10" style={{ backgroundColor: config.accentColor }} title="Accent" />
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
