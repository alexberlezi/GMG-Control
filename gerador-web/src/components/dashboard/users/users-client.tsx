'use client';

import { useState, useMemo, useTransition } from 'react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import {
  Users, UserCheck, UserX, ShieldCheck, UserPlus, Search,
  ChevronUp, ChevronDown, Pencil, Eye, EyeOff, KeyRound, Copy,
  Columns3, ArrowUpDown, Clock, Loader2, X, Check, Trash2, LogOut, ChevronLeft, ChevronRight, LayoutGrid, List
} from 'lucide-react';
import { toggleUserStatus, createUser, updateUser, resetUserPassword, getUsers, deleteUser, revokeUserSessions, type UserListItem, type UserStats } from '@/actions/users';

// ─── Stats Cards ─────────────────────────────────────────
function StatsCards({ stats }: { stats: UserStats }) {
  const cards = [
    { label: 'Total', value: stats.total, icon: Users, color: 'var(--primary)' },
    { label: 'Ativos', value: stats.active, icon: UserCheck, color: '#22c55e' },
    { label: 'Inativos', value: stats.inactive, icon: UserX, color: '#ef4444' },
    { label: 'Com MFA', value: stats.withMfa, icon: ShieldCheck, color: '#f59e0b' },
    { label: 'Novos (7d)', value: stats.recentlyCreated, icon: Clock, color: '#8b5cf6' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(c => (
        <div key={c.label} className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `color-mix(in srgb, ${c.color} 15%, transparent)` }}>
            <c.icon size={18} style={{ color: c.color }} />
          </div>
          <div>
            <p className="text-xl font-bold text-on-surface">{c.value}</p>
            <p className="text-[11px] text-on-surface-variant">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Column Config ───────────────────────────────────────
type SortDir = 'asc' | 'desc';
type ColKey = 'name' | 'email' | 'roles' | 'authProvider' | 'isActive' | 'twoFactorEnabled' | 'createdAt' | 'sessions';

interface ColDef {
  key: ColKey;
  label: string;
  defaultVisible: boolean;
  sortable: boolean;
}

const COLUMNS: ColDef[] = [
  { key: 'name', label: 'Nome', defaultVisible: true, sortable: true },
  { key: 'email', label: 'Email', defaultVisible: true, sortable: true },
  { key: 'roles', label: 'Grupo', defaultVisible: true, sortable: true },
  { key: 'authProvider', label: 'Provedor', defaultVisible: false, sortable: true },
  { key: 'isActive', label: 'Status', defaultVisible: true, sortable: true },
  { key: 'twoFactorEnabled', label: 'MFA', defaultVisible: true, sortable: true },
  { key: 'createdAt', label: 'Criado em', defaultVisible: true, sortable: true },
  { key: 'sessions', label: 'Sessões', defaultVisible: false, sortable: true },
];

// ─── Main Component ──────────────────────────────────────
export function UsersClient({
  initialUsers,
  initialTotal,
  initialStats,
  roles,
  currentUserIsOwner,
}: {
  initialUsers: UserListItem[];
  initialTotal: number;
  initialStats: UserStats;
  roles: { id: string; name: string; description: string | null }[];
  currentUserIsOwner: boolean;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const [stats, setStats] = useState(initialStats);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortCol, setSortCol] = useState<ColKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('authforge_users_cols');
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as ColKey[];
            return new Set(parsed);
          } catch {}
        }
      }
      return new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
    }
  );
  const [showColPicker, setShowColPicker] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserListItem | null>(null);
  const [revokeUser, setRevokeUser] = useState<UserListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  useEffect(() => {
    const saved = localStorage.getItem('authforge_users_view');
    if (saved === 'cards' || saved === 'table') {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setViewMode(saved);
    }
  }, []);

  function handleViewMode(mode: 'cards' | 'table') {
    setViewMode(mode);
    localStorage.setItem('authforge_users_view', mode);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 on search
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    // Skip fetching if it matches initial load exactly on first render
    if (page === 1 && debouncedSearch === '' && sortCol === 'createdAt' && sortDir === 'desc') {
      // but if initialUsers change (e.g. navigation), we should still update?
      // For now, let's just fetch anyway to keep it robust and simple.
    }

    let active = true;
    startTransition(async () => {
      const result = await getUsers({ page, limit, search: debouncedSearch, sortCol, sortDir });
      if (active) {
        if (!('error' in result)) {
          setUsers(result.data);
          setTotal(result.total);
        } else {
          toast.error(result.error || 'Erro ao carregar usuários.');
        }
      }
    });
    return () => { active = false; };
  }, [page, debouncedSearch, sortCol, sortDir]);

  const filteredUsers = users;

  function handleSort(col: ColKey) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  function toggleCol(col: ColKey) {
    setVisibleCols(prev => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      localStorage.setItem('authforge_users_cols', JSON.stringify([...next]));
      return next;
    });
  }

  function handleToggleStatus(userId: string) {
    startTransition(async () => {
      const result = await toggleUserStatus(userId);
      if (result.success) {
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, isActive: result.isActive! } : u
        ));
        setStats(prev => ({
          ...prev,
          inactive: prev.inactive + (result.isActive ? -1 : 1),
        }));
        toast.success(`Usuário ${result.isActive ? 'ativado' : 'desativado'} com sucesso!`);
      }

    });
  }

  function renderCell(user: UserListItem, col: ColKey) {
    switch (col) {
      case 'name':
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-primary/15 text-primary shrink-0">
              {user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-on-surface truncate">{user.name}</p>
              {user.isOwner && (
                <span className="text-[10px] text-amber-400 font-semibold uppercase">Owner</span>
              )}
            </div>
          </div>
        );
      case 'email':
        return <span className="text-sm text-on-surface-variant">{user.email}</span>;
      case 'roles':
        return (
          <div className="flex flex-wrap gap-1">
            {user.roles.length > 0 ? user.roles.map((r, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary">
                {r.role.name}
              </span>
            )) : (
              <span className="text-xs text-on-surface-variant/50">—</span>
            )}
          </div>
        );
      case 'authProvider':
        return (
          <span className="text-xs text-on-surface-variant capitalize bg-surface-container px-2 py-0.5 rounded">
            {user.authProvider}
          </span>
        );
      case 'isActive':
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
            user.isActive
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
            {user.isActive ? 'Ativo' : 'Inativo'}
          </span>
        );
      case 'twoFactorEnabled':
        return user.twoFactorEnabled ? (
          <ShieldCheck size={16} className="text-green-400" />
        ) : (
          <span className="text-xs text-on-surface-variant/40">—</span>
        );
      case 'createdAt':
        return (
          <span className="text-xs text-on-surface-variant">
            {new Date(user.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        );
      case 'sessions':
        return <span className="text-xs text-on-surface-variant">{user._count.sessions}</span>;
    }
  }

  const activeCols = COLUMNS.filter(c => visibleCols.has(c.key));

  return (
    <div className="space-y-6">
      <StatsCards stats={stats} />

      {/* Toolbar */}
      <div className="card">
        <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-b border-outline-variant/10">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              className="input input-icon-left"
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="hidden sm:flex items-center gap-1 p-1 bg-surface-container/50 rounded-xl border border-outline-variant/10 ml-2">
            <button 
              onClick={() => handleViewMode('table')} 
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <List size={16} /> <span className="hidden lg:inline">Tabela</span>
            </button>
            <button 
              onClick={() => handleViewMode('cards')} 
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'cards' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <LayoutGrid size={16} /> <span className="hidden lg:inline">Cards</span>
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Column picker */}
            <div className="relative">
              <button
                onClick={() => setShowColPicker(!showColPicker)}
                className="btn btn-ghost text-xs gap-1.5"
              >
                <Columns3 size={14} />
                Colunas
              </button>
              {showColPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColPicker(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-surface border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-surface-container/50 px-4 py-3 border-b border-outline-variant/10">
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Colunas Visíveis</p>
                    </div>
                    <div className="p-2 space-y-0.5">
                      {COLUMNS.map(col => {
                        const isChecked = visibleCols.has(col.key);
                        return (
                          <div
                            key={col.key}
                            onClick={() => toggleCol(col.key)}
                            className="group flex items-center justify-between px-3 py-2 rounded-xl hover:bg-primary/10 cursor-pointer transition-all"
                          >
                            <span className={`text-sm transition-colors ${isChecked ? 'text-primary font-medium' : 'text-on-surface-variant group-hover:text-on-surface'}`}>
                              {col.label}
                            </span>
                            <div className={`w-4 h-4 flex items-center justify-center rounded-md transition-all ${
                              isChecked 
                                ? 'bg-primary text-white scale-100' 
                                : 'bg-transparent border border-outline-variant/40 scale-95 group-hover:border-primary/50'
                            }`}>
                              {isChecked && <Check size={12} strokeWidth={4} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Create button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary text-xs gap-1.5"
            >
              <UserPlus size={14} />
              Novo Usuário
            </button>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'cards' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 bg-surface-container-lowest animate-in fade-in duration-300">
            {filteredUsers.length === 0 ? (
              <div className="col-span-full py-12 text-center text-sm text-on-surface-variant">
                {search ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
              </div>
            ) : (
              filteredUsers.map(user => (
                <div key={user.id} className="card p-5 flex flex-col hover:border-primary/30 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3 items-center">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-bold text-on-surface text-sm truncate max-w-[140px]" title={user.name}>{user.name}</h3>
                        <p className="text-[11px] text-on-surface-variant truncate max-w-[140px]" title={user.email}>{user.email}</p>
                      </div>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 shadow-sm ${user.isActive ? 'bg-green-500 shadow-green-500/20' : 'bg-red-500 shadow-red-500/20'}`} title={user.isActive ? 'Ativo' : 'Inativo'} />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {user.roles.map(r => (
                      <span key={r.role.name} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-container-high text-on-surface-variant uppercase tracking-wider">
                        {r.role.name}
                      </span>
                    ))}
                    {user.twoFactorEnabled && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck size={10} /> MFA
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-3 border-t border-outline-variant/10 grid grid-cols-4 gap-1">
                    <button
                      onClick={() => setEditingUser(user)}
                      title="Editar usuário"
                      className="w-full h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-primary/10 text-on-surface-variant hover:text-primary"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setResetPasswordUser(user)}
                      disabled={user.isOwner}
                      title="Resetar senha"
                      className="w-full h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-amber-500/10 text-on-surface-variant hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <KeyRound size={14} />
                    </button>
                    <button
                      onClick={() => setRevokeUser(user)}
                      disabled={user.isOwner || user._count.sessions === 0}
                      title="Revogar sessões"
                      className="w-full h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <LogOut size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(user.id)}
                      disabled={user.isOwner || isPending}
                      title={user.isActive ? 'Desativar usuário' : 'Ativar usuário'}
                      className={`w-full h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed ${
                        user.isActive
                          ? 'hover:bg-amber-500/10 text-on-surface-variant hover:text-amber-400'
                          : 'hover:bg-green-500/10 text-on-surface-variant hover:text-green-400'
                      }`}
                    >
                      {isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : user.isActive ? (
                        <UserX size={14} />
                      ) : (
                        <UserCheck size={14} />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-x-auto animate-in fade-in duration-300">
            <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant/10">
                {activeCols.map(col => (
                  <th key={col.key}
                    className="px-4 py-3 text-left text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap"
                  >
                    {col.sortable ? (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="flex items-center gap-1 hover:text-on-surface transition-colors group"
                      >
                        {col.label}
                        {sortCol === col.key ? (
                          sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                        )}
                      </button>
                    ) : col.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={activeCols.length + 1} className="px-4 py-12 text-center text-sm text-on-surface-variant">
                    {search ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id}
                    className="border-b border-outline-variant/5 hover:bg-surface-container-low/30 transition-colors"
                  >
                    {activeCols.map(col => (
                      <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                        {renderCell(user, col.key)}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingUser(user)}
                          title="Editar usuário"
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-primary/10 text-on-surface-variant hover:text-primary"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setResetPasswordUser(user)}
                          disabled={user.isOwner}
                          title="Resetar senha"
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-amber-500/10 text-on-surface-variant hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          <KeyRound size={15} />
                        </button>
                        <button
                          onClick={() => setRevokeUser(user)}
                          disabled={user.isOwner || user._count.sessions === 0}
                          title="Revogar sessões"
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                          <LogOut size={15} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(user.id)}
                          disabled={user.isOwner || isPending}
                          title={user.isActive ? 'Desativar usuário' : 'Ativar usuário'}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed ${
                            user.isActive
                              ? 'hover:bg-amber-500/10 text-on-surface-variant hover:text-amber-400'
                              : 'hover:bg-green-500/10 text-on-surface-variant hover:text-green-400'
                          }`}
                        >
                          {isPending ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : user.isActive ? (
                            <UserX size={15} />
                          ) : (
                            <UserCheck size={15} />
                          )}
                        </button>
                        {currentUserIsOwner && (
                          <button
                            onClick={() => setDeleteTarget(user)}
                            disabled={user.isOwner || isPending}
                            title="Excluir usuário"
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10 text-on-surface-variant hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={15} />
                          </button>
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

        {/* Pagination */}
        <div className="p-4 border-t border-outline-variant/10 flex items-center justify-between text-sm">
          <div className="text-on-surface-variant">
            Mostrando {Math.min((page - 1) * limit + 1, total)} até {Math.min(page * limit, total)} de {total}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-ghost px-3 gap-1"
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * limit >= total}
              className="btn btn-ghost px-3 gap-1"
            >
              Próxima <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-outline-variant/10 flex items-center justify-between">
          <p className="text-xs text-on-surface-variant">
            {filteredUsers.length} de {users.length} usuário{users.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateUserModal
          roles={roles}
          onClose={() => setShowCreateModal(false)}
          onCreated={(newUser) => {
            setUsers(prev => [newUser, ...prev]);
            setStats(prev => ({ ...prev, total: prev.total + 1, active: prev.active + 1 }));
            setShowCreateModal(false);
            toast.success('Usuário criado com sucesso!');
          }}
        />
      )}

      {/* Edit Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          roles={roles}
          onClose={() => setEditingUser(null)}
          onUpdated={(updated) => {
            setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
            setEditingUser(null);
            toast.success('Usuário atualizado com sucesso!');
          }}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
        />
      )}

      {/* Revoke Sessions Modal */}
      {revokeUser && (
        <RevokeSessionsModal
          user={revokeUser}
          onClose={() => setRevokeUser(null)}
          onSuccess={(userId) => {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, _count: { sessions: 0 } } : u));
            setRevokeUser(null);
            toast.success('Sessões revogadas com sucesso!');
          }}
        />
      )}

      {/* Delete User Modal */}
      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={(userId) => {
            setUsers(prev => prev.filter(u => u.id !== userId));
            setTotal(t => t - 1);
            setStats(s => ({ ...s, total: s.total - 1 }));
            setDeleteTarget(null);
            toast.success('Usuário excluído com sucesso!');
          }}
        />
      )}
    </div>
  );
}

// ─── Create User Modal ──────────────────────────────────
function CreateUserModal({
  roles,
  onClose,
  onCreated,
}: {
  roles: { id: string; name: string; description: string | null }[];
  onClose: () => void;
  onCreated: (user: UserListItem) => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', roleId: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await createUser({
      name: form.name,
      email: form.email,
      password: form.password,
      phone: form.phone || undefined,
      roleId: form.roleId || undefined,
    });

    if (result.success) {
      const selectedRole = roles.find(r => r.id === form.roleId);
      onCreated({
        id: result.userId!,
        name: form.name,
        email: form.email.toLowerCase(),
        phone: form.phone || null,
        authProvider: 'local',
        isOwner: false,
        isActive: true,
        twoFactorEnabled: false,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: selectedRole ? [{ role: { name: selectedRole.name } }] : [],
        _count: { sessions: 0 },
      });
    } else {
      setError(result.error || 'Erro ao criar usuário');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Novo Usuário</h2>
            <p className="text-xs text-on-surface-variant">Preencha os dados do novo usuário</p>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Nome Completo *</label>
            <input className="input" placeholder="João Silva" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          </div>

          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" placeholder="joao@empresa.com" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
          </div>

          <div>
            <label className="label">Senha *</label>
            <div className="relative">
              <input className="input input-icon-right" type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.password && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {[
                  { ok: form.password.length >= 8, text: 'Mín. 8 caracteres' },
                  { ok: /[A-Z]/.test(form.password), text: 'Letra maiúscula' },
                  { ok: /[0-9]/.test(form.password), text: 'Número' },
                ].map(r => (
                  <span key={r.text} className={`text-[11px] flex items-center gap-1 ${r.ok ? 'text-green-400' : 'text-on-surface-variant/60'}`}>
                    {r.ok ? '✓' : '○'} {r.text}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Telefone</label>
            <input className="input" placeholder="(00) 00000-0000" value={form.phone}
              maxLength={15}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                let masked = '';
                if (digits.length > 0) masked = '(' + digits.slice(0, 2);
                if (digits.length >= 2) masked += ') ';
                if (digits.length > 2 && digits.length <= 6) masked += digits.slice(2);
                else if (digits.length > 6 && digits.length <= 10) masked += digits.slice(2, 6) + '-' + digits.slice(6);
                else if (digits.length > 10) masked += digits.slice(2, 7) + '-' + digits.slice(7);
                setForm(p => ({ ...p, phone: masked }));
              }} />
          </div>

          <div>
            <label className="label">Grupo</label>
            <select className="input" value={form.roleId}
              onChange={e => setForm(p => ({ ...p, roleId: e.target.value }))}>
              <option value="">Sem grupo</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1 gap-1.5">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Criar Usuário
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit User Modal ────────────────────────────────────
function EditUserModal({
  user,
  roles,
  onClose,
  onUpdated,
}: {
  user: UserListItem;
  roles: { id: string; name: string; description: string | null }[];
  onClose: () => void;
  onUpdated: (user: UserListItem) => void;
}) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    roleId: user.roles[0]?.role.name ? roles.find(r => r.name === user.roles[0]?.role.name)?.id || '' : '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function maskPhone(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    let masked = '';
    if (digits.length > 0) masked = '(' + digits.slice(0, 2);
    if (digits.length >= 2) masked += ') ';
    if (digits.length > 2 && digits.length <= 6) masked += digits.slice(2);
    else if (digits.length > 6 && digits.length <= 10) masked += digits.slice(2, 6) + '-' + digits.slice(6);
    else if (digits.length > 10) masked += digits.slice(2, 7) + '-' + digits.slice(7);
    return masked;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await updateUser(user.id, {
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      roleId: form.roleId || undefined,
    });

    if (result.success) {
      const selectedRole = roles.find(r => r.id === form.roleId);
      onUpdated({
        ...user,
        name: form.name,
        email: form.email.toLowerCase(),
        phone: form.phone || null,
        roles: selectedRole ? [{ role: { name: selectedRole.name } }] : [],
        updatedAt: new Date(),
      });
    } else {
      setError(result.error || 'Erro ao atualizar usuário');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Editar Usuário</h2>
            <p className="text-xs text-on-surface-variant">{user.email}</p>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Nome Completo *</label>
            <input className="input" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          </div>

          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
          </div>

          <div>
            <label className="label">Telefone</label>
            <input className="input" placeholder="(00) 00000-0000" value={form.phone}
              maxLength={15}
              onChange={e => setForm(p => ({ ...p, phone: maskPhone(e.target.value) }))} />
          </div>

          <div>
            <label className="label">Grupo</label>
            <select className="input" value={form.roleId}
              onChange={e => setForm(p => ({ ...p, roleId: e.target.value }))}>
              <option value="">Sem grupo</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1 gap-1.5">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ───────────────────────────────
function ResetPasswordModal({
  user,
  onClose,
}: {
  user: UserListItem;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleReset() {
    setLoading(true);
    setError('');
    const result = await resetUserPassword(user.id);
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error || 'Erro ao resetar senha');
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={success ? undefined : onClose} />
      <div className="relative w-full max-w-sm bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Resetar Senha</h2>
            <p className="text-sm text-on-surface-variant mt-1">
              {success ? 'Senha resetada com sucesso' : `Confirma o reset de senha para ${user.email}?`}
            </p>
          </div>
          {!success && (
            <button onClick={onClose} className="btn-icon text-on-surface-variant hover:text-on-surface">
              <X size={18} />
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-error-container text-on-error-container text-sm">
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl text-center">
              <p className="text-sm font-bold text-primary mb-2">E-mail enviado!</p>
              <p className="text-xs text-on-surface-variant mb-2">Um link de redefinição de senha foi enviado para o usuário.</p>
            </div>
            <button onClick={onClose} className="btn btn-primary w-full">
              Concluir
            </button>
          </div>
        ) : (
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
            <button type="button" onClick={handleReset} disabled={loading} className="btn btn-primary flex-1 bg-amber-500 hover:bg-amber-600 text-black">
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Revoke Sessions Modal ──────────────────────────────
function RevokeSessionsModal({
  user,
  onClose,
  onSuccess
}: {
  user: UserListItem;
  onClose: () => void;
  onSuccess: (userId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRevoke() {
    setLoading(true);
    setError('');
    const result = await revokeUserSessions(user.id);
    if (result.success) {
      onSuccess(user.id);
    } else {
      setError(result.error || 'Erro ao revogar sessões');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Revogar Sessões</h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Desconectar todos os dispositivos de {user.email}?
            </p>
          </div>
          <button onClick={onClose} className="btn-icon text-on-surface-variant hover:text-on-surface">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-error-container text-on-error-container text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
          <button type="button" onClick={handleRevoke} disabled={loading} className="btn btn-primary flex-1 bg-amber-500 hover:bg-amber-600 text-black">
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete User Modal ──────────────────────────────────
function DeleteUserModal({
  user,
  onClose,
  onSuccess
}: {
  user: UserListItem;
  onClose: () => void;
  onSuccess: (userId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setLoading(true);
    setError('');
    const result = await deleteUser(user.id);
    if (result.success) {
      onSuccess(user.id);
    } else {
      setError(result.error || 'Erro ao excluir usuário');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-surface-container border border-error/20 rounded-2xl shadow-2xl p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold text-error">Excluir Usuário</h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Tem certeza que deseja excluir {user.email}? Esta ação é irreversível.
            </p>
          </div>
          <button onClick={onClose} className="btn-icon text-on-surface-variant hover:text-on-surface">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-error-container text-on-error-container text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
          <button type="button" onClick={handleDelete} disabled={loading} className="btn btn-primary flex-1 bg-error hover:bg-error/90 text-white">
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}
