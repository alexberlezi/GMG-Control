import Link from 'next/link';
import type { Periodo } from '@/lib/gerador-db';

const OPCOES: { value: Periodo; label: string }[] = [
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 dias' },
];

interface PeriodoSelectorProps {
  periodoAtual: Periodo;
}

export function PeriodoSelector({ periodoAtual }: PeriodoSelectorProps) {
  return (
    <div className="inline-flex rounded-lg border border-outline-variant/30 overflow-hidden">
      {OPCOES.map((opcao) => (
        <Link
          key={opcao.value}
          href={`/dashboard/gerador?periodo=${opcao.value}`}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            opcao.value === periodoAtual
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          {opcao.label}
        </Link>
      ))}
    </div>
  );
}
