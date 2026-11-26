import React, { useEffect, useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { OrbitaLogo } from '../components/OrbitaLogo';
import { useAuth } from '../context/AuthContext';
import { useLocationPath } from '../lib/router';

interface AuthPageProps {
  mode: 'login' | 'signup';
}

export const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const { user, signInWithEmail, signUpWithEmail, authError, clearAuthError } = useAuth();
  const { navigate } = useLocationPath();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/app', true);
    }
  }, [user, navigate]);

  const isLogin = mode === 'login';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    clearAuthError();
    try {
      const ok = isLogin
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);
      if (ok && user) {
        navigate('/app', true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-[#F7F9FC] dark:bg-[#101827]">
      <div className="w-full max-w-md">
        <div className="p-7 sm:p-8 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] shadow-sm">
          <div className="flex justify-center mb-6">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
            >
              <OrbitaLogo size="lg" />
            </a>
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC]">
              {isLogin ? 'Welcome back' : 'Create your ORBITA AI account'}
            </h1>
            <p className="mt-2 text-sm text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
              {isLogin
                ? 'Sign in with your email and password to access your AI workforce, saved outputs, and workspace history.'
                : 'Sign up with your email and password to launch your unified workspace with six specialized AI assistants.'}
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="mt-5 p-3.5 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 flex items-start gap-2.5 text-xs sm:text-sm text-[#F04438]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-1.5"
              >
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF]"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isLogin ? 'Enter your password' : 'Create a password (min. 6 characters)'}
                  className="w-full min-h-[44px] pl-3.5 pr-11 py-2.5 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-[#667085] dark:text-[#A7B2C5] hover:text-[#111827] dark:hover:text-[#F8FAFC] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-sm font-semibold flex items-center justify-center transition-colors disabled:opacity-60 cursor-pointer"
            >
              <span>
                {busy
                  ? isLogin
                    ? 'Signing in...'
                    : 'Creating account...'
                  : isLogin
                    ? 'Sign In'
                    : 'Create Account'}
              </span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#E6EAF0] dark:border-[#2B3950] text-center space-y-3">
            <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">
              {isLogin ? 'New to ORBITA AI? ' : 'Already have an account? '}
              <a
                href={isLogin ? '/signup' : '/login'}
                onClick={(e) => {
                  e.preventDefault();
                  clearAuthError();
                  navigate(isLogin ? '/signup' : '/login');
                }}
                className="font-semibold text-[#4563FF] hover:underline"
              >
                {isLogin ? 'Create an account' : 'Sign in'}
              </a>
            </p>
            <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">
              By continuing, you agree to our{' '}
              <a
                href="/terms"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/terms');
                }}
                className="underline hover:text-[#4563FF]"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href="/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/privacy');
                }}
                className="underline hover:text-[#4563FF]"
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
