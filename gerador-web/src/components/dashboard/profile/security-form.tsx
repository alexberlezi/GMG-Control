'use client';

import { useState, useEffect } from 'react';
import { updatePassword } from '@/actions/profile';
import { generate2FASecret, verifyAndEnable2FA, disable2FA } from '@/actions/2fa';
import { toast } from 'sonner';
import { Loader2, KeyRound, ShieldCheck, ShieldAlert, X, Copy, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SecurityForm({ twoFactorEnabled, authProvider = 'local' }: { twoFactorEnabled: boolean; authProvider?: string }) {
  const isExternal = authProvider !== 'local';
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('As novas senhas não coincidem.');
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setIsPending(true);
    
    const res = await updatePassword(currentPassword, newPassword);
    
    if (res.success) {
      toast.success('Senha atualizada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      toast.error(res.error || 'Falha ao alterar senha.');
    }
    
    setIsPending(false);
  };

  // 2FA States
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [tokenCode, setTokenCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [is2FAPending, setIs2FAPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const start2FASetup = async () => {
    setIs2FAPending(true);
    const res = await generate2FASecret();
    if (res.success && res.qrCodeDataUrl) {
      setQrCodeUrl(res.qrCodeDataUrl);
      setSecret(res.secret || '');
      setSetupModalOpen(true);
    } else {
      toast.error(res.error || 'Erro ao iniciar 2FA');
    }
    setIs2FAPending(false);
  };

  const verify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIs2FAPending(true);
    const res = await verifyAndEnable2FA(tokenCode);
    if (res.success && res.backupCodes) {
      toast.success('Autenticação em duas etapas ativada!');
      setBackupCodes(res.backupCodes);
      setSetupModalOpen(false);
      setBackupModalOpen(true);
      router.refresh();
    } else {
      toast.error(res.error || 'Código inválido');
    }
    setIs2FAPending(false);
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIs2FAPending(true);
    const res = await disable2FA(currentPassword); // Re-using currentPassword state for disable confirmation
    if (res.success) {
      toast.success('2FA desativado com sucesso.');
      setDisableModalOpen(false);
      setCurrentPassword('');
      router.refresh();
    } else {
      toast.error(res.error || 'Senha incorreta');
    }
    setIs2FAPending(false);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {!isExternal && (
      <div className="card p-6 bg-surface border border-outline-variant/30 rounded-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-error/10 text-error flex items-center justify-center">
          <KeyRound size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-on-surface">Segurança</h2>
          <p className="text-xs text-on-surface-variant">Altere sua senha de acesso.</p>
        </div>
      </div>
      
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="label">Senha Atual</label>
          <input
            type="password"
            required
            className="input bg-surface-container-lowest mt-1"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="label">Nova Senha</label>
            <input
              type="password"
              required
              minLength={8}
              className="input bg-surface-container-lowest mt-1"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Confirmar Nova Senha</label>
            <input
              type="password"
              required
              minLength={8}
              className="input bg-surface-container-lowest mt-1"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" disabled={isPending} className="btn-primary px-6 py-2 rounded-xl bg-error hover:bg-error/90 text-white">
            {isPending ? <Loader2 size={18} className="animate-spin" /> : 'Atualizar Senha'}
          </button>
        </div>
      </form>
    </div>
      )}

    {/* 2FA Section */}
    <div className="card p-6 bg-surface border border-outline-variant/30 rounded-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${twoFactorEnabled ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'}`}>
          {twoFactorEnabled ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
        </div>
        <div>
          <h2 className="text-lg font-bold text-on-surface">Autenticação em Duas Etapas (2FA)</h2>
          <p className="text-xs text-on-surface-variant">
            {twoFactorEnabled ? 'Sua conta está protegida com segurança extra.' : 'Adicione uma camada extra de segurança à sua conta.'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
        <div>
          <span className="font-semibold block text-sm">Status: {twoFactorEnabled ? <span className="text-primary">Ativo</span> : <span className="text-on-surface-variant">Inativo</span>}</span>
          <span className="text-xs text-on-surface-variant mt-1 block">Requer um aplicativo como Authy ou Google Authenticator.</span>
        </div>
        {twoFactorEnabled ? (
          <button onClick={() => setDisableModalOpen(true)} className="btn btn-ghost text-error hover:bg-error/10">Desativar</button>
        ) : (
          <button onClick={start2FASetup} disabled={is2FAPending} className="btn btn-primary">
            {is2FAPending ? <Loader2 size={16} className="animate-spin" /> : 'Configurar 2FA'}
          </button>
        )}
      </div>
    </div>

    {/* Setup Modal */}
    {setupModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSetupModalOpen(false)} />
        <div className="relative w-full max-w-md bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-bold text-on-surface">Configurar 2FA</h2>
              <p className="text-sm text-on-surface-variant mt-1">Escaneie o QR Code com seu app autenticador.</p>
            </div>
            <button onClick={() => setSetupModalOpen(false)} className="btn-icon">
              <X size={18} />
            </button>
          </div>

          <div className="flex justify-center bg-white p-4 rounded-xl my-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />}
          </div>
          
          <div className="text-center mb-6">
            <span className="text-xs text-on-surface-variant">Ou insira o código manualmente:</span>
            <code className="block mt-1 p-2 bg-surface-container-lowest rounded text-sm font-mono tracking-widest">{secret}</code>
          </div>

          <form onSubmit={verify2FA}>
            <label className="label">Código de Verificação</label>
            <input
              type="text"
              required
              placeholder="000000"
              className="input bg-surface-container-lowest text-center tracking-widest text-lg py-3"
              value={tokenCode}
              onChange={e => setTokenCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            />
            <button type="submit" disabled={is2FAPending || tokenCode.length < 6} className="btn-primary w-full mt-4 py-2.5">
              {is2FAPending ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Verificar e Ativar'}
            </button>
          </form>
        </div>
      </div>
    )}

    {/* Backup Codes Modal */}
    {backupModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-md bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-xl font-bold text-on-surface">2FA Ativado!</h2>
            <p className="text-sm text-on-surface-variant mt-2">Salve estes códigos de backup em um local seguro. Eles são a única forma de acessar sua conta caso você perca seu dispositivo.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6 bg-surface-container-lowest p-4 rounded-xl">
            {backupCodes.map((code, idx) => (
              <code key={idx} className="text-sm font-mono text-center block p-2 bg-surface-variant/30 rounded">{code}</code>
            ))}
          </div>

          <button onClick={copyBackupCodes} className="btn btn-ghost w-full mb-3 flex items-center justify-center gap-2 rounded-xl">
            {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
            {copied ? 'Copiado!' : 'Copiar Códigos'}
          </button>
          <button onClick={() => setBackupModalOpen(false)} className="btn btn-primary w-full py-2.5 rounded-xl">
            Entendi, já salvei
          </button>
        </div>
      </div>
    )}

    {/* Disable 2FA Modal */}
    {disableModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDisableModalOpen(false)} />
        <div className="relative w-full max-w-sm bg-surface-container border border-error/20 rounded-2xl shadow-2xl p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-bold text-error">Desativar 2FA</h2>
              <p className="text-sm text-on-surface-variant mt-1">Sua conta ficará menos segura.</p>
            </div>
            <button onClick={() => setDisableModalOpen(false)} className="btn-icon">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleDisable2FA}>
            <label className="label">Confirme sua Senha Atual</label>
            <input
              type="password"
              required
              className="input bg-surface-container-lowest mt-1"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
            />
            
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setDisableModalOpen(false)} className="btn btn-ghost flex-1">Cancelar</button>
              <button type="submit" disabled={is2FAPending || !currentPassword} className="btn btn-primary flex-1 bg-error hover:bg-error/90 text-white">
                {is2FAPending ? <Loader2 size={16} className="animate-spin" /> : 'Desativar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    </div>
  );
}
