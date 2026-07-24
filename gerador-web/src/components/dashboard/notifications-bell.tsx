'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, ShieldAlert, Info, X } from 'lucide-react';
import { getUnreadNotificationsAction, markAsReadAction, markAllAsReadAction } from '@/actions/notifications';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: Date;
}

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    const res = await getUnreadNotificationsAction();
    if (res.success && res.notifications) {
      setNotifications(res.notifications as any);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    
    // Polling a cada 30 segundos
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await markAsReadAction(id);
  };

  const handleMarkAllAsRead = async () => {
    setNotifications([]);
    await markAllAsReadAction();
    setIsOpen(false);
  };

  const getIcon = (type: string) => {
    if (type === 'WARNING' || type === 'DANGER') return <ShieldAlert size={16} className="text-red-500" />;
    if (type === 'SUCCESS') return <CheckCircle2 size={16} className="text-green-500" />;
    return <Info size={16} className="text-blue-500" />;
  };

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Agora mesmo';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-on-surface hover:bg-surface-container-high transition-colors"
      >
        <Bell size={20} />
        {notifications.length > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-surface"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[400px]">
          <div className="p-3 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container/30">
            <h3 className="text-sm font-bold text-on-surface">Notificações</h3>
            {notifications.length > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-8 text-center text-on-surface-variant text-sm">Carregando...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-sm flex flex-col items-center gap-2">
                <Bell size={24} className="opacity-20" />
                <p>Nenhuma notificação nova</p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {notifications.map((notif) => (
                  <div key={notif.id} className="p-3 hover:bg-surface-container/30 transition-colors group relative">
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0 bg-surface-container-highest p-1.5 rounded-full">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <p className="text-sm font-semibold text-on-surface truncate">{notif.title}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-on-surface-variant/70 mt-1.5 font-medium">
                          {timeAgo(notif.createdAt)}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="absolute right-3 top-3 p-1 rounded-full text-on-surface-variant opacity-0 group-hover:opacity-100 hover:bg-surface-container-high hover:text-on-surface transition-all"
                      title="Marcar como lida"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
