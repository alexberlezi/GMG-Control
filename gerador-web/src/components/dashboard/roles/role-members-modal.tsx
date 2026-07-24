'use client';

import { useState, useEffect, useTransition } from 'react';
import { Search, X, UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getRoleUsers, searchUsersNotInRole, assignUserToRole, removeUserFromRole, type RoleWithDetails } from '@/actions/roles';

export function RoleMembersModal({ role, onClose, onMembersChanged }: { role: RoleWithDetails, onClose: () => void, onMembersChanged: () => void }) {
  const [members, setMembers] = useState<{id: string, name: string, email: string, isActive: boolean}[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{id: string, name: string, email: string}[]>([]);
  const [searching, setSearching] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Initial load
  useEffect(() => {
    getRoleUsers(role.id).then(res => {
      if (Array.isArray(res)) {
        setMembers(res);
      }
      setLoadingMembers(false);
    });
  }, [role.id]);

  // Search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      setSearching(true);
      searchUsersNotInRole(role.id, debouncedSearch).then(res => {
        if (Array.isArray(res)) {
          setSearchResults(res);
        }
        setSearching(false);
      });
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearch, role.id]);

  // Actions
  function handleAdd(userId: string) {
    startTransition(async () => {
      const res = await assignUserToRole(userId, role.id);
      if (res.success) {
        toast.success('Usuário adicionado ao grupo.');
        setSearch('');
        // Refresh members
        const newMembers = await getRoleUsers(role.id);
        if (Array.isArray(newMembers)) {
          setMembers(newMembers);
        }
        onMembersChanged();
      } else {
        toast.error((res as any).error || 'Erro ao adicionar.');
      }
    });
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      const res = await removeUserFromRole(userId, role.id);
      if (res.success) {
        toast.success('Usuário removido do grupo.');
        setMembers(prev => prev.filter(m => m.id !== userId));
        onMembersChanged();
      } else {
        toast.error((res as any).error || 'Erro ao remover.');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-surface border border-outline-variant/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/10 bg-surface-container-low/30">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Membros do Grupo</h2>
            <p className="text-sm text-on-surface-variant">Gerenciando usuários em <strong>{role.name}</strong></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-hidden flex flex-col gap-6">
          {/* Search to add */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-on-surface">Adicionar Membros</h3>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                className="input input-icon-left w-full"
                placeholder="Buscar por nome ou email para adicionar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin" />}
            </div>
            
            {searchResults.length > 0 && (
              <div className="border border-outline-variant/20 rounded-xl overflow-hidden bg-surface-container-lowest max-h-48 overflow-y-auto shadow-inner">
                {searchResults.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-low/30 transition-colors">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold text-on-surface truncate max-w-[200px] sm:max-w-[300px]">{user.name}</p>
                        <p className="text-[11px] text-on-surface-variant truncate max-w-[200px] sm:max-w-[300px]">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(user.id)}
                      disabled={isPending}
                      className="btn btn-primary text-xs h-8 px-3 gap-1 shrink-0"
                    >
                      <UserPlus size={14} /> Adicionar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current members */}
          <div className="flex-1 overflow-hidden flex flex-col space-y-3 min-h-[200px]">
            <h3 className="text-sm font-bold text-on-surface flex items-center justify-between">
              Membros Atuais
              <span className="bg-surface-container px-2 py-0.5 rounded text-xs text-on-surface-variant">
                {members.length} {members.length === 1 ? 'membro' : 'membros'}
              </span>
            </h3>
            
            <div className="flex-1 overflow-y-auto border border-outline-variant/10 rounded-2xl bg-surface-container-lowest shadow-inner">
              {loadingMembers ? (
                <div className="flex items-center justify-center h-32 text-on-surface-variant gap-2">
                  <Loader2 size={20} className="animate-spin" /> Carregando membros...
                </div>
              ) : members.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-on-surface-variant">
                  Nenhum usuário neste grupo.
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/10">
                  {members.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-4 hover:bg-surface-container-low/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-sm text-on-surface shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-on-surface flex items-center gap-2 truncate max-w-[150px] sm:max-w-[300px]">
                            {user.name}
                            {!user.isActive && (
                              <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 text-[9px] uppercase tracking-wider rounded font-bold">Inativo</span>
                            )}
                          </p>
                          <p className="text-xs text-on-surface-variant truncate max-w-[150px] sm:max-w-[300px]">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemove(user.id)}
                        disabled={isPending}
                        title="Remover do grupo"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 shrink-0"
                      >
                        <UserMinus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
