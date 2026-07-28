'use client';

import { useState, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X, Loader2, Check, Search, Paperclip, Camera } from 'lucide-react';
import {
  createManutencao,
  updateManutencao,
  deleteManutencao,
  uploadAnexoManutencao,
  type RegistroManutencaoWithDetails,
} from '@/actions/manutencao';
import { usePermissions } from '@/hooks/use-permissions';

const TIPO_LABELS: Record<string, string> = {
  ABASTECIMENTO: 'Abastecimento',
  TROCA_OLEO: 'Troca de Óleo',
  ADITIVO: 'Aditivo',
  BATERIA: 'Bateria',
  LIMPEZA: 'Limpeza',
  DEFEITO_AVARIA: 'Defeito / Avaria',
  OUTRO: 'Outro',
};

const TIPOS = Object.keys(TIPO_LABELS) as (keyof typeof TIPO_LABELS)[];

function formatDataHora(d: Date | string) {
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function ManutencaoClient({ initialRegistros }: { initialRegistros: RegistroManutencaoWithDetails[] }) {
  const { can } = usePermissions();
  const [registros, setRegistros] = useState(initialRegistros);
  const [showCreate, setShowCreate] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<RegistroManutencaoWithDetails | null>(null);
  const [deletingRegistro, setDeletingRegistro] = useState<RegistroManutencaoWithDetails | null>(null);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');

  const filtered = useMemo(() => {
    let list = [...registros];
    if (filterTipo !== 'TODOS') {
      list = list.filter(r => r.tipo === filterTipo);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.observacoes || '').toLowerCase().includes(q) ||
        (r.responsavel?.name || '').toLowerCase().includes(q) ||
        TIPO_LABELS[r.tipo].toLowerCase().includes(q)
      );
    }
    return list;
  }, [registros, search, filterTipo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              className="input input-icon-left"
              placeholder="Buscar por observação, responsável, tipo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input max-w-[200px]" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
            <option value="TODOS">Todos os tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
          </select>
        </div>
        {can('maintenance', 'create') && (
          <button onClick={() => setShowCreate(true)} className="btn btn-primary gap-1.5 shrink-0">
            <Plus size={16} /> Nova Manutenção
          </button>
        )}
      </div>

      <div className="card border border-outline-variant/30 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-container/60 text-xs uppercase tracking-wider text-on-surface-variant">
            <tr>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-left px-4 py-3">Data/Hora</th>
              <th className="text-left px-4 py-3">Responsável</th>
              <th className="text-left px-4 py-3">Quantidade</th>
              <th className="text-left px-4 py-3">Custo</th>
              <th className="text-left px-4 py-3">Anexos</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">Nenhum registro encontrado.</td></tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} className="border-t border-outline-variant/10">
                <td className="px-4 py-3 font-medium text-on-surface">{TIPO_LABELS[r.tipo]}</td>
                <td className="px-4 py-3 text-on-surface-variant">{formatDataHora(r.dataHora)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{r.responsavel?.name || '—'}</td>
                <td className="px-4 py-3 text-on-surface-variant">{r.quantidade != null ? `${r.quantidade} ${r.unidadeMedida || ''}` : '—'}</td>
                <td className="px-4 py-3 text-on-surface-variant">{r.custo != null ? `R$ ${r.custo.toFixed(2)}` : '—'}</td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {r.anexos.length > 0 ? (
                    <span className="inline-flex items-center gap-1"><Paperclip size={14} /> {r.anexos.length}</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {can('maintenance', 'update') && (
                      <button onClick={() => setEditingRegistro(r)} className="btn-icon"><Edit2 size={16} /></button>
                    )}
                    {can('maintenance', 'delete') && (
                      <button onClick={() => setDeletingRegistro(r)} className="btn-icon btn-icon-danger"><Trash2 size={16} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showCreate || editingRegistro) && (
        <ManutencaoModal
          registro={editingRegistro}
          onClose={() => { setShowCreate(false); setEditingRegistro(null); }}
          onSaved={(registro) => {
            if (editingRegistro) {
              setRegistros(prev => prev.map(r => r.id === registro.id ? registro : r));
            } else {
              setRegistros(prev => [registro, ...prev]);
            }
            setShowCreate(false);
            setEditingRegistro(null);
          }}
        />
      )}

      {deletingRegistro && (
        <DeleteManutencaoModal
          registro={deletingRegistro}
          onClose={() => setDeletingRegistro(null)}
          onSuccess={() => {
            setRegistros(prev => prev.filter(r => r.id !== deletingRegistro.id));
            setDeletingRegistro(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Create/Edit Modal ──────────────────────────────────
function ManutencaoModal({
  registro,
  onClose,
  onSaved,
}: {
  registro: RegistroManutencaoWithDetails | null;
  onClose: () => void;
  onSaved: (registro: RegistroManutencaoWithDetails) => void;
}) {
  const isEditing = !!registro;
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toLocalInputValue(d: Date | string) {
    const date = new Date(d);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  const [form, setForm] = useState({
    tipo: registro?.tipo || 'ABASTECIMENTO',
    dataHora: registro ? toLocalInputValue(registro.dataHora) : toLocalInputValue(new Date()),
    quantidade: registro?.quantidade?.toString() || '',
    unidadeMedida: registro?.unidadeMedida || '',
    custo: registro?.custo?.toString() || '',
    observacoes: registro?.observacoes || '',
  });
  const [newAnexoPaths, setNewAnexoPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadAnexoManutencao(formData);
      if (res.success && res.url) {
        setNewAnexoPaths(prev => [...prev, res.url]);
      } else {
        toast.error(res.error || 'Falha ao enviar anexo.');
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      tipo: form.tipo,
      dataHora: new Date(form.dataHora).toISOString(),
      quantidade: form.quantidade ? Number(form.quantidade) : undefined,
      unidadeMedida: form.unidadeMedida || undefined,
      custo: form.custo ? Number(form.custo) : undefined,
      observacoes: form.observacoes || undefined,
      anexoPaths: newAnexoPaths,
    };

    try {
      const result = isEditing
        ? await updateManutencao(registro!.id, payload)
        : await createManutencao(payload);

      if (result.success) {
        toast.success(isEditing ? 'Manutenção atualizada!' : 'Manutenção registrada!');
        onSaved(result.registro);
      } else {
        setError(result.error || 'Erro ao salvar manutenção');
        setLoading(false);
      }
    } catch (err) {
      setError('Erro inesperado ao salvar manutenção. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10 shrink-0">
          <h2 className="text-lg font-bold text-on-surface">{isEditing ? 'Editar Manutenção' : 'Nova Manutenção'}</h2>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {error && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>
          )}

          <div>
            <label className="label">Tipo *</label>
            <select className="input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as typeof form.tipo }))} required>
              {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Data/Hora *</label>
            <input type="datetime-local" className="input" value={form.dataHora} onChange={e => setForm(p => ({ ...p, dataHora: e.target.value }))} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantidade</label>
              <input className="input" type="number" step="0.01" value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} placeholder="Ex: 20" />
            </div>
            <div>
              <label className="label">Unidade</label>
              <input className="input" value={form.unidadeMedida} onChange={e => setForm(p => ({ ...p, unidadeMedida: e.target.value }))} placeholder="Ex: L" />
            </div>
          </div>

          <div>
            <label className="label">Custo (R$)</label>
            <input className="input" type="number" step="0.01" value={form.custo} onChange={e => setForm(p => ({ ...p, custo: e.target.value }))} placeholder="Ex: 150.00" />
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea className="input min-h-[80px] resize-none" value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Detalhes, defeito encontrado, etc." />
          </div>

          <div>
            <label className="label">Anexos (fotos/comprovantes)</label>
            {isEditing && registro!.anexos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {registro!.anexos.map(a => (
                  <img key={a.id} src={a.caminhoArquivo} alt="Anexo" className="w-full h-16 object-cover rounded-lg border border-outline-variant/20" />
                ))}
              </div>
            )}
            {newAnexoPaths.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {newAnexoPaths.map((url, i) => (
                  <img key={i} src={url} alt="Novo anexo" className="w-full h-16 object-cover rounded-lg border border-primary/40" />
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn btn-secondary btn-sm gap-1.5"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              Adicionar foto
            </button>
            <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleFilesChange} />
          </div>
        </form>

        <div className="p-4 border-t border-outline-variant/10 flex gap-3 shrink-0 bg-surface-container">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={loading || uploading} className="btn btn-primary flex-1 gap-1.5">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ──────────────────────────────────
function DeleteManutencaoModal({
  registro,
  onClose,
  onSuccess,
}: {
  registro: RegistroManutencaoWithDetails;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setLoading(true);
    setError('');
    try {
      const result = await deleteManutencao(registro.id);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Erro ao excluir manutenção');
        setLoading(false);
      }
    } catch (err) {
      setError('Erro inesperado ao excluir manutenção. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl p-6">
        <h2 className="text-lg font-bold text-on-surface mb-2">Excluir Manutenção</h2>
        <p className="text-sm text-on-surface-variant mb-6">
          Tem certeza que deseja excluir este registro de <strong className="text-on-surface">{TIPO_LABELS[registro.tipo]}</strong>? Esta ação não pode ser desfeita.
        </p>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancelar</button>
          <button type="button" onClick={handleDelete} disabled={loading} className="btn btn-danger flex-1 gap-1.5">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
