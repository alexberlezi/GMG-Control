'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Shield, ShieldAlert, ShieldCheck, Users, Edit2, Trash2, Plus, X, Loader2, Check, ChevronDown, ChevronRight, LayoutGrid, List, Columns3, ArrowUpDown, ChevronUp, Search, Copy, Star } from 'lucide-react';
import { createRole, updateRole, deleteRole, setRoleAsDefault, type RoleWithDetails } from '@/actions/roles';
import { RoleMembersModal } from './role-members-modal';

const RESOURCE_LABELS: Record<string, string> = {
  '*': 'Acesso Global (Todos os Módulos)',
  'audit_logs': 'Auditoria (Logs)',
  'invites': 'Convites',
  'roles': 'Grupos e Permissões',
  'sessions': 'Sessões Ativas',
  'settings': 'Configurações Globais',
  'users': 'Gestão de Usuários',
};

const ACTION_LABELS: Record<string, string> = {
  '*': 'Controle Total',
  'manage': 'Gerenciar (Tudo)',
  'read': 'Apenas Visualizar',
  'write': 'Criar e Editar',
  'create': 'Criar',
  'update': 'Editar',
  'delete': 'Excluir',
  'export': 'Exportar Dados',
  'approve': 'Aprovar / Validar',
};

type ColKey = 'name' | 'description' | 'users' | 'permissions' | 'createdAt';

interface ColDef {
  key: ColKey;
  label: string;
  defaultVisible: boolean;
  sortable: boolean;
}

const COLUMNS: ColDef[] = [
  { key: 'name', label: 'Nome', defaultVisible: true, sortable: true },
  { key: 'description', label: 'Descrição', defaultVisible: true, sortable: false },
  { key: 'users', label: 'Usuários', defaultVisible: true, sortable: true },
  { key: 'permissions', label: 'Permissões', defaultVisible: true, sortable: true },
  { key: 'createdAt', label: 'Criado em', defaultVisible: false, sortable: true },
];

