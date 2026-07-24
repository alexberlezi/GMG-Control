'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { verify2FALogin } from '@/actions/auth';
import Link from 'next/link';

export function TwoFactorForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');

  async function handle2FASubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // undefined passes the responsibility to read from cookie
    const result = await verify2FALogin(undefined, twoFactorCode);

    if (result.success) {
      if ('redirectTo' in result && result.redirectTo) {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
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
        
        <Link
          href="/login"
          className="btn-ghost w-full py-2 mt-2 text-sm text-on-surface-variant block text-center"
        >
          Voltar ao Login
        </Link>
      </form>
    </motion.div>
  );
}
