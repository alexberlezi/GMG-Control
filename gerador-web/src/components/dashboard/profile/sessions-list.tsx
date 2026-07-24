'use client';

import { useState } from 'react';
import { revokeSession, revokeAllOtherSessions } from '@/actions/profile';
import { toast } from 'sonner';
import { Loader2, MonitorSmartphone, Monitor, Smartphone, Globe, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Session {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: Date;
  isCurrent: boolean;
}

interface SessionsListProps {
  sessions: Session[];
}

export function SessionsList({ sessions }: SessionsListProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const handleRevoke = async (id: string) => {
    setLoadingId(id);
    const res = await revokeSession(id);
    if (res.success) {
      toast.success('Sessão encerrada com sucesso.');
      router.refresh();
    } else {
      toast.error(res.error || 'Falha ao encerrar sessão.');
    }
    setLoadingId(null);
  };

  const handleRevokeAll = async () => {
    if (!confirm('Tem certeza que deseja desconectar todos os outros dispositivos?')) return;
    
    setRevokingAll(true);
    const res = await revokeAllOtherSessions();
    if (res.success) {
      toast.success('Todos os outros dispositivos foram desconectados.');
      router.refresh();
    } else {
      toast.error(res.error || 'Falha ao desconectar dispositivos.');
    }
    setRevokingAll(false);
  };

  const getDeviceIcon = (ua: string | null) => {
    if (!ua) return <MonitorSmartphone size={20} />;
    const lower = ua.toLowerCase();
    if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) return <Smartphone size={20} />;
    return <Monitor size={20} />;
  };

  const getBrowserInfo = (ua: string | null) => {
    if (!ua) return 'Dispositivo Desconhecido';
    
    let browser = 'Navegador Desconhecido';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    let os = 'OS Desconhecido';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return `${browser} em ${os}`;
  };

  return (
    <div className="card p-6 bg-surface border border-outline-variant/30 rounded-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Globe size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Sessões Ativas</h2>
            <p className="text-xs text-on-surface-variant">Dispositivos conectados à sua conta.</p>
          </div>
        </div>
        
        {sessions.length > 1 && (
          <button 
            onClick={handleRevokeAll}
            disabled={revokingAll}
            className="btn flex items-center justify-center gap-2 px-4 py-2 text-sm text-error hover:bg-error/10 border border-error/20 rounded-lg transition-colors"
          >
            {revokingAll ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
            Desconectar Outros
          </button>
        )}
      </div>
      
      <div className="space-y-3">
        {sessions.map((session) => (
          <div key={session.id} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
            <div className="flex items-center gap-4">
              <div className="text-on-surface-variant opacity-70">
                {getDeviceIcon(session.userAgent)}
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  {getBrowserInfo(session.userAgent)}
                  {session.isCurrent && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary/10 text-tertiary uppercase tracking-wider">
                      Este Dispositivo
                    </span>
                  )}
                </p>
                <div className="text-xs text-on-surface-variant flex items-center gap-2 mt-1">
                  <span>{session.ipAddress || 'IP Desconhecido'}</span>
                  <span>•</span>
                  <span>Ativo {new Date(session.lastActiveAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            {!session.isCurrent && (
              <button
                onClick={() => handleRevoke(session.id)}
                disabled={loadingId === session.id}
                className="text-error hover:text-error/80 p-2 rounded-lg hover:bg-error/10 transition-colors"
                title="Encerrar sessão"
              >
                {loadingId === session.id ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