export function RolesClient({
  initialRoles,
  permissionsGrouped,
  currentUserIsOwner,
}: {
  initialRoles: RoleWithDetails[];
  permissionsGrouped: Record<string, { id: string, resource: string, action: string }[]>;
  currentUserIsOwner: boolean;
}) {
  const [roles, setRoles] = useState(initialRoles);
  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithDetails | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleWithDetails | null>(null);
  const [cloningRole, setCloningRole] = useState<RoleWithDetails | null>(null);
  const [managingMembersRole, setManagingMembersRole] = useState<RoleWithDetails | null>(null);
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    const saved = localStorage.getItem('authforge_roles_view');
    if (saved === 'cards' || saved === 'table') {
      setViewMode(saved);
    }
  }, []);

  function handleViewMode(mode: 'cards' | 'table') {
    setViewMode(mode);
    localStorage.setItem('authforge_roles_view', mode);
  }

  const [showColPicker, setShowColPicker] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('authforge_roles_cols');
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
  const [sortCol, setSortCol] = useState<ColKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const activeCols = COLUMNS.filter(c => visibleCols.has(c.key));

  const sortedRoles = useMemo(() => {
    let filtered = [...roles];
    
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      filtered = filtered.filter(r => 
        r.name.toLowerCase().includes(q) || 
        r.description?.toLowerCase().includes(q)
      );
    }

    return filtered.sort((a, b) => {
      let valA: any = (a as any)[sortCol];
      let valB: any = (b as any)[sortCol];
      if (sortCol === 'users') { valA = a._count.users; valB = b._count.users; }
      if (sortCol === 'permissions') { valA = a._count.permissions; valB = b._count.permissions; }
      
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [roles, sortCol, sortDir]);

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
      localStorage.setItem('authforge_roles_cols', JSON.stringify([...next]));
      return next;
    });
  }

  function renderCell(role: RoleWithDetails, col: ColKey) {
    switch (col) {
      case 'name':
        return (
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              role.isSystem ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'
            }`}>
              {role.isSystem ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
            </div>
            <div>
              <p className="font-bold text-on-surface text-sm">{role.name}</p>
              <div className="flex gap-1.5 mt-0.5">
                {role.isSystem && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-400 uppercase tracking-wider">
                    Sistema
                  </span>
                )}
                {role.isDefault && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                    Padrão
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      case 'description':
        return (
          <span className="text-xs text-on-surface-variant line-clamp-1 max-w-xs">
            {role.description || '-'}
          </span>
        );
      case 'users':
        return (
          <button 
            onClick={() => setManagingMembersRole(role)}
            className="flex items-center gap-1.5 text-on-surface hover:text-primary transition-colors bg-surface-container-high px-2 py-1 rounded-lg w-fit"
            title="Gerenciar membros"
          >
            <Users size={16} className="text-primary" />
            <span className="font-bold">{role._count.users}</span>
          </button>
        );
      case 'permissions':
        return (
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
            <Shield size={14} className="text-on-surface-variant/50" />
            {role._count.permissions}
          </div>
        );
      case 'createdAt':
        return (
          <span className="text-xs text-on-surface-variant">
            {new Date(role.createdAt).toLocaleDateString('pt-BR')}
          </span>
        );
    }
  }

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-b border-outline-variant/10">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              className="input input-icon-left"
              placeholder="Buscar por nome ou descrição..."
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
            {viewMode === 'table' && (
              <div className="relative">
                <button
                  onClick={() => setShowColPicker(!showColPicker)}
                  className="btn btn-ghost text-xs gap-1.5"
                >
                  <Columns3 size={14} />
                  <span className="hidden sm:inline">Colunas</span>
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
            )}
            <button
              onClick={() => setShowCreate(true)}
              disabled={!currentUserIsOwner}
              className="btn btn-primary text-xs gap-1.5"
            >
              <Plus size={14} />
              Novo Grupo
            </button>
          </div>
        </div>

        {/* Content Area */}
        {viewMode === 'cards' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300 bg-surface-container-lowest">
            {sortedRoles.map(role => (
              <div key={role.id} className="card p-6 flex flex-col hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      role.isSystem ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'
                    }`}>
                      {role.isSystem ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface text-lg">{role.name}</h3>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {role.isSystem && <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Sistema</span>}
                    {role.isDefault && <span className="bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Padrão</span>}
                  </div>
                </div>

                <p className="text-sm text-on-surface-variant mb-6 line-clamp-2 min-h-[40px]">
                  {role.description || 'Nenhuma descrição fornecida para este grupo.'}
                </p>

                <div className="flex gap-4 mt-auto mb-5 text-sm">
                  <button 
                    onClick={() => setManagingMembersRole(role)}
                    className="flex items-center gap-1.5 text-on-surface hover:text-primary transition-colors bg-surface-container-high px-2 py-1 rounded-lg"
                    title="Gerenciar membros"
                  >
                    <Users size={16} className="text-primary" />
                    <span className="font-bold">{role._count.users}</span>
                    <span className="text-on-surface-variant text-xs">Usuários</span>
                  </button>
                  <div className="flex items-center gap-1.5 text-on-surface">
                    <ShieldCheck size={16} className="text-green-500" />
                    <span className="font-bold">{role._count.permissions}</span>
                    <span className="text-on-surface-variant text-xs">Permissões</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-outline-variant/10 flex justify-end gap-1">
                  <button
                    onClick={() => setEditingRole(role)}
                    disabled={!currentUserIsOwner}
                    title="Editar Grupo"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-30"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => setCloningRole(role)}
                    disabled={!currentUserIsOwner}
                    title="Duplicar Grupo"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-30"
                  >
                    <Copy size={15} />
                  </button>
                  {!role.isSystem && !role.isDefault && (
                    <button
                      onClick={async () => {
                        const res = await setRoleAsDefault(role.id);
                        if (res.success) {
                          setRoles(prev => prev.map(r => ({ ...r, isDefault: r.id === role.id })));
                          toast.success('Grupo definido como padrão!');
                        }
                      }}
                      disabled={!currentUserIsOwner}
                      title="Tornar Padrão"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-amber-500/10 hover:text-amber-500 transition-colors disabled:opacity-30"
                    >
                      <Star size={15} />
                    </button>
                  )}
                  {!role.isSystem && (
                    <button
                      onClick={() => setDeletingRole(role)}
                      disabled={!currentUserIsOwner}
                      title="Excluir Grupo"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-30"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {sortedRoles.length === 0 ? (
                  <tr>
                    <td colSpan={activeCols.length + 1} className="px-4 py-12 text-center text-sm text-on-surface-variant">
                      Nenhum grupo encontrado
                    </td>
                  </tr>
                ) : (
                  sortedRoles.map(role => (
                    <tr key={role.id} className="border-b border-outline-variant/5 hover:bg-surface-container-low/30 transition-colors">
                      {activeCols.map(col => (
                        <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                          {renderCell(role, col.key)}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingRole(role)}
                            disabled={!currentUserIsOwner}
                            title="Editar Grupo"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-30"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => setCloningRole(role)}
                            disabled={!currentUserIsOwner}
                            title="Duplicar Grupo"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-30"
                          >
                            <Copy size={15} />
                          </button>
                          {!role.isSystem && !role.isDefault && (
                            <button
                              onClick={async () => {
                                const res = await setRoleAsDefault(role.id);
                                if (res.success) {
                                  setRoles(prev => prev.map(r => ({ ...r, isDefault: r.id === role.id })));
                                  toast.success('Grupo definido como padrão!');
                                }
                              }}
                              disabled={!currentUserIsOwner}
                              title="Tornar Padrão"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-amber-500/10 hover:text-amber-500 transition-colors disabled:opacity-30"
                            >
                              <Star size={15} />
                            </button>
                          )}
                          {!role.isSystem && (
                            <button
                              onClick={() => setDeletingRole(role)}
                              disabled={!currentUserIsOwner}
                              title="Excluir Grupo"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-30"
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
      </div>

      {/* Modals */}
      {(showCreate || editingRole || cloningRole) && (
        <RoleModal
          role={editingRole || cloningRole}
          isClone={!!cloningRole}
          permissionsGrouped={permissionsGrouped}
          onClose={() => {
            setShowCreate(false);
            setEditingRole(null);
            setCloningRole(null);
          }}
          onSaved={(savedRole) => {
            if (editingRole) {
              setRoles(prev => prev.map(r => r.id === savedRole.id ? savedRole : r));
              toast.success('Grupo atualizado com sucesso!');
            } else {
              setRoles(prev => [...prev, savedRole]);
              toast.success('Grupo criado com sucesso!');
            }
            setShowCreate(false);
            setEditingRole(null);
            setCloningRole(null);
          }}
        />
      )}

      {deletingRole && (
        <DeleteRoleModal
          role={deletingRole}
          onClose={() => setDeletingRole(null)}
          onSuccess={() => {
            setRoles(prev => prev.filter(r => r.id !== deletingRole.id));
            setDeletingRole(null);
            toast.success('Grupo excluído com sucesso!');
          }}
        />
      )}

      {managingMembersRole && (
        <RoleMembersModal
          role={managingMembersRole}
          onClose={() => setManagingMembersRole(null)}
          onMembersChanged={() => {
            // we could refresh all roles or just increment/decrement count locally, 
            // but the easiest is to just let it be, as the modal has accurate data.
            // A full refresh would be ideal but might lose the current view state unless we just refetch data.
          }}
        />
      )}
    </div>
  );
}

// ─── Role Modal (Create/Edit) ───────────────────────────
function RoleModal({
  role,
  isClone = false,
  permissionsGrouped,
  onClose,
  onSaved,
}: {
  role: RoleWithDetails | null;
  isClone?: boolean;
  permissionsGrouped: Record<string, { id: string, resource: string, action: string }[]>;
  onClose: () => void;
  onSaved: (role: RoleWithDetails) => void;
}) {
  const [form, setForm] = useState({
    name: role ? (isClone ? `Cópia de ${role.name}` : role.name) : '',
    description: role?.description || '',
  });
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(
    new Set(role?.permissions.map(p => p.permission.id) || [])
  );
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!role && !isClone;

  function togglePermission(id: string) {
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleResourceGroup(resource: string) {
    const groupPerms = permissionsGrouped[resource].map(p => p.id);
    const allSelected = groupPerms.every(id => selectedPerms.has(id));
    
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (allSelected) {
        groupPerms.forEach(id => next.delete(id));
      } else {
        groupPerms.forEach(id => next.add(id));
      }
      return next;
    });
  }

  function toggleExpand(resource: string) {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(resource)) next.delete(resource);
      else next.add(resource);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      name: form.name,
      description: form.description,
      permissionIds: Array.from(selectedPerms),
    };

    let result: any;
    if (isEditing) {
      result = await updateRole(role.id, payload);
    } else {
      result = await createRole(payload);
    }

    if (result.success) {
      // Re-construct the role object for the UI without refetching all
      const savedRole: RoleWithDetails = {
        id: isEditing ? role.id : result.roleId!,
        name: role?.isSystem ? role.name : form.name.trim(),
        description: form.description.trim() || null,
        isSystem: role?.isSystem || false,
        isDefault: role?.isDefault || false,
        createdAt: role?.createdAt || new Date(),
        _count: {
          users: role?._count.users || 0,
          permissions: payload.permissionIds.length,
        },
        permissions: payload.permissionIds.map(id => {
          // Find the permission details to store in the local state
          let permDetail = { id, resource: '', action: '' };
          Object.values(permissionsGrouped).forEach(group => {
            const found = group.find(p => p.id === id);
            if (found) permDetail = found;
          });
          return { permission: permDetail };
        }),
      };
      onSaved(savedRole);
    } else {
      setError(result.error || 'Erro ao salvar grupo');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-on-surface">{isEditing ? 'Editar Grupo' : 'Novo Grupo'}</h2>
            <p className="text-xs text-on-surface-variant">
              {isEditing ? 'Modifique os detalhes e permissões deste grupo' : 'Crie um novo grupo de acesso'}
            </p>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {error && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="label">Nome do Grupo *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                disabled={role?.isSystem}
                required
                placeholder="Ex: Gerentes"
              />
              {role?.isSystem && (
                <p className="text-[11px] text-amber-400 mt-1">O nome de grupos do sistema não pode ser alterado.</p>
              )}
            </div>

            <div>
              <label className="label">Descrição</label>
              <textarea
                className="input min-h-[80px] resize-none"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Descreva o propósito deste grupo..."
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-on-surface mb-3 border-b border-outline-variant/10 pb-2">
              Permissões do Grupo
            </h3>
            
            <div className="space-y-6">
              {Object.entries(permissionsGrouped).map(([resource, perms]) => {
                const groupPerms = perms.map(p => p.id);
                const allSelected = groupPerms.every(id => selectedPerms.has(id));
                const someSelected = groupPerms.some(id => selectedPerms.has(id));
                const isExpanded = expandedModules.has(resource);

                return (
                  <div key={resource} className="bg-surface border border-outline-variant/20 rounded-xl overflow-hidden">
                    <div 
                      className={`px-4 py-3 border-b border-outline-variant/10 flex items-center justify-between cursor-pointer transition-colors ${
                        isExpanded ? 'bg-surface-container' : 'bg-surface-container/40 hover:bg-surface-container/80'
                      }`}
                      onClick={() => toggleExpand(resource)}
                    >
                      <div className="flex items-center gap-2">
                        <button className="text-on-surface transition-colors">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        <span className={`text-xs font-bold uppercase tracking-wider ${isExpanded ? 'text-primary' : 'text-on-surface'}`}>
                          Módulo: {RESOURCE_LABELS[resource] || resource}
                        </span>
                      </div>
                      <div 
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          allSelected ? 'bg-primary border-primary text-white' 
                          : someSelected ? 'bg-primary/20 border-primary text-primary'
                          : 'border-outline-variant bg-surface-container'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleResourceGroup(resource);
                        }}
                      >
                        {allSelected ? <Check size={12} strokeWidth={4} /> : someSelected ? <div className="w-2 h-0.5 bg-current rounded-full" /> : null}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-surface">
                      {perms.map(perm => {
                        const isChecked = selectedPerms.has(perm.id);
                        return (
                          <div 
                            key={perm.id}
                            onClick={() => togglePermission(perm.id)}
                            className="group flex items-center justify-between p-2 rounded-lg hover:bg-primary/5 cursor-pointer transition-colors"
                          >
                            <span className={`text-sm ${isChecked ? 'text-primary font-medium' : 'text-on-surface'}`}>
                              {ACTION_LABELS[perm.action] || perm.action}
                            </span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              isChecked 
                                ? 'bg-primary border-primary text-white scale-100' 
                                : 'border-outline-variant bg-surface-container scale-100 group-hover:border-primary/50'
                            }`}>
                              {isChecked && <Check size={12} strokeWidth={4} />}
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant/10 flex gap-3 shrink-0 bg-surface-container">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={loading} className="btn btn-primary flex-1 gap-1.5">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Salvar Grupo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Role Modal ──────────────────────────────────
function DeleteRoleModal({
  role,
  onClose,
  onSuccess,
}: {
  role: RoleWithDetails;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setLoading(true);
    setError('');
    const result = await deleteRole(role.id);
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || 'Erro ao excluir grupo');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl p-6">
        <h2 className="text-lg font-bold text-on-surface mb-2">Excluir Grupo</h2>
        <p className="text-sm text-on-surface-variant mb-6">
          Tem certeza que deseja excluir o grupo <strong className="text-on-surface">{role.name}</strong>? Esta ação não pode ser desfeita e todos os {role._count.users} usuários perderão este acesso.
        </p>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-error-container text-on-error-container text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
          <button type="button" onClick={handleDelete} disabled={loading} className="btn flex-1 bg-red-500 hover:bg-red-600 text-white gap-1.5">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
