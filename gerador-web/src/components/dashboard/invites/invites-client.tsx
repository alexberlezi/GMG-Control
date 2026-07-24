'use client';

import { useState, useTransition, useEffect } from 'react';
import { Plus, Search, Mail, MailWarning, Clock, MailCheck, RotateCcw, Ban, X, Loader2, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { resendInvite, cancelInvite, type InviteWithDetails } from '@/actions/invites';
import CreateInviteModal from './create-invite-modal';

interface InvitesClientProps {
  initialInvites: InviteWithDetails[];
  roles: { id: string; name: string; isSystem: boolean }[];
}

export default function InvitesClient({ initialInvites, roles }: InvitesClientProps) {
  const [invites, setInvites] = useState<InviteWithDetails[]>(initialInvites);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  useEffect(() => {
    setInvites(initialInvites);
  }, [initialInvites]);

  useEffect(() => {
    const saved = localStorage.getItem('authforge_invites_viewMode');
    if (saved === 'cards' || saved === 'table') {
      setViewMode(saved);
    }
  }, []);

  const handleViewModeChange = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('authforge_invites_viewMode', mode);
  };

  const filteredInvites = invites.filter(inv => 
    inv.email.toLowerCase().includes(search.toLowerCase()) || 
    inv.role.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleResend = (id: string) => {
    startTransition(async () => {
      const res = await resendInvite(id);
      if (res.success) {
        toast.success('Convite reenviado com sucesso!');
        // Update local state temporarily (expiresAt changed)
        setInvites(prev => prev.map(i => i.id === id ? { ...i, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } : i));
      } else {
        toast.error(res.error || 'Erro ao reenviar convite');
      }
    });
  };

  const handleCancel = (id: string) => {
    if (!confirm('Tem certeza que deseja cancelar este convite?')) return;
    
    startTransition(async () => {
      const res = await cancelInvite(id);
      if (res.success) {
        toast.success('Convite cancelado.');
        setInvites(prev => prev.map(i => i.id === id ? { ...i, status: 'CANCELLED' } : i));
      } else {
        toast.error(res.error || 'Erro ao cancelar convite');
      }
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock size={16} className="text-amber-500" />;
      case 'ACCEPTED': return <MailCheck size={16} className="text-green-500" />;
      case 'EXPIRED': return <MailWarning size={16} className="text-red-500" />;
      case 'CANCELLED': return <Ban size={16} className="text-on-surface-variant" />;
      default: return <Mail size={16} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-500">Pendente</span>;
      case 'ACCEPTED': return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-green-500/10 text-green-500">Aceito</span>;
      case 'EXPIRED': return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-500">Expirado</span>;
      case 'CANCELLED': return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-surface-container-high text-on-surface-variant">Cancelado</span>;
      default: return null;
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
              placeholder="Buscar por e-mail ou grupo..."
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

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary text-xs gap-1.5"
              disabled={isPending}
            >
              <Plus size={14} />
              Novo Convite
            </button>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'cards' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-surface-container-lowest animate-in fade-in duration-300">
            {filteredInvites.length === 0 ? (
              <div className="col-span-full py-12 text-center text-sm text-on-surface-variant bg-surface border border-dashed border-outline-variant/20 rounded-2xl">
                Nenhum convite encontrado.
              </div>
            ) : (
              filteredInvites.map(invite => (
                <div key={invite.id} className="card p-5 flex flex-col hover:border-primary/30 transition-colors bg-surface relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-surface-container-highest group-hover:bg-primary transition-colors"></div>
                  
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5 max-w-[70%]">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        {getStatusIcon(invite.status)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-on-surface truncate" title={invite.email}>
                          {invite.email}
                        </p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">
                          Enviado por: {invite.inviter?.name}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(invite.status)}
                  </div>

                  <div className="mt-3 bg-surface-container-lowest p-2.5 rounded-xl border border-outline-variant/10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">Grupo:</span>
                      <span className="text-xs font-semibold text-primary">{invite.role.name}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/5">
                      <span className="text-[10px] text-on-surface-variant uppercase">Expira em</span>
                      <span className="text-[11px] font-medium text-on-surface">
                        {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(invite.expiresAt))}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-1.5 mt-4 pt-3 border-t border-outline-variant/5">
                    {invite.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleResend(invite.id)}
                          disabled={isPending}
                          title="Reenviar Convite"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-30"
                        >
                          <RotateCcw size={15} />
                        </button>
                        <button
                          onClick={() => handleCancel(invite.id)}
                          disabled={isPending}
                          title="Cancelar Convite"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-30"
                        >
                          <Ban size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant/10">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">E-mail</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Grupo</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Enviado por</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Expiração</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvites.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-on-surface-variant">
                      Nenhum convite encontrado
                    </td>
                  </tr>
                ) : (
                  filteredInvites.map(invite => (
                    <tr key={invite.id} className="border-b border-outline-variant/5 hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded flex items-center justify-center bg-primary/10 text-primary">
                            <Mail size={12} />
                          </div>
                          <span className="text-sm font-medium text-on-surface">{invite.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-primary font-medium">{invite.role.name}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-on-surface-variant">{invite.inviter?.name}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getStatusBadge(invite.status)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-on-surface-variant">
                        {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(invite.expiresAt))}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Note: In table view, hover actions are nice, but need group class on tr */}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          {invite.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleResend(invite.id)}
                                disabled={isPending}
                                title="Reenviar Convite"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-30"
                              >
                                <RotateCcw size={15} />
                              </button>
                              <button
                                onClick={() => handleCancel(invite.id)}
                                disabled={isPending}
                                title="Cancelar Convite"
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-30"
                              >
                                <Ban size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateInviteModal 
          roles={roles} 
          onClose={() => setShowCreateModal(false)} 
        />
      )}
    </div>
  );
}
