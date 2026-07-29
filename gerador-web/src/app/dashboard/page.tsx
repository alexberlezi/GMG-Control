import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth/session';
import { Users, ShieldCheck, Activity, Globe, AlertTriangle, Gauge, Wrench } from 'lucide-react';
import { getUltimaLeitura } from '@/lib/gerador-db';
import { getDashboardSummary } from '@/lib/gerador-utils';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await validateSession();
  if (!session) return null;

  const [totalUsers, totalSessions, recentLogins, recentAuditLogs, geradorLeitura, geradorSummary] = await Promise.all([
    db.user.count(),
    db.session.count({ where: { expiresAt: { gt: new Date() } } }),
    db.loginAttempt.count({
      where: { success: true, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    db.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    }),
    getUltimaLeitura().catch(() => null),
    getDashboardSummary().catch(() => null),
  ]);

  const stats = [
    { label: 'Usuários', value: totalUsers, icon: Users, color: 'text-primary' },
    { label: 'Sessões Ativas', value: totalSessions, icon: Globe, color: 'text-tertiary' },
    { label: 'Logins (24h)', value: recentLogins, icon: ShieldCheck, color: 'text-secondary' },
    { label: 'Eventos', value: recentAuditLogs.length, icon: Activity, color: 'text-warning' },
  ];

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Dashboard</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Bem-vindo, {session.user.name.split(' ')[0]}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">{stat.label}</p>
                <p className="text-3xl font-bold text-on-surface mt-1">{stat.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl bg-surface-container ${stat.color}`}>
                <stat.icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Gerador Summary Section */}
      {geradorLeitura && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <Gauge size={20} />
              Resumo do Gerador
            </h2>
            <Link href="/dashboard/gerador" className="text-sm text-primary hover:text-primary/80">
              Ver painel completo →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Motor */}
            <div className={`card p-5 border-l-4 ${
              geradorLeitura.motor_status === 'Rodando'
                ? 'border-green-500 bg-green-50/10 dark:bg-green-950/20'
                : 'border-red-500 bg-red-50/10 dark:bg-red-950/20'
            }`}>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Status Motor</p>
              <p className={`text-2xl font-bold mt-2 ${
                geradorLeitura.motor_status === 'Rodando'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {geradorLeitura.motor_status === 'Rodando' ? '🟢 Rodando' : '🔴 Parado'}
              </p>
            </div>

            {/* Combustível */}
            <div className="card p-5 border-l-4 border-orange-500 bg-orange-50/10 dark:bg-orange-950/20">
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Combustível</p>
              <p className="text-2xl font-bold text-on-surface mt-2">{geradorLeitura.nivel_combustivel ?? '—'}%</p>
            </div>

            {/* Temperatura */}
            <div className={`card p-5 border-l-4 ${
              geradorLeitura.temperatura_invalida
                ? 'border-yellow-500 bg-yellow-50/10 dark:bg-yellow-950/20'
                : 'border-blue-500 bg-blue-50/10 dark:bg-blue-950/20'
            }`}>
              <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Temperatura</p>
              <p className={`text-2xl font-bold mt-2 ${
                geradorLeitura.temperatura_invalida
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-on-surface'
              }`}>
                {geradorLeitura.temperatura_invalida ? '⚠️ Erro' : `${geradorLeitura.temperatura}°C`}
              </p>
            </div>

            {/* Alarmes */}
            {geradorSummary && (
              <div className={`card p-5 border-l-4 ${
                geradorSummary.alarmesCriticos > 0
                  ? 'border-red-500 bg-red-50/10 dark:bg-red-950/20'
                  : 'border-green-500 bg-green-50/10 dark:bg-green-950/20'
              }`}>
                <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Alarmes</p>
                <p className={`text-2xl font-bold mt-2 ${
                  geradorSummary.alarmesCriticos > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {geradorSummary.alarmesCriticos > 0 ? '⚠️ ' + geradorSummary.alarmesCriticos : '✓ Limpo'}
                </p>
              </div>
            )}
          </div>

          {/* Gerador Info */}
          {geradorSummary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Último Abastecimento */}
              <div className="card p-5 border-l-4 border-blue-500 bg-blue-50/10 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-blue-600 dark:text-blue-400">⛽</span>
                  <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Último Abastecimento</p>
                </div>
                {geradorSummary.ultimoAbastecimento ? (
                  <>
                    <p className="text-lg font-semibold text-on-surface">
                      {geradorSummary.ultimoAbastecimento.quantidade}{geradorSummary.ultimoAbastecimento.unidade ? ' ' + geradorSummary.ultimoAbastecimento.unidade : ''}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-2">
                      {new Date(geradorSummary.ultimoAbastecimento.data).toLocaleDateString('pt-BR')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-on-surface-variant">Sem registro</p>
                )}
              </div>

              {/* Última Manutenção */}
              <div className="card p-5 border-l-4 border-green-500 bg-green-50/10 dark:bg-green-950/20">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench size={16} className="text-green-600 dark:text-green-400" />
                  <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Última Manutenção</p>
                </div>
                {geradorSummary.ultimaManutencao ? (
                  <>
                    <p className="text-lg font-semibold text-on-surface">{geradorSummary.ultimaManutencao.tipo}</p>
                    <p className="text-xs text-on-surface-variant mt-2">
                      {new Date(geradorSummary.ultimaManutencao.data).toLocaleDateString('pt-BR')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-on-surface-variant">Sem registro</p>
                )}
              </div>

              {/* Alarmes Info */}
              <div className="card p-5 border-l-4 border-yellow-500 bg-yellow-50/10 dark:bg-yellow-950/20">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-400" />
                  <p className="text-xs text-on-surface-variant uppercase tracking-wide font-medium">Avisos</p>
                </div>
                <p className="text-lg font-semibold text-on-surface">
                  {geradorSummary.alarmesCriticos + geradorSummary.alarmesAvisos}
                </p>
                <p className="text-xs text-on-surface-variant mt-2">
                  {geradorSummary.alarmesCriticos} críticos • {geradorSummary.alarmesAvisos} avisos
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Activity */}
      <div className="card">
        <div className="p-5 border-b border-outline-variant/10">
          <h2 className="text-lg font-semibold text-on-surface">Atividade Recente</h2>
        </div>
        <div className="divide-y divide-outline-variant/10">
          {recentAuditLogs.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant text-sm">
              Nenhuma atividade registrada.
            </div>
          ) : (
            recentAuditLogs.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-center justify-between hover:bg-surface-container-low/50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm text-on-surface font-medium truncate">
                    {log.action.replace(/\./g, ' › ')}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {log.user?.name || 'Sistema'} • {log.ipAddress || '—'}
                  </p>
                </div>
                <span className="text-xs text-on-surface-variant whitespace-nowrap ml-4">
                  {new Date(log.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
