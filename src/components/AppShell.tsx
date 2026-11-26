import React, { useState } from 'react';
import {
  BarChart3,
  Bell,
  BookmarkCheck,
  Bot,
  CreditCard,
  HelpCircle,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Settings,
  Shield,
  Sun,
  X,
} from 'lucide-react';
import { OrbitaLogo } from './OrbitaLogo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLocationPath } from '../lib/router';

interface AppShellProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export const AppShell: React.FC<AppShellProps> = ({ children, pageTitle }) => {
  const { user, logout, usageQuota } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { pathname, navigate } = useLocationPath();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!user) return null;

  const isAgentChat = pathname.startsWith('/app/agents/') && pathname !== '/app/agents';

  const primaryLinks = [
    { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
    { label: 'AI Agents', path: '/app/agents', icon: Bot },
    { label: 'My Conversations', path: '/app/conversations', icon: MessageSquare },
    { label: 'Saved Outputs', path: '/app/saved', icon: BookmarkCheck },
    { label: 'Prompt Library', path: '/app/prompts', icon: Library },
    { label: 'Usage', path: '/app/usage', icon: BarChart3 },
    { label: 'Billing', path: '/app/billing', icon: CreditCard },
    { label: 'Notifications', path: '/app/notifications', icon: Bell },
    { label: 'Settings', path: '/app/settings', icon: Settings },
    { label: 'Help', path: '/app/help', icon: HelpCircle },
  ];

  const go = (path: string) => {
    setDrawerOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    setDrawerOpen(false);
    await logout();
    navigate('/login');
  };

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-[#182338] border-r border-[#E6EAF0] dark:border-[#2B3950]">
      <div className="h-16 px-5 flex items-center justify-between border-b border-[#E6EAF0] dark:border-[#2B3950] shrink-0">
        <a
          href="/app"
          onClick={(e) => {
            e.preventDefault();
            go('/app');
          }}
          className="focus:outline-none"
        >
          <OrbitaLogo size="md" />
        </a>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-[#667085] dark:text-[#A7B2C5]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Workspace navigation">
        {primaryLinks.map((item) => {
          const Icon = item.icon;
          const active =
            item.path === '/app'
              ? pathname === '/app'
              : pathname === item.path || pathname.startsWith(`${item.path}/`);
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => go(item.path)}
              className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer ${
                active
                  ? 'bg-[#4563FF]/10 text-[#4563FF]'
                  : 'text-[#667085] dark:text-[#A7B2C5] hover:bg-[#F7F9FC] dark:hover:bg-[#202D43] hover:text-[#111827] dark:hover:text-[#F8FAFC]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        {user.role === 'admin' && (
          <div className="pt-3 mt-3 border-t border-[#E6EAF0] dark:border-[#2B3950]">
            <button
              type="button"
              onClick={() => go('/admin')}
              className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer ${
                pathname.startsWith('/admin')
                  ? 'bg-[#8B7CFF]/15 text-[#8B7CFF]'
                  : 'text-[#667085] dark:text-[#A7B2C5] hover:bg-[#F7F9FC] dark:hover:bg-[#202D43] hover:text-[#111827] dark:hover:text-[#F8FAFC]'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span className="truncate">Admin Console</span>
            </button>
          </div>
        )}
      </nav>

      {/* Usage & Profile Footer */}
      <div className="p-3 border-t border-[#E6EAF0] dark:border-[#2B3950] space-y-3 shrink-0">
        {usageQuota && (
          <div className="px-3 py-2.5 rounded-xl bg-[#F7F9FC] dark:bg-[#101827] border border-[#E6EAF0] dark:border-[#2B3950]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#667085] dark:text-[#A7B2C5]">Daily requests</span>
              <span className="font-mono font-semibold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                {usageQuota.today_requests}/{usageQuota.daily_limit}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-[#E6EAF0] dark:bg-[#2B3950] overflow-hidden">
              <div
                className="h-full bg-[#4563FF] rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.round((usageQuota.today_requests / Math.max(1, usageQuota.daily_limit)) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2.5 px-2 py-1">
          {user.profile_image ? (
            <img
              src={user.profile_image}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover border border-[#E6EAF0] dark:border-[#2B3950] shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#4563FF]/15 text-[#4563FF] text-xs font-bold flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">{user.name}</div>
            <div className="text-xs text-[#667085] dark:text-[#A7B2C5] truncate">
              {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} · {user.email}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex-1 min-h-[38px] px-3 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-xs font-medium text-[#667085] dark:text-[#A7B2C5] hover:text-[#111827] dark:hover:text-[#F8FAFC] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {resolvedTheme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{resolvedTheme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex-1 min-h-[38px] px-3 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-xs font-medium text-[#667085] dark:text-[#A7B2C5] hover:text-[#F04438] hover:border-[#F04438]/40 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );

  const mobileTabs = [
    { label: 'Home', path: '/app', icon: LayoutDashboard },
    { label: 'Agents', path: '/app/agents', icon: Bot },
    { label: 'Chats', path: '/app/conversations', icon: MessageSquare },
    { label: 'Saved', path: '/app/saved', icon: BookmarkCheck },
  ];

  return (
    <div className="min-h-screen flex bg-[#F7F9FC] dark:bg-[#101827] text-[#111827] dark:text-[#F8FAFC]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Mobile Sticky Top Header */}
        <header className="lg:hidden sticky top-0 z-30 h-14 px-3 bg-white/95 dark:bg-[#182338]/95 backdrop-blur-md border-b border-[#E6EAF0] dark:border-[#2B3950] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation drawer"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#111827] dark:text-[#F8FAFC]"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold truncate text-[#111827] dark:text-[#F8FAFC]">
            {pageTitle || 'ORBITA AI'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => go('/app/settings')}
              aria-label="Account settings"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              {user.profile_image ? (
                <img
                  src={user.profile_image}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-[#E6EAF0] dark:border-[#2B3950]"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#4563FF]/15 text-[#4563FF] text-xs font-bold flex items-center justify-center">
                  {initials}
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#667085] dark:text-[#A7B2C5] hover:text-[#F04438]"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className={`flex-1 min-w-0 ${!isAgentChat ? 'pb-20 lg:pb-8' : ''}`}>{children}</main>

        {/* Mobile Bottom Tab Bar (hidden inside active agent chat to preserve keyboard & composer space) */}
        {!isAgentChat && (
          <nav
            className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 pb-safe bg-white/95 dark:bg-[#182338]/95 backdrop-blur-md border-t border-[#E6EAF0] dark:border-[#2B3950] grid grid-cols-4"
            aria-label="Mobile workspace tabs"
          >
            {mobileTabs.map((tab) => {
              const Icon = tab.icon;
              const active =
                tab.path === '/app'
                  ? pathname === '/app'
                  : pathname === tab.path || pathname.startsWith(`${tab.path}/`);
              return (
                <button
                  key={tab.path}
                  type="button"
                  onClick={() => go(tab.path)}
                  className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                    active ? 'text-[#4563FF]' : 'text-[#667085] dark:text-[#A7B2C5]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
};
