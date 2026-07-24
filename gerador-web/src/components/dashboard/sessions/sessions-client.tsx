'use client';

import { useState, useTransition, useEffect } from 'react';
import { Search, X, Loader2, Monitor, Smartphone, Globe, ShieldAlert, LogOut, LayoutGrid, List, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { UAParser } from 'ua-parser-js';
import { revokeSession, revokeAllUserSessions, type SessionWithUser } from '@/actions/sessions';

interface SessionsClientProps {
  initialSessions: SessionWithUser[];
}

export default function SessionsClient({ initialSessions }: SessionsClientProps) {
  const [sessions, setSessions] = useState<SessionWithUser[]>(initialSessions);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    const saved = localStorage.getItem('authforge_sessions_viewMode');
    if (saved === 'cards' || saved === 'table') {
      setViewMode(saved);
    }
  }, []);

  const handleViewModeChange = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('authforge_sessions_viewMode', mode);
  };

  const filteredSessions = sessions.filter(session => 
    session.user.email.toLowerCase().includes(search.toLowerCase()) || 
    (session.ipAddress && session.ipAddress.includes(search)) ||
    (session.user.name && session.user.name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleRevoke = (id: string) => {
    if (!confirm('Tem certeza que deseja revogar o acesso deste dispositivo? O usuário será desconectado imediatamente.')) return;
    
    startTransition(async () => {
      const res = await revokeSession(id);
      if (res.success) {
        toast.success('Sessão revogada com sucesso.');
        setSessions(prev => prev.filter(s => s.id !== id));
      } else {
        toast.error(res.error || 'Erro ao revogar sessão');
      }
    });
  };

  const handleRevokeAllUser = (userId: string) => {
    if (!confirm('ATENÇÃO: Deseja revogar TODAS as sessões ativas deste usuário? Ele será desconectado de todos os dispositivos.')) return;
    
    startTransition(async () => {
      const res = await revokeAllUserSessions(userId);
      if (res.success) {
        toast.success('Todas as sessões do usuário foram revogadas.');
        setSessions(prev => prev.filter(s => s.userId !== userId));
      } else {
        toast.error(res.error || 'Erro ao revogar sessões');
      }
    });
  };

  const parseUA = (uaString: string | null) => {
    if (!uaString || uaString === 'unknown') return { browser: 'Desconhecido', os: 'Sistema Desconhecido', type: 'unknown' };
    const parser = new UAParser(uaString);
    const result = parser.getResult();
    
    let type = 'desktop';
    if (result.device.type === 'mobile' || result.device.type === 'wearable') type = 'mobile';
    if (result.device.type === 'tablet') type = 'tablet';

    return {
      browser: `${result.browser.name || 'Navegador'} ${result.browser.version?.split('.')[0] || ''}`.trim(),
      os: `${result.os.name || 'OS'} ${result.os.version || ''}`.trim(),
      type
    };
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return <Smartphone size={16} />;
      case 'desktop': return <Monitor size={16} />;
      default: return <Globe size={16} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-b border-outline-variant/10">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              className="input input-icon-left"
              placeholder="Buscar por e-mail, nome ou IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <div className="hidden sm:flex items-center gap-1 p-1 bg-surface-container/50 rounded-xl border border-outline-variant/10">
              <button 
                onClick={() => handleViewModeChange('table')} 
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <List size={16} /> <span className="hidden lg:inline">Tabela</span>
              </button>
              <button 
                onClick={() => handleViewModeChange('cards')} 
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'cards' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                <LayoutGrid size={16} /> <span className="hidden lg:inline">Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'cards' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-surface-container-lowest animate-in fade-in duration-300">
            {filteredSessions.length === 0 ? (
              <div className="col-span-full py-12 text-center text-sm text-on-surface-variant bg-surface border border-dashed border-outline-variant/20 rounded-2xl">
                Nenhuma sessão ativa encontrada.
              </div>
            ) : (
              filteredSessions.map(session => {
                const uaInfo = parseUA(session.userAgent);
                return (
                  <div key={session.id} className="card p-5 flex flex-col hover:border-primary/30 transition-colors bg-surface relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-surface-container-highest group-hover:bg-primary transition-colors"></div>
                    
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          {getDeviceIcon(uaInfo.type)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-on-surface truncate" title={session.user.name || session.user.email}>
                            {session.user.name || 'Sem Nome'}
                          </p>
                          <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">
                            {session.user.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 bg-surface-container-lowest p-2.5 rounded-xl border border-outline-variant/10">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Dispositivo</span>
                          <span className="text-[11px] font-medium text-on-surface">{uaInfo.browser} no {uaInfo.os}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-outline-variant/5">
                          <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Local</span>
                          <span className="text-[11px] font-medium text-on-surface flex items-center gap-1">
                            <MapPin size={10} className="text-primary/70"/>
                            {(session as any).location || 'Desconhecido'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-outline-variant/5">
                          <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">IP</span>
                          <span className="text-[11px] font-medium text-on-surface font-mono">{session.ipAddress || 'Desconhecido'}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-outline-variant/5">
                          <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Último Acesso</span>
                          <span className="text-[11px] font-medium text-on-surface">
                            {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(session.lastActiveAt))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 mt-4 pt-3 border-t border-outline-variant/5">
                      <button
                        onClick={() => handleRevokeAllUser(session.userId)}
                        disabled={isPending}
                        title="Revogar TODAS as sessões deste usuário"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-amber-500/10 hover:text-amber-500 transition-colors disabled:opacity-30"
                      >
                        <ShieldAlert size={15} />
                      </button>
                      <button
                        onClick={() => handleRevoke(session.id)}
                        disabled={isPending}
                        title="Revogar Acesso Deste Dispositivo"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-30"
                      >
                        <LogOut size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant/10">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Usuário</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Dispositivo</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Endereço IP / Local</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Último Acesso</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-on-surface-variant">
                      Nenhuma sessão encontrada
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map(session => {
                    const uaInfo = parseUA(session.userAgent);
                    return (
                      <tr key={session.id} className="border-b border-outline-variant/5 hover:bg-surface-container-low/30 transition-colors group">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {session.user.name?.charAt(0).toUpperCase() || session.user.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-on-surface">{session.user.name || 'Sem Nome'}</span>
                              <span className="text-[11px] text-on-surface-variant">{session.user.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-on-surface-variant">
                              {getDeviceIcon(uaInfo.type)}
                            </span>
                            <div className="flex flex-col">
                              <span className="text-sm text-on-surface">{uaInfo.browser}</span>
                              <span className="text-[11px] text-on-surface-variant">{uaInfo.os}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-on-surface font-mono">{session.ipAddress || '-'}</span>
                            <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                              <MapPin size={10} className="text-primary/70"/>
                              {(session as any).location || 'Desconhecido'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                          {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(session.lastActiveAt))}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleRevokeAllUser(session.userId)}
                              disabled={isPending}
                              title="Revogar TODAS as sessões deste usuário"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-amber-500/10 hover:text-amber-500 transition-colors disabled:opacity-30"
                            >
                              <ShieldAlert size={15} />
                            </button>
                            <button
                              onClick={() => handleRevoke(session.id)}
                              disabled={isPending}
                              title="Revogar Acesso Deste Dispositivo"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-30"
                            >
                              <LogOut size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
