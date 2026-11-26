import React, { useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useLocationPath } from './lib/router';
import { OrbitaLogo } from './components/OrbitaLogo';
import { PublicLayout } from './components/PublicLayout';
import { LandingPage } from './pages/LandingPage';
import {
  AboutPage,
  ContactPage,
  FeaturesPage,
  PricingPage,
  PrivacyPolicyPage,
  PublicAgentsPage,
  SolutionsPage,
  TermsPage,
} from './pages/PublicPages';
import { AuthPage } from './pages/AuthPages';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { AgentsMarketplacePage } from './pages/AgentsMarketplacePage';
import { AgentWorkspacePage } from './pages/AgentWorkspacePage';
import { ConversationsPage } from './pages/ConversationsPage';
import { SavedOutputsPage } from './pages/SavedOutputsPage';
import { PromptLibraryPage } from './pages/PromptLibraryPage';
import { UsagePage } from './pages/UsagePage';
import { BillingPage } from './pages/BillingPage';
import { HelpPage, NotificationsPage, SettingsPage } from './pages/AccountPages';
import { AdminPage } from './pages/AdminPage';

const BrandedLoadingScreen: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F9FC] dark:bg-[#101827] px-4">
    <OrbitaLogo size="lg" />
    <p className="mt-4 text-sm text-[#667085] dark:text-[#A7B2C5]">Loading your command center...</p>
  </div>
);

const ProtectedRedirect: React.FC = () => {
  const { navigate } = useLocationPath();
  useEffect(() => {
    navigate('/login', true);
  }, [navigate]);
  return <BrandedLoadingScreen />;
};

const AppRoutes: React.FC = () => {
  const { pathname, navigate } = useLocationPath();
  const { user, loading } = useAuth();

  // Protected App & Admin routes
  const isProtected = pathname === '/app' || pathname.startsWith('/app/') || pathname.startsWith('/admin');

  if (isProtected) {
    if (loading) return <BrandedLoadingScreen />;
    if (!user) return <ProtectedRedirect />;

    if (pathname.startsWith('/admin')) {
      return (
        <AppShell pageTitle="Admin Console">
          <AdminPage />
        </AppShell>
      );
    }

    if (pathname === '/app' || pathname === '/app/') {
      return (
        <AppShell pageTitle="Dashboard">
          <DashboardPage />
        </AppShell>
      );
    }

    if (pathname === '/app/agents') {
      return (
        <AppShell pageTitle="AI Agents">
          <AgentsMarketplacePage />
        </AppShell>
      );
    }

    if (pathname.startsWith('/app/agents/')) {
      const slug = pathname.replace('/app/agents/', '').split('/')[0];
      return (
        <AppShell pageTitle="Agent Workspace">
          <AgentWorkspacePage slug={slug} />
        </AppShell>
      );
    }

    if (pathname === '/app/conversations') {
      return (
        <AppShell pageTitle="My Conversations">
          <ConversationsPage />
        </AppShell>
      );
    }

    if (pathname === '/app/saved') {
      return (
        <AppShell pageTitle="Saved Outputs">
          <SavedOutputsPage />
        </AppShell>
      );
    }

    if (pathname === '/app/prompts') {
      return (
        <AppShell pageTitle="Prompt Library">
          <PromptLibraryPage />
        </AppShell>
      );
    }

    if (pathname === '/app/usage') {
      return (
        <AppShell pageTitle="Usage Analytics">
          <UsagePage />
        </AppShell>
      );
    }

    if (pathname === '/app/billing') {
      return (
        <AppShell pageTitle="Billing & Subscription">
          <BillingPage />
        </AppShell>
      );
    }

    if (pathname === '/app/notifications') {
      return (
        <AppShell pageTitle="Notifications">
          <NotificationsPage />
        </AppShell>
      );
    }

    if (pathname === '/app/settings') {
      return (
        <AppShell pageTitle="Account Settings">
          <SettingsPage />
        </AppShell>
      );
    }

    if (pathname === '/app/help') {
      return (
        <AppShell pageTitle="Help Centre">
          <HelpPage />
        </AppShell>
      );
    }

    return (
      <AppShell pageTitle="Dashboard">
        <DashboardPage />
      </AppShell>
    );
  }

  // Public Pages
  if (pathname === '/login') {
    return (
      <PublicLayout>
        <AuthPage mode="login" />
      </PublicLayout>
    );
  }

  if (pathname === '/signup') {
    return (
      <PublicLayout>
        <AuthPage mode="signup" />
      </PublicLayout>
    );
  }

  if (pathname === '/features') {
    return (
      <PublicLayout>
        <FeaturesPage />
      </PublicLayout>
    );
  }

  if (pathname === '/agents') {
    return (
      <PublicLayout>
        <PublicAgentsPage />
      </PublicLayout>
    );
  }

  if (pathname === '/solutions') {
    return (
      <PublicLayout>
        <SolutionsPage />
      </PublicLayout>
    );
  }

  if (pathname === '/pricing') {
    return (
      <PublicLayout>
        <PricingPage />
      </PublicLayout>
    );
  }

  if (pathname === '/about') {
    return (
      <PublicLayout>
        <AboutPage />
      </PublicLayout>
    );
  }

  if (pathname === '/contact') {
    return (
      <PublicLayout>
        <ContactPage />
      </PublicLayout>
    );
  }

  if (pathname === '/privacy') {
    return (
      <PublicLayout>
        <PrivacyPolicyPage />
      </PublicLayout>
    );
  }

  if (pathname === '/terms') {
    return (
      <PublicLayout>
        <TermsPage />
      </PublicLayout>
    );
  }

  if (pathname === '/') {
    return (
      <PublicLayout>
        <LandingPage />
      </PublicLayout>
    );
  }

  // 404 Fallback
  return (
    <PublicLayout>
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#F8FAFC]">Page not found</h1>
        <p className="text-sm text-[#667085] dark:text-[#A7B2C5]">
          The page you requested does not exist on ORBITA AI.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-xl bg-[#4563FF] text-white text-sm font-semibold cursor-pointer"
        >
          Return Home
        </button>
      </div>
    </PublicLayout>
  );
};

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC] dark:bg-[#101827] p-4">
          <div className="max-w-md w-full p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] text-center space-y-3">
            <OrbitaLogo size="md" className="mx-auto" />
            <h1 className="text-lg font-bold text-[#111827] dark:text-[#F8FAFC]">Something went wrong</h1>
            <p className="text-sm text-[#667085] dark:text-[#A7B2C5]">
              Please reload the page to restore your ORBITA AI workspace.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-[#4563FF] text-white text-sm font-semibold cursor-pointer"
            >
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
