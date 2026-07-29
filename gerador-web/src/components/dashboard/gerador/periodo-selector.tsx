'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { Periodo } from '@/lib/gerador-db';

const PERIODOS = [
  { value: '24h' as Periodo, label: '24h' },
  { value: '7d' as Periodo, label: '7 dias' },
  { value: '30d' as Periodo, label: '30 dias' },
  { value: '90d' as Periodo, label: '90 dias' },
];

export function PeriodoSelector({ periodoAtual }: { periodoAtual: Periodo }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (periodo: Periodo) => {
    const params = new URLSearchParams(searchParams);
    params.set('periodo', periodo);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex gap-2">
      {PERIODOS.map(periodo => (
        <button
          key={periodo.value}
          onClick={() => handleChange(periodo.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            periodoAtual === periodo.value
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          {periodo.label}
        </button>
      ))}
    </div>
  );
}
