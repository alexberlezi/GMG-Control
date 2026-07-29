'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, ShieldCheck, Mail as MailIcon, Activity,
  Settings, UserCircle, Bell, Menu, X, LogOut, Moon, Sun,
  Key, Globe, Lock, ChevronDown, Gauge, Layers, SlidersHorizontal, Home, Wrench, Power, History, BarChart3, AlertTriangle
} from 'lucide-react';
import { Can } from '@/hooks/use-permissions';
import { NotificationsBell } from './notifications-bell';

interface DashboardShellProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    isOwner: boolean;
  };
  projectName: string;
  primaryColor: string;
  logoDarkUrl: string | null;
  logoLightUrl: string | null;
  faviconUrl: string | null;
  children: ReactNode;
}

const DIRECT_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', resource: null },
];

const SECTION_ITEMS = [
  { label: 'GERADOR', icon: Gauge, items: [
    { href: '/dashboard/gerador', icon: BarChart3, label: 'Painel', resource: 'generator' },
    { href: '/dashboard/gerador/controle', icon: Power, label: 'Controle', resource: 'generator' },
    { href: '/dashboard/gerador/historico', icon: History, label: 'Histórico', resource: 'generator' },
    { href: '/dashboard/gerador/alarmes', icon: AlertTriangle, label: 'Alarmes', resource: 'generator' },
    { href: '/dashboard/manutencao', icon: Wrench, label: 'Manutenções', resource: 'generator' },
  ]},
  { label: 'GERENCIAMENTO', icon: Layers, items: [
    { href: '/dashboard/users', icon: Users, label: 'Usuários', resource: 'users' },
    { href: '/dashboard/roles', icon: ShieldCheck, label: 'Grupos', resource: 'roles' },
    { href: '/dashboard/invites', icon: MailIcon, label: 'Convites', resource: 'invites' },
    { href: '/dashboard/sessions', icon: Globe, label: 'Sessões', resource: 'sessions' },
    { href: '/dashboard/audit', icon: Activity, label: 'Auditoria', resource: 'audit_logs' },
  ]},
  { label: 'CONFIGURAÇÕES', icon: SlidersHorizontal, items: [
    { href: '/dashboard/settings/appearance', icon: Settings, label: 'Personalização', resource: 'settings' },
    { href: '/dashboard/settings/auth', icon: Key, label: 'Autenticação', resource: 'settings' },
    { href: '/dashboard/settings/email', icon: MailIcon, label: 'Email', resource: 'settings' },
    { href: '/dashboard/settings/security', icon: Lock, label: 'Segurança', resource: 'settings' },
  ]},
];

