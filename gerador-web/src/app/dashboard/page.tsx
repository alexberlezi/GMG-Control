import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth/session';
import { Users, ShieldCheck, Activity, Globe } from 'lucide-react';

export default async function DashboardPage() {
  const session = await validateSession();
  if (!session) return null;

  const [totalUsers, totalSessions, recentLogins, recentAuditLogs] = await Promise.all([
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
