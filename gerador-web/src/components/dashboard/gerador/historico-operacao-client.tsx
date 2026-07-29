'use client';

import Link from 'next/link';
import type { RegistroOperacao } from '@prisma/client';
import { Calendar, Fuel, Clock, Tag, User } from 'lucide-react';

const MOTIVO_LABEL: Record<string, string> = {
  CICLO_SEMANAL: '📅 Ciclo Semanal',
  MANUTENCAO: '🔧 Manutenção',
  FALTA_ENERGIA: '⚡ Falta de Energia',
  TESTE: '🧪 Teste',
  MANUAL: '👤 Manual',
  OUTRO: '❓ Outro',
};

const MOTIVO_COLOR: Record<string, string> = {
  CICLO_SEMANAL: 'badge-info',
  MANUTENCAO: 'badge-warning',
  FALTA_ENERGIA: 'badge-error',
  TESTE: 'badge-secondary',
  MANUAL: 'badge-primary',
  OUTRO: 'badge-neutral',
};

interface HistoricoOperacaoClientProps {
  registros: (RegistroOperacao & { usuario?: { name: string } | null })[];
  periodo?: string;
}

export function HistoricoOperacaoClient({ registros, periodo }: HistoricoOperacaoClientProps) {
  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <Link href="?periodo=hoje" className={`badge badge-outline ${periodo === 'hoje' ? 'badge-info' : ''}`}>
          Hoje
        </Link>
        <Link href="?periodo=semana" className={`badge badge-outline ${periodo === 'semana' ? 'badge-info' : ''}`}>
          Última Semana
        </Link>
        <Link href="?periodo=mes" className={`badge badge-outline ${periodo === 'mes' ? 'badge-info' : ''}`}>
          Último Mês
        </Link>
        <Link href="" className="badge badge-outline">
          Limpar Filtros
        </Link>
      </div>

      {/* Tabela ou vazio */}
      {registros.length === 0 ? (
        <div className="card p-8 text-center text-on-surface-variant">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nenhum registro de operação encontrado.</p>
          <p className="text-xs mt-2 opacity-70">
            Os ciclos aparecerão aqui quando o gerador ligar/desligar
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container border-b border-outline-variant/10">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Início</th>
                <th className="px-4 py-3 text-left font-medium">Fim</th>
                <th className="px-4 py-3 text-left font-medium">Operação</th>
                <th className="px-4 py-3 text-left font-medium">Combustível</th>
                <th className="px-4 py-3 text-left font-medium">Motivo</th>
                <th className="px-4 py-3 text-left font-medium">Usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {registros.map((registro) => (
                <tr key={registro.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium text-on-surface">
                      {registro.dataHoraInicio.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })}
                    </div>
                    <div className="text-on-surface-variant">
                      {registro.dataHoraInicio.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {registro.dataHoraFim ? (
                      <div>
                        <div className="font-medium text-on-surface">
                          {registro.dataHoraFim.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    ) : (
                      <span className="text-warning font-medium flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-warning animate-pulse" />
                        Em operação
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {registro.tempoOperacao ? (
                      <div className="flex items-center gap-1">
                        <Clock size={16} className="text-on-surface-variant" />
                        <span className="font-medium">
                          {Math.floor(registro.tempoOperacao / 60)}h {registro.tempoOperacao % 60}m
                        </span>
                      </div>
                    ) : (
                      <span className="text-on-surface-variant">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {registro.combustivelUsado ? (
                      <div className="flex items-center gap-1">
                        <Fuel size={16} className="text-on-surface-variant" />
                        <span className="font-medium">
                          {Number(registro.combustivelUsado).toFixed(2)}L
                        </span>
                      </div>
                    ) : (
                      <span className="text-on-surface-variant">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${MOTIVO_COLOR[registro.motivo]}`}>
                      {MOTIVO_LABEL[registro.motivo]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <User size={14} className="text-on-surface-variant" />
                      <span className="text-on-surface-variant">{registro.usuario?.name || 'Sistema'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Observações */}
      {registros.length > 0 && registros.some((r) => r.observacoes) && (
        <div className="card p-4 bg-surface-container-low">
          <p className="text-xs text-on-surface-variant font-medium mb-3">Observações nos Registros:</p>
          <div className="space-y-2">
            {registros
              .filter((r) => r.observacoes)
              .map((r) => (
                <div key={r.id} className="text-sm">
                  <p className="text-on-surface-variant">
                    <span className="font-medium text-on-surface">
                      {r.dataHoraInicio.toLocaleString('pt-BR')}
                    </span>
                    : {r.observacoes}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