export function DashboardShell({ user, projectName, primaryColor, logoDarkUrl, logoLightUrl, faviconUrl, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'GERADOR': false,
    'GERENCIAMENTO': false,
    'CONFIGURAÇÕES': false
  });

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    // Auto-open sections based on pathname
    const activeSection = SECTION_ITEMS.find(sec => 
      sec.items.some(item => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)))
    );
    if (activeSection) {
      setOpenSections(prev => ({ ...prev, [activeSection.label]: true }));
    }
  }, [pathname]);

  function toggleTheme() {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
  }

  function toggleSidebar() {
    if (window.innerWidth >= 768) {
      const next = !sidebarCollapsed;
      setSidebarCollapsed(next);
      localStorage.setItem('sidebar_collapsed', String(next));
    } else {
      setSidebarOpen(!sidebarOpen);
    }
  }

  function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/5 flex items-center justify-center">
          {sidebarCollapsed && faviconUrl ? (
            <img src={faviconUrl} alt={projectName} className="w-8 h-8 object-contain" />
          ) : logoDarkUrl ? (
            <div className="flex flex-col items-center">
              <img src={logoDarkUrl} alt={projectName} className="h-20 max-w-[200px] object-contain" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: primaryColor }}>
                <Gauge size={20} className="text-white" />
              </div>
              <h2 className="text-sm font-bold text-white sidebar-logo-text">{projectName}</h2>
              <p className="text-[10px] text-white/40 uppercase tracking-wider -mt-1 sidebar-logo-text">Admin Panel</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {/* Direct items - flat links */}
          {DIRECT_ITEMS.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon size={18} className="shrink-0" />
                <span className="sidebar-link-text">{item.label}</span>
              </Link>
            );
          })}

          {/* Collapsible sections */}
          {SECTION_ITEMS.map((section) => {
            const isOpen = openSections[section.label];
            const SectionIcon = section.icon;
            
            return (
              <div key={section.label}>
                {/* Section divider */}
                <div className={`my-2 ${sidebarCollapsed ? 'mx-2' : 'mx-1'} border-t border-white/10`} />

                {/* Section header - hidden when collapsed */}
                {!sidebarCollapsed && (
                  <button
                    onClick={() => setOpenSections(prev => ({ ...prev, [section.label]: !isOpen }))}
                    className="sidebar-label w-full flex items-center justify-between cursor-pointer hover:text-on-surface transition-colors focus:outline-none mb-1 group"
                  >
                    <div className="flex items-center gap-2 group-hover:text-primary transition-colors">
                      {SectionIcon && <SectionIcon size={14} className="shrink-0" />}
                      <span>{section.label}</span>
                    </div>
                    <ChevronDown size={14} className={`transition-transform duration-200 group-hover:text-primary ${isOpen ? '' : '-rotate-90'}`} />
                  </button>
                )}
                
                <div className={`overflow-hidden transition-all duration-300 flex flex-col gap-0.5 ${sidebarCollapsed ? 'max-h-[500px] opacity-100' : isOpen ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  {section.items.map((item) => {
                    const isActive = pathname === item.href ||
                      (item.href !== '/dashboard' && pathname.startsWith(item.href));

                    const linkElement = (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-link ${isActive ? 'active' : ''}`}
                        onClick={() => setSidebarOpen(false)}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <item.icon size={18} className="shrink-0" />
                        <span className="sidebar-link-text">{item.label}</span>
                      </Link>
                    );

                    if (item.resource) {
                      return (
                        <Can key={item.href} resource={item.resource} action="read">
                          {linkElement}
                        </Can>
                      );
                    }

                    return linkElement;
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Project footer */}
        <div className="px-4 py-3 border-t border-white/5">
          <p className="text-[10px] text-white/30 text-center uppercase tracking-wider sidebar-footer-text">{projectName}</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-[margin] duration-300 ${sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[280px]'}`}>
        {/* Header */}
        <header className={`sticky top-0 ${sidebarOpen ? 'z-50' : 'z-30'} h-[72px] bg-surface-container-lowest/80 backdrop-blur-lg border-b border-outline-variant/10 px-4 md:px-8 flex items-center justify-between`}>
          {/* Sidebar toggle */}
          <button
            className="btn-icon"
            onClick={toggleSidebar}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Theme toggle */}
            <button onClick={toggleTheme} className="btn-icon" title={isDark ? 'Modo claro' : 'Modo escuro'}>
              {mounted ? (isDark ? <Sun size={18} /> : <Moon size={18} />) : <div className="w-[18px] h-[18px]" />}
            </button>

            {/* Notifications */}
            <NotificationsBell />

            {/* Profile menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-container-low transition-colors"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: primaryColor }}>
                    {getInitials(user.name)}
                  </div>
                )}
                <ChevronDown size={14} className="text-on-surface-variant hidden sm:block" />
              </button>

              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-lg z-50 py-1.5">
                    <div className="px-3 py-2 border-b border-outline-variant/10">
                      <p className="text-sm font-medium text-on-surface">{user.name}</p>
                      <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
                    </div>
                    <Link href="/dashboard/profile" onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors">
                      <UserCircle size={16} />
                      Meu Perfil
                    </Link>
                    <form action="/api/auth/logout" method="POST">
                      <button type="submit"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error-container/50 transition-colors w-full">
                        <LogOut size={16} />
                        Sair
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 md:px-6 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
