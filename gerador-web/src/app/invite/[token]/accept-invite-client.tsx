'use client';

import { useState, useTransition } from 'react';
import { Mail, User, Lock, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { acceptInvite } from './actions';

interface AcceptInviteClientProps {
  token: string;
  email: string;
}

export default function AcceptInviteClient({ token, email }: AcceptInviteClientProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    
    if (password.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    startTransition(async () => {
      const res = await acceptInvite(token, name, password);
      if (res.success) {
        toast.success('Conta criada com sucesso! Você já pode fazer login.');
        router.push('/login');
      } else {
        toast.error(res.error || 'Erro ao criar conta.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-on-surface">Seu E-mail</label>
        <div className="relative">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="email"
            disabled
            value={email}
            className="input input-icon-left w-full opacity-60 cursor-not-allowed bg-surface-container"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-on-surface">Seu Nome Completo</label>
        <div className="relative">
          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            required
            autoFocus
            placeholder="João da Silva"
            className="input input-icon-left w-full"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-on-surface">Defina sua Senha</label>
        <div className="relative">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="password"
            required
            placeholder="Mínimo de 8 caracteres"
            className="input input-icon-left w-full"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-on-surface">Confirme sua Senha</label>
        <div className="relative">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="password"
            required
            placeholder="Digite a senha novamente"
            className="input input-icon-left w-full"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary w-full justify-center gap-2 mt-4"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Criando conta...
          </>
        ) : (
          <>
            Criar minha conta
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </form>
  );
}
