import React, { useState } from 'react';
import { Menu, Moon, Sun, X, ArrowRight } from 'lucide-react';
import { OrbitaLogo } from './OrbitaLogo';
import { useLocationPath } from '../lib/router';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface PublicLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: 'Product', path: '/features' },
  { label: 'AI Agents', path: '/agents' },
  { label: 'Solutions', path: '/solutions' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'About', path: '/about' },
];

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  const { pathname, navigate } = useLocationPath();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const go = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC] text-[#111827] dark:bg-[#101827] dark:text-[#F8FAFC]">
      <header className="sticky top-0 z-40 h-16 bg-white/90 dark:bg-[#101827]/90 backdrop-blur-md border-b border-[#E6EAF0] dark:border-[#2B3950]">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6">
          {/* Zone 1: Brand */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              go('/');
            }}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4563FF] rounded-lg"
          >
            <OrbitaLogo size="md" />
          </a>

          {/* Zone 2: Center Navigation */}
          <nav className="hidden lg:flex items-center gap-7" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.path;
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => {
                    e.preventDefault();
                    go(item.path);
                  }}
                  className={`text-sm font-medium whitespace-nowrap shrink-0 transition-colors hover:text-[#4563FF] ${
                    active
                      ? 'text-[#4563FF]'
                      : 'text-[#667085] dark:text-[#A7B2C5]'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: Right Actions */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="w-10 h-10 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#182338] text-[#667085] dark:text-[#A7B2C5] hover:text-[#111827] dark:hover:text-[#F8FAFC] flex items-center justify-center transition-colors cursor-pointer"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {user ? (
              <button
                type="button"
                onClick={() => go('/app')}
                className="px-4 py-2.5 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Open Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => go('/login')}
                  className="px-3.5 py-2 rounded-xl text-sm font-semibold text-[#111827] dark:text-[#F8FAFC] hover:bg-[#E6EAF0]/60 dark:hover:bg-[#202D43] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => go('/signup')}
                  className="px-4 py-2.5 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  Get Started
                </button>
              </>
            )}
          </div>

          {/* Mobile Controls */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="min-w-[44px] min-h-[44px] rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#182338] text-[#667085] dark:text-[#A7B2C5] flex items-center justify-center"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="min-w-[44px] min-h-[44px] rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#182338] text-[#111827] dark:text-[#F8FAFC] flex items-center justify-center"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white dark:bg-[#182338] border-b border-[#E6EAF0] dark:border-[#2B3950] px-4 py-4 space-y-2 shadow-lg">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  go(item.path);
                }}
                className={`block px-3 py-3 rounded-xl text-base font-medium ${
                  pathname === item.path
                    ? 'bg-[#4563FF]/10 text-[#4563FF]'
                    : 'text-[#111827] dark:text-[#F8FAFC] hover:bg-[#F7F9FC] dark:hover:bg-[#202D43]'
                }`}
              >
                {item.label}
              </a>
            ))}
            <div className="pt-3 border-t border-[#E6EAF0] dark:border-[#2B3950] flex flex-col gap-2">
              {user ? (
                <button
                  type="button"
                  onClick={() => go('/app')}
                  className="w-full min-h-[44px] rounded-xl bg-[#4563FF] text-white text-sm font-semibold"
                >
                  Open Workspace
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => go('/login')}
                    className="w-full min-h-[44px] rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-sm font-semibold"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => go('/signup')}
                    className="w-full min-h-[44px] rounded-xl bg-[#4563FF] text-white text-sm font-semibold"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#182338]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <OrbitaLogo size="md" />
              <p className="text-sm text-[#667085] dark:text-[#A7B2C5] max-w-xs leading-relaxed">
                Your AI Workforce. One Command Center. Specialized AI assistants organized inside one unified business workspace.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3">Platform</h3>
              <ul className="space-y-2 text-sm text-[#667085] dark:text-[#A7B2C5]">
                <li>
                  <a href="/features" onClick={(e) => { e.preventDefault(); go('/features'); }} className="hover:text-[#4563FF]">
                    Product Features
                  </a>
                </li>
                <li>
                  <a href="/agents" onClick={(e) => { e.preventDefault(); go('/agents'); }} className="hover:text-[#4563FF]">
                    AI Agents
                  </a>
                </li>
                <li>
                  <a href="/solutions" onClick={(e) => { e.preventDefault(); go('/solutions'); }} className="hover:text-[#4563FF]">
                    Solutions
                  </a>
                </li>
                <li>
                  <a href="/pricing" onClick={(e) => { e.preventDefault(); go('/pricing'); }} className="hover:text-[#4563FF]">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3">Company</h3>
              <ul className="space-y-2 text-sm text-[#667085] dark:text-[#A7B2C5]">
                <li>
                  <a href="/about" onClick={(e) => { e.preventDefault(); go('/about'); }} className="hover:text-[#4563FF]">
                    About ORBITA AI
                  </a>
                </li>
                <li>
                  <a href="/contact" onClick={(e) => { e.preventDefault(); go('/contact'); }} className="hover:text-[#4563FF]">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="/login" onClick={(e) => { e.preventDefault(); go('/login'); }} className="hover:text-[#4563FF]">
                    Sign In
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3">Legal</h3>
              <ul className="space-y-2 text-sm text-[#667085] dark:text-[#A7B2C5]">
                <li>
                  <a href="/privacy" onClick={(e) => { e.preventDefault(); go('/privacy'); }} className="hover:text-[#4563FF]">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/terms" onClick={(e) => { e.preventDefault(); go('/terms'); }} className="hover:text-[#4563FF]">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-[#E6EAF0] dark:border-[#2B3950] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#667085] dark:text-[#A7B2C5]">
            <span>© {new Date().getFullYear()} ORBITA AI. All rights reserved.</span>
            <span>Authenticated AI workspace · Specialized multi-agent productivity</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
