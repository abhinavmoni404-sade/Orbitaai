import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../firebase';
import { apiFetch } from '../lib/api';
import type { User } from '../types/orbita';
import { useTheme } from './ThemeContext';

interface DailyUsageQuota {
  today_requests: number;
  daily_limit: number;
  remaining_today: number;
}

interface AuthContextValue {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  authError: string | null;
  usageQuota: DailyUsageQuota | null;
  clearAuthError: () => void;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setUserState: (u: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapFirebaseAuthError(err: unknown, mode: 'login' | 'signup'): string {
  const code = (err as { code?: string })?.code || '';

  if (mode === 'login') {
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-email'
    ) {
      return 'Email or password is incorrect';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many failed attempts. Please wait a moment and try again.';
    }
    if (code === 'auth/user-disabled') {
      return 'This account has been disabled.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Email/password sign-in is not enabled in Firebase Authentication yet.';
    }
  } else {
    if (code === 'auth/email-already-in-use') {
      return 'User already exists. Please sign in';
    }
    if (code === 'auth/weak-password') {
      return 'Password must be at least 6 characters.';
    }
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Email/password sign-up is not enabled in Firebase Authentication yet.';
    }
  }

  if (err instanceof Error && err.message) return err.message;
  return mode === 'login' ? 'Email or password is incorrect' : 'Unable to create account.';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [usageQuota, setUsageQuota] = useState<DailyUsageQuota | null>(null);
  const { setThemePreference } = useTheme();

  const refreshSession = useCallback(async () => {
    if (!auth.currentUser) {
      setUser(null);
      setUsageQuota(null);
      return;
    }
    try {
      const data = await apiFetch<{ user: User; usage: DailyUsageQuota }>('/api/auth/me');
      setUser(data.user);
      setUsageQuota(data.usage);
      if (data.user.theme_preference) {
        setThemePreference(data.user.theme_preference);
      }
    } catch (err) {
      setUser(null);
      setUsageQuota(null);
      setAuthError(err instanceof Error ? err.message : 'Unable to load workspace session.');
    }
  }, [setThemePreference]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setUsageQuota(null);
        setLoading(false);
        return;
      }

      try {
        const data = await apiFetch<{ user: User; usage: DailyUsageQuota }>('/api/auth/me');
        setUser(data.user);
        setUsageQuota(data.usage);
        if (data.user.theme_preference) {
          setThemePreference(data.user.theme_preference);
        }
      } catch (err) {
        setUser(null);
        setUsageQuota(null);
        setAuthError(err instanceof Error ? err.message : 'Authentication check failed.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setThemePreference]);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return true;
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, 'login'));
      return false;
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      return true;
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, 'signup'));
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    } finally {
      setUser(null);
      setFirebaseUser(null);
      setUsageQuota(null);
    }
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const setUserState = useCallback((u: User) => {
    setUser(u);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        authError,
        usageQuota,
        clearAuthError,
        signInWithEmail,
        signUpWithEmail,
        logout,
        refreshSession,
        setUserState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
