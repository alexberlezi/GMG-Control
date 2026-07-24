'use client';

import React, { useState, useMemo } from 'react';
import { Search, X, Activity, FileJson, Shield, Users, LogIn, Lock, Mail, ChevronDown, ChevronRight, Globe, Monitor, Smartphone, Check, MapPin } from 'lucide-react';
import type { AuditLogWithUser } from '@/actions/audit';
import { UAParser } from 'ua-parser-js';

interface AuditClientProps {
  initialLogs: AuditLogWithUser[];
}

export default function AuditClient({ initialLogs }: AuditClientProps) {
  const [logs] = useState<AuditLogWithUser[]>(initialLogs);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Derive unique categories from existing actions for the filter dropdown
  const actionCategories = useMemo(() => {
    const categories = new Set<string>();
    logs.forEach(log => {
      const category = log.action.split('.')[0];
      if (category) categories.add(category);
    });
    return Array.from(categories).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.user?.email.toLowerCase().includes(search.toLowerCase()) || 
        log.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        (log.ipAddress && log.ipAddress.includes(search));
      
      const matchesType = filterType === 'all' || log.action.startsWith(filterType);

      return matchesSearch && matchesType;
    });
  }, [logs, search, filterType]);

  const toggleRow = (id: string) => {
    setExpandedRow(prev => prev === id ? null : id);
  };

  const getFriendlyActionName = (action: string) => {
    const map: Record<string, string> = {
      'roles.create': 'Criou um Grupo',
      'roles.update': 'Atualizou um Grupo',
      'roles.delete': 'Excluiu um Grupo',
      'invite.create': 'Enviou um Convite',
      'invite.cancel': 'Cancelou um Convite',
      'invite.resend': 'Reenviou um Convite',
      'invite.accept': 'Aceitou um Convite',
      'session.revoke': 'Revogou uma Sessão',
      'session.revoke_all': 'Revogou Sessões',
      'auth.login': 'Realizou Login',
      'auth.logout': 'Realizou Logout',
      'users.create': 'Criou Usuário',
      'users.update': 'Atualizou Usuário',
      'users.delete': 'Excluiu Usuário',
      'security.update': 'Alterou Segurança',
    };
    return map[action] || action;
  };

  const translateCategory = (cat: string) => {
    const map: Record<string, string> = {
      'auth': 'Autenticação',
      'roles': 'Grupos & Cargos',
      'security': 'Segurança',
      'system': 'Sistema',
      'users': 'Usuários',
      'session': 'Sessões',
      'invite': 'Convites',
    };
    return map[cat] || (cat.charAt(0).toUpperCase() + cat.slice(1));
  };

  const getActionDetails = (action: string) => {
    const category = action.split('.')[0];
    switch (category) {
      case 'auth': return { icon: <LogIn size={14} />, color: 'text-indigo-500', bg: 'bg-indigo-500/10' };
      case 'roles': return { icon: <Shield size={14} />, color: 'text-purple-500', bg: 'bg-purple-500/10' };
      case 'users': return { icon: <Users size={14} />, color: 'text-blue-500', bg: 'bg-blue-500/10' };
      case 'session': return { icon: <Lock size={14} />, color: 'text-amber-500', bg: 'bg-amber-500/10' };
      case 'invite': return { icon: <Mail size={14} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
      default: return { icon: <Activity size={14} />, color: 'text-on-surface-variant', bg: 'bg-surface-container-high' };
    }
  };

  const formatJSON = (data: any) => {
    if (!data) return 'Nenhum metadado disponível.';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const parseUA = (uaString: string | null) => {
    if (!uaString || uaString === 'unknown') return { label: 'Desconhecido', type: 'unknown' };
    const parser = new UAParser(uaString);
    const result = parser.getResult();
    
    let type = 'desktop';
    if (result.device.type === 'mobile' || result.device.type === 'wearable') type = 'mobile';
    if (result.device.type === 'tablet') type = 'tablet';

    const browser = result.browser.name ? `${result.browser.name} ${result.browser.version?.split('.')[0] || ''}` : 'Navegador';
    const os = result.os.name ? `${result.os.name} ${result.os.version || ''}` : 'OS';

    return {
      label: `${browser} • ${os}`,
      type
    };
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return <Smartphone size={14} />;
      case 'desktop': return <Monitor size={14} />;
      default: return <Globe size={14} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 flex flex-col md:flex-row items-start md:items-center gap-3 border-b border-outline-variant/10">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              className="input input-icon-left w-full"
              placeholder="Buscar por usuário, ação ou IP..."
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

          <div className="flex items-center gap-2 w-full md:w-auto relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="input text-left flex items-center justify-between bg-surface w-full md:min-w-[180px]"
            >
              <span className="truncate">
                {filterType === 'all' ? 'Todas as Ações' : `Categoria: ${translateCategory(filterType)}`}
              </span>
              <ChevronDown size={16} className={`text-on-surface-variant transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                <div className="absolute top-full left-0 w-full mt-1 bg-surface border border-outline-variant/20 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-1">
                  <button
                    className={`w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-surface-container transition-colors flex items-center justify-between ${filterType === 'all' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface'}`}
                    onClick={() => { setFilterType('all'); setIsDropdownOpen(false); }}
                  >
                    <span>Todas as Ações</span>
                    {filterType === 'all' && <Check size={16} className="text-primary" />}
                  </button>
                  {actionCategories.map(cat => (
                    <button
                      key={cat}
                      className={`w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-surface-container transition-colors flex items-center justify-between ${filterType === cat ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface'}`}
                      onClick={() => { setFilterType(cat); setIsDropdownOpen(false); }}
                    >
                      <span>{translateCategory(cat)}</span>
                      {filterType === cat && <Check size={16} className="text-primary" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content (Table Only) */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-lowest">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider w-10"></th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Ação</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Usuário</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">IP / Localização</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Data / Hora</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-on-surface-variant">
                    Nenhum registro de auditoria encontrado
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const details = getActionDetails(log.action);
                  const isExpanded = expandedRow === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        className={`border-b border-outline-variant/5 transition-colors cursor-pointer ${isExpanded ? 'bg-surface-container-low/50' : 'hover:bg-surface-container-low/30'}`}
                        onClick={() => toggleRow(log.id)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant text-center">
                          <button className={`p-1 rounded hover:bg-surface-container transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                            <ChevronRight size={16} />
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${details.bg} ${details.color}`}>
                              {details.icon}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-on-surface">{getFriendlyActionName(log.action)}</span>
                              <span className="text-[10px] text-on-surface-variant font-mono">{log.action}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.user ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                                {log.user.name?.charAt(0).toUpperCase() || log.user.email.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-on-surface">{log.user.name || 'Sem Nome'}</span>
                                <span className="text-[10px] text-on-surface-variant">{log.user.email}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-on-surface-variant italic">Sistema / Desconhecido</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-on-surface font-mono">{log.ipAddress || '-'}</span>
                            <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                              <MapPin size={10} className="text-primary/70"/>
                              {(log as any).location || 'Desconhecido'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                          {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(log.createdAt))}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-surface-container-lowest/50 border-b border-outline-variant/10">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="pl-10 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
                              
                              {/* Metadata Panel */}
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-on-surface-variant">
                                  <FileJson size={16} />
                                  <h4 className="text-xs font-bold uppercase tracking-wider">Metadados da Ação</h4>
                                </div>
                                <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/10 overflow-x-auto">
                                  <pre className="text-[11px] text-on-surface font-mono leading-relaxed">
                                    {formatJSON(log.metadata)}
                                  </pre>
                                </div>
                              </div>

                              {/* Technical Details Panel */}
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-on-surface-variant">
                                  <Monitor size={16} />
                                  <h4 className="text-xs font-bold uppercase tracking-wider">Detalhes Técnicos</h4>
                                </div>
                                <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/10 space-y-3">
                                  <div>
                                    <span className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1">ID do Registro</span>
                                    <span className="text-xs font-mono text-on-surface">{log.id}</span>
                                  </div>
                                  
                                  <div>
                                    <span className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1">Recurso Afetado</span>
                                    <span className="text-xs font-mono text-on-surface">{log.resource || 'Nenhum especificado'}</span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] uppercase font-bold text-on-surface-variant block mb-1">Dispositivo de Origem</span>
                                    <div className="flex items-center gap-2 text-xs text-on-surface">
                                      <span className="text-on-surface-variant">{getDeviceIcon(parseUA(log.userAgent).type)}</span>
                                      {parseUA(log.userAgent).label}
                                    </div>
                                    <div className="mt-1">
                                      <span className="text-[10px] text-on-surface-variant font-mono break-all">{log.userAgent}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
