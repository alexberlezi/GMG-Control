'use client';

import { useState, useTransition } from 'react';
import { X, Mail, Shield, Loader2, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { createInvite } from '@/actions/invites';

interface CreateInviteModalProps {
  roles: { id: string; name: string; isSystem: boolean }[];
  onClose: () => void;
}

export default function CreateInviteModal({ roles, onClose }: CreateInviteModalProps) {
  const [email, setEmail] = useState('');
  // Select the default role if available (or the first non-system one, or just the first one)
  const defaultRole = roles.find(r => !r.isSystem) || roles[0];
  const [roleId, setRoleId] = useState(defaultRole?.id || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedRole = roles.find(r => r.id === roleId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !roleId) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    startTransition(async () => {
      const res = await createInvite(email, roleId);
      if (res.success) {
        toast.success('Convite enviado com sucesso!');
        onClose();
      } else {
        toast.error(res.error || 'Erro ao enviar convite');
      }
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200" onClick={onClose} />
      
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface border border-outline-variant/20 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Novo Convite</h2>
            <p className="text-sm text-on-surface-variant mt-1">Envie um convite de acesso para um membro.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-on-surface">E-mail do Usuário</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="email"
                required
                placeholder="nome@empresa.com"
                className="input input-icon-left w-full"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-on-surface">Grupo (Permissões)</label>
            <div className="relative">
              <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant z-10" />
              
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="input input-icon-left w-full text-left flex items-center justify-between bg-surface relative"
              >
                <span className="truncate">{selectedRole?.name || 'Selecione um grupo...'}</span>
                <ChevronDown size={16} className={`text-on-surface-variant transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-outline-variant/20 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto p-1">
                    {roles.map(role => (
                      <button
                        key={role.id}
                        type="button"
                        className={`w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-surface-container transition-colors flex items-center justify-between ${roleId === role.id ? 'bg-primary/10 text-primary' : 'text-on-surface'}`}
                        onClick={() => {
                          setRoleId(role.id);
                          setIsDropdownOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-bold">{role.name}</span>
                          {role.isSystem && <span className="text-[10px] opacity-70 uppercase tracking-widest font-semibold mt-0.5">Permissões de Sistema</span>}
                        </div>
                        {roleId === role.id && <Check size={16} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              O usuário será adicionado a este grupo assim que aceitar o convite.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-outline-variant/10">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary min-w-[120px]"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Convite'
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
