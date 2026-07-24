'use client';

import { useState, useRef } from 'react';
import { updateProfile } from '@/actions/profile';
import { uploadAvatarImage } from '@/actions/upload';
import { toast } from 'sonner';
import { Loader2, Camera, User, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProfileFormProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  primaryColor: string;
  authProvider?: string;
}

export function ProfileForm({ user, primaryColor, authProvider = 'local' }: ProfileFormProps) {
  const isExternal = authProvider !== 'local';
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isPending, setIsPending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    
    const res = await updateProfile({ name, email, avatarUrl: avatarUrl || null });
    
    if (res.success) {
      toast.success('Perfil atualizado com sucesso!');
      router.refresh();
    } else {
      toast.error(res.error || 'Falha ao atualizar perfil.');
    }
    
    setIsPending(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await uploadAvatarImage(formData);
    
    if (res.success && res.url) {
      setAvatarUrl(res.url);
      toast.success('Avatar atualizado! Salve as alterações.');
    } else {
      toast.error(res.error || 'Falha ao enviar a foto.');
    }
    
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Pega iniciais do nome
  const getInitials = (n: string) => {
    if (!n) return 'U';
    return n.split(' ').map(part => part[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="card p-6 bg-surface border border-outline-variant/30 rounded-2xl">
      <h2 className="text-lg font-bold text-on-surface mb-6">Dados Pessoais</h2>

      {isExternal && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-6">
          <Info size={18} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-400">Conta gerenciada externamente</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Seus dados de perfil são gerenciados pelo servidor {authProvider.toUpperCase()}. Para alterações, entre em contato com o administrador.
            </p>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Avatar Upload */}
        <div className="flex items-center gap-6">
          <div className={`relative ${isExternal ? '' : 'group cursor-pointer'}`} onClick={() => !isExternal && fileInputRef.current?.click()}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-surface" />
            ) : (
              <div 
                className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white border-4 border-surface"
                style={{ background: primaryColor }}
              >
                {getInitials(name)}
              </div>
            )}
            
            {!isExternal && (
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploading ? <Loader2 size={24} className="animate-spin text-white" /> : <Camera size={24} className="text-white" />}
              </div>
            )}
            
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={isExternal}
            />
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-on-surface">Foto de Perfil</h3>
            <p className="text-xs text-on-surface-variant mt-1 max-w-[200px]">
              {isExternal ? 'Gerenciado pelo servidor externo.' : 'Clique na imagem para enviar uma nova foto (Max 5MB).'}
            </p>
          </div>
        </div>

        {/* Formulário de Texto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Nome Completo</label>
            <input
              type="text"
              required
              className={`input bg-surface-container-lowest mt-1 ${isExternal ? 'opacity-60 cursor-not-allowed' : ''}`}
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isExternal}
              readOnly={isExternal}
            />
          </div>
          <div>
            <label className="label">Endereço de E-mail</label>
            <input
              type="email"
              required
              className={`input bg-surface-container-lowest mt-1 ${isExternal ? 'opacity-60 cursor-not-allowed' : ''}`}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isExternal}
              readOnly={isExternal}
            />
          </div>
        </div>

        {!isExternal && (
          <div className="flex justify-end pt-4">
            <button type="submit" disabled={isPending || isUploading} className="btn-primary px-6 py-2 rounded-xl">
              {isPending ? <Loader2 size={18} className="animate-spin" /> : 'Salvar Alterações'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
