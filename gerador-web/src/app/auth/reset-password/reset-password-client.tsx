'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resetPasswordWithToken } from '@/actions/auth';
import { Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordClient({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setLoading(true);
    const result = await resetPasswordWithToken(token, password);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        router.push('/login?message=Senha_Redefinida');
      }, 2000);
    } else {
      setError(result.error || 'Erro ao redefinir a senha.');
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-surface-container rounded-3xl p-8 shadow-2xl border border-outline-variant/20 text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="text-primary" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-on-surface mb-2">Senha Redefinida</h1>
          <p className="text-on-surface-variant mb-6">Sua senha foi redefinida com sucesso. Redirecionando para o login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-surface-container rounded-3xl p-8 shadow-2xl border border-outline-variant/20">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="text-primary" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-on-surface mb-2">Redefinir Senha</h1>
          <p className="text-sm text-on-surface-variant">
            Crie uma nova senha para <strong>{email}</strong>
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-error/10 border border-error/20 flex gap-3 text-error">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-on-surface ml-1">Nova Senha</label>
            <div className="relative">
              <input
                type="password"
                required
                className="input w-full pl-11"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
              />
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-on-surface ml-1">Confirmar Nova Senha</label>
            <div className="relative">
              <input
                type="password"
                required
                className="input w-full pl-11"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
              />
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full h-12 text-base font-semibold mt-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
