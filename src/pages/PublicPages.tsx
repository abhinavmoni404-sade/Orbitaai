import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { calculateAnnualSavings, formatPriceFromPaise, INITIAL_FALLBACK_PLANS } from '../lib/currency';
import { useLocationPath } from '../lib/router';
import { useAuth } from '../context/AuthContext';
import { AgentIcon } from '../components/AgentIcon';
import type { Agent, BillingCycle, SubscriptionPlan } from '../types/orbita';

type PublicAgent = Omit<Agent, 'system_instruction' | 'is_active' | 'created_at'>;

export const FeaturesPage: React.FC = () => {
  const { navigate } = useLocationPath();
  const { user } = useAuth();
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-[#4563FF] mb-2">Product Architecture</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC]">
          Everything required to run an organized AI workforce.
        </h1>
        <p className="mt-4 text-base text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
          ORBITA AI pairs six specialized assistant workspaces with persistent conversation storage, reusable prompt templates, saved outputs, and transparent usage analytics.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            title: '01. Specialized Agent Workspaces',
            body: 'Each assistant opens in its own dedicated workspace with tailored system instructions, domain-appropriate guardrails, and suggested starting prompts.',
          },
          {
            title: '02. Multi-Turn Streaming & Context',
            body: 'Conversations preserve prior messages on the server so follow-up refinements stay accurate. Responses stream in real time and can be regenerated or copied in one click.',
          },
          {
            title: '03. Saved Outputs Repository',
            body: 'Bookmark any assistant response with a custom title, search across saved work, filter by agent, and jump straight back to the originating conversation.',
          },
          {
            title: '04. Curated & Personal Prompt Library',
            body: 'Start quickly from platform-provided business templates or author and manage your own custom prompts across seven operational categories.',
          },
          {
            title: '05. Usage Analytics & Daily Quotas',
            body: 'Track real request volume by agent and daily allowance consumption directly from stored usage records—with zero fabricated vanity numbers.',
          },
          {
            title: '06. Firebase Authentication & Admin Controls',
            body: 'Sign in with email and password via Firebase Authentication, with strict per-user data isolation and role-gated administration tools.',
          },
        ].map((item) => (
          <div
            key={item.title}
            className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950]"
          >
            <h2 className="text-lg font-bold text-[#111827] dark:text-[#F8FAFC]">{item.title}</h2>
            <p className="mt-2.5 text-sm text-[#667085] dark:text-[#A7B2C5] leading-relaxed">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-12">
        <button
          type="button"
          onClick={() => navigate(user ? '/app' : '/signup')}
          className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <span>{user ? 'Go to Dashboard' : 'Get Started Free'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const PublicAgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<PublicAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const { navigate } = useLocationPath();
  const { user } = useAuth();

  useEffect(() => {
    apiFetch<{ agents: PublicAgent[] }>('/api/public/agents')
      .then((res) => setAgents(res.agents))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-[#4563FF] mb-2">Specialized AI Workforce</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC]">
          Meet all six ORBITA AI agents.
        </h1>
        <p className="mt-4 text-base text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
          Each assistant is configured with dedicated instructions, transparent constraints, and task-specific capabilities.
        </p>
      </div>

      {loading ? (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-60 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3.5">
                  <AgentIcon icon={agent.icon} accentColor={agent.accent_color} size="lg" />
                  <div>
                    <h2 className="text-lg font-bold text-[#111827] dark:text-[#F8FAFC]">{agent.name}</h2>
                    <p className="text-sm text-[#667085] dark:text-[#A7B2C5]">{agent.tagline}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-[#111827] dark:text-[#E2E8F0] leading-relaxed">
                  {agent.description}
                </p>
                <div className="mt-5">
                  <div className="text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-2">Capabilities</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {agent.capabilities.map((cap) => (
                      <div key={cap} className="flex items-center gap-2 text-xs text-[#111827] dark:text-[#E2E8F0]">
                        <Check className="w-3.5 h-3.5 text-[#12B76A] shrink-0" />
                        <span>{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[#E6EAF0] dark:border-[#2B3950] flex items-center justify-between gap-3">
                <span className="text-xs text-[#667085] dark:text-[#A7B2C5]">{agent.category}</span>
                <button
                  type="button"
                  onClick={() => navigate(user ? `/app/agents/${agent.slug}` : '/signup')}
                  className="px-4 py-2 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Open Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SolutionsPage: React.FC = () => {
  const { navigate } = useLocationPath();
  const solutions = [
    {
      role: 'Founders & Solo Operators',
      summary: 'Move seamlessly between investor research, customer outreach, monthly budgeting, and standard operating checklists without switching tools.',
      agents: ['ORBITA RESEARCH', 'ORBITA FINANCE', 'ORBITA OPERATIONS'],
    },
    {
      role: 'Sales & Business Development',
      summary: 'Build personalized cold outreach sequences, crisp proposals, objection responses, and discovery call prep inside a single persistent thread history.',
      agents: ['ORBITA SALES', 'ORBITA RESEARCH'],
    },
    {
      role: 'Marketing & Growth Teams',
      summary: 'Turn product positioning into 30-day multi-channel calendars, ad concepts, and SEO drafts stored neatly in your Saved Outputs library.',
      agents: ['ORBITA MARKETING', 'ORBITA RESEARCH'],
    },
    {
      role: 'Customer Support & Operations',
      summary: 'Create calm complaint responses, help-center FAQs, ticket summaries, and repeatable internal SOPs in minutes.',
      agents: ['ORBITA SUPPORT', 'ORBITA OPERATIONS'],
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-[#4563FF] mb-2">Business Solutions</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC]">
          Tailored workflows for every business function.
        </h1>
        <p className="mt-4 text-base text-[#667085] dark:text-[#A7B2C5]">
          See how individuals, startups, and growing teams combine ORBITA AI agents to organize daily work.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        {solutions.map((s) => (
          <div
            key={s.role}
            className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950]"
          >
            <h2 className="text-lg font-bold text-[#111827] dark:text-[#F8FAFC]">{s.role}</h2>
            <p className="mt-2.5 text-sm text-[#667085] dark:text-[#A7B2C5] leading-relaxed">{s.summary}</p>
            <div className="mt-4 pt-4 border-t border-[#E6EAF0] dark:border-[#2B3950] text-xs font-medium text-[#4563FF]">
              Recommended agents: {s.agents.join(' · ')}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12">
        <button
          type="button"
          onClick={() => navigate('/signup')}
          className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <span>Create Your Workspace</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const PricingPage: React.FC = () => {
  const { navigate } = useLocationPath();
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>(INITIAL_FALLBACK_PLANS);
  const [annualConfigured, setAnnualConfigured] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [paymentEnv, setPaymentEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [cashfreeConfigured, setCashfreeConfigured] = useState(false);

  useEffect(() => {
    apiFetch<{
      plans: SubscriptionPlan[];
      annual_billing_configured: boolean;
      payment_gateway?: { environment: 'sandbox' | 'production'; cashfree_configured: boolean };
    }>('/api/public/plans')
      .then((res) => {
        if (res.plans?.length) setPlans(res.plans);
        setAnnualConfigured(Boolean(res.annual_billing_configured));
        if (res.payment_gateway) {
          setPaymentEnv(res.payment_gateway.environment);
          setCashfreeConfigured(res.payment_gateway.cashfree_configured);
        }
      })
      .catch(() => {
        // Keep initial fallback catalog
      });
  }, []);

  const paidPlans = plans.filter((p) => p.id !== 'free');
  const freePlan = plans.find((p) => p.id === 'free');
  const currentRank = user ? ['free', 'starter', 'pro', 'business'].indexOf(user.plan) : -1;

  const handlePlanCta = (planId: string) => {
    if (user) {
      navigate('/app/billing');
    } else if (planId === 'free') {
      navigate('/signup');
    } else {
      navigate('/signup');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-[#4563FF] mb-2">ORBITA AI Pricing</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC] [text-wrap:balance]">
            Simple, transparent INR pricing for your AI workforce.
          </h1>
          <p className="mt-4 text-base text-[#667085] dark:text-[#A7B2C5]">
            Choose the credit allowance that matches your daily workflow. Every tier includes access to all six specialized ORBITA AI agents.
          </p>
        </div>

        {annualConfigured && (
          <div className="inline-flex items-center p-1 rounded-xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] shrink-0 self-start">
            {(['monthly', 'annual'] as BillingCycle[]).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                  billingCycle === cycle
                    ? 'bg-[#4563FF] text-white'
                    : 'text-[#667085] dark:text-[#A7B2C5]'
                }`}
              >
                {cycle}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Three Premium Paid Subscription Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {paidPlans.map((tier) => {
          const showAnnual =
            billingCycle === 'annual' && tier.annual_price_paise !== null && tier.annual_price_paise > 0;
          const displayPaise = showAnnual ? tier.annual_price_paise! : tier.monthly_price_paise;
          const savings = calculateAnnualSavings(tier.monthly_price_paise, tier.annual_price_paise);
          const tierRank = ['free', 'starter', 'pro', 'business'].indexOf(tier.id);
          const isCurrent = user?.plan === tier.id;
          const isDowngrade = user ? tierRank < currentRank : false;
          const accent =
            tier.id === 'starter' ? '#20C9B7' : tier.id === 'pro' ? '#4563FF' : '#8B7CFF';

          return (
            <div
              key={tier.id}
              className={`p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#182338] border flex flex-col justify-between ${
                tier.id === 'pro'
                  ? 'border-[#4563FF] shadow-sm'
                  : 'border-[#E6EAF0] dark:border-[#2B3950]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xl font-bold uppercase tracking-tight text-[#111827] dark:text-[#F8FAFC]">
                    {tier.name}
                  </h2>
                  <span className="text-xs font-semibold" style={{ color: accent }}>
                    {tier.id === 'pro' ? 'Recommended' : `${tier.included_agents_count} AI Agents`}
                  </span>
                </div>
                <p className="mt-1.5 text-xs sm:text-sm text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
                  {tier.tagline}
                </p>

                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="font-mono text-3xl sm:text-4xl font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                    {formatPriceFromPaise(displayPaise, tier.currency)}
                  </span>
                  <span className="text-sm text-[#667085] dark:text-[#A7B2C5]">
                    /{showAnnual ? 'year' : 'month'}
                  </span>
                </div>

                {showAnnual && savings && (
                  <div className="mt-1.5 text-xs font-semibold text-[#12B76A]">
                    Save {formatPriceFromPaise(savings.savingsPaise, tier.currency)} ({savings.savingsPercent}%) annually
                  </div>
                )}

                <div className="mt-5 py-3 border-y border-[#E6EAF0] dark:border-[#2B3950] flex items-center justify-between text-xs">
                  <span className="text-[#667085] dark:text-[#A7B2C5]">Included credits</span>
                  <span className="font-mono font-semibold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                    {tier.monthly_credits.toLocaleString()} / month
                  </span>
                </div>

                <ul className="mt-5 space-y-2.5 text-sm text-[#111827] dark:text-[#E2E8F0]">
                  {tier.features.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#12B76A] shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                {tier.limitations.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-[#E6EAF0] dark:border-[#2B3950] space-y-1 text-xs text-[#667085] dark:text-[#A7B2C5]">
                    <div className="font-semibold text-[#111827] dark:text-[#E2E8F0] mb-1">Plan limits</div>
                    {tier.limitations.map((lim) => (
                      <div key={lim}>· {lim}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-8 space-y-2.5">
                <button
                  type="button"
                  onClick={() => handlePlanCta(tier.id)}
                  className={`w-full min-h-[46px] px-4 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    tier.id === 'pro'
                      ? 'bg-[#4563FF] hover:bg-[#3652E6] text-white'
                      : 'bg-[#F7F9FC] dark:bg-[#202D43] hover:bg-[#4563FF] hover:text-white text-[#111827] dark:text-[#F8FAFC]'
                  }`}
                >
                  <span>
                    {isCurrent
                      ? 'Manage Current Plan'
                      : isDowngrade
                        ? `Downgrade to ${tier.name}`
                        : `Choose ${tier.name}`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-[11px] text-center text-[#667085] dark:text-[#A7B2C5]">
                  Recurring {showAnnual ? 'annual' : 'monthly'} billing in {tier.currency} · Cancel anytime
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Free Plan Available Separately */}
      {freePlan && (
        <div className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-xl font-bold text-[#111827] dark:text-[#F8FAFC]">{freePlan.name}</h2>
              <span className="font-mono text-2xl font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                {formatPriceFromPaise(freePlan.monthly_price_paise, freePlan.currency)}
              </span>
              <span className="text-xs text-[#667085] dark:text-[#A7B2C5]">
                · {freePlan.monthly_credits.toLocaleString()} credits/month · {freePlan.included_agents_count} AI agents
              </span>
            </div>
            <p className="text-sm text-[#667085] dark:text-[#A7B2C5]">{freePlan.tagline}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#667085] dark:text-[#A7B2C5]">
              {freePlan.features.map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#12B76A]" />
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => handlePlanCta('free')}
              className="min-h-[44px] px-6 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] hover:border-[#4563FF] text-sm font-semibold text-[#111827] dark:text-[#F8FAFC] cursor-pointer"
            >
              {user ? (user.plan === 'free' ? 'Current Free Plan' : 'Downgrade to Free') : 'Start Free'}
            </button>
          </div>
        </div>
      )}

      {/* Honest Gateway & Recurring Billing Notice */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] text-xs text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
        Recurring subscriptions are billed in INR through Cashfree hosted checkout (current environment:{' '}
        <span className="font-semibold uppercase text-[#111827] dark:text-[#F8FAFC]">{paymentEnv}</span>
        {!cashfreeConfigured ? ' — live payment processing remains disabled until merchant verification and gateway credentials are completed' : ''}).
        Existing subscribers retain their agreed billing rate unless they change plans.
      </div>
    </div>
  );
};

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 space-y-8">
      <div>
        <p className="text-sm font-medium text-[#4563FF] mb-2">About ORBITA AI</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC]">
          Your AI Workforce. One Command Center.
        </h1>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-5 text-base text-[#111827] dark:text-[#E2E8F0] leading-relaxed">
        <p>
          ORBITA AI was designed around a straightforward premise: businesses and independent professionals should not have to treat advanced AI like an unorganized scratchpad.
        </p>
        <p>
          Instead of a single generic chat box, ORBITA AI structures specialized assistants for sales, marketing, research, finance, customer support, and operations inside one unified workspace—backed by persistent conversations, reusable prompt templates, and saved outputs.
        </p>
        <div className="pt-4 border-t border-[#E6EAF0] dark:border-[#2B3950] grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div>
            <h2 className="font-semibold text-[#111827] dark:text-[#F8FAFC] mb-1">Our Vision</h2>
            <p className="text-[#667085] dark:text-[#A7B2C5]">
              Build a unified AI operating environment where specialized agents help teams execute work reliably across core business functions.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-[#111827] dark:text-[#F8FAFC] mb-1">Our Commitment to Clarity</h2>
            <p className="text-[#667085] dark:text-[#A7B2C5]">
              No fabricated metrics, no inflated claims, and explicit distinction between verified facts, estimates, and drafts across research and finance tasks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/public/contact', {
        method: 'POST',
        body: JSON.stringify({ name, email, company, message }),
      });
      setSent(true);
      setName('');
      setEmail('');
      setCompany('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
      <div className="mb-8">
        <p className="text-sm font-medium text-[#4563FF] mb-2">Contact</p>
        <h1 className="text-3xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC]">
          Get in touch with ORBITA AI
        </h1>
        <p className="mt-2 text-base text-[#667085] dark:text-[#A7B2C5]">
          Questions about team plans, feedback, or workspace onboarding? Send us a message below.
        </p>
      </div>

      {sent ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-[#182338] border border-[#12B76A]/40 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-[#12B76A] mx-auto" />
          <h2 className="text-lg font-bold text-[#111827] dark:text-[#F8FAFC]">Inquiry received</h2>
          <p className="text-sm text-[#667085] dark:text-[#A7B2C5]">
            Thank you for contacting ORBITA AI. Your message has been stored for our team to review.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-2 px-5 py-2.5 rounded-xl bg-[#4563FF] text-white text-sm font-semibold cursor-pointer"
          >
            Send another message
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-5"
        >
          {error && (
            <div className="p-3.5 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 text-sm text-[#F04438]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium text-[#111827] dark:text-[#F8FAFC] mb-1.5">
                Full Name
              </label>
              <input
                id="contact-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF]"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium text-[#111827] dark:text-[#F8FAFC] mb-1.5">
                Work Email
              </label>
              <input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@company.com"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="contact-company" className="block text-sm font-medium text-[#111827] dark:text-[#F8FAFC] mb-1.5">
              Company or Team (Optional)
            </label>
            <input
              id="contact-company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Northstar Studio"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF]"
            />
          </div>

          <div>
            <label htmlFor="contact-message" className="block text-sm font-medium text-[#111827] dark:text-[#F8FAFC] mb-1.5">
              How can we help?
            </label>
            <textarea
              id="contact-message"
              rows={4}
              required
              minLength={10}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us about your team or question..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            <span>{submitting ? 'Sending...' : 'Send Message'}</span>
          </button>
        </form>
      )}
    </div>
  );
};

export const PrivacyPolicyPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 space-y-6">
    <div className="flex items-center gap-2.5 text-sm font-medium text-[#4563FF]">
      <ShieldCheck className="w-4 h-4" />
      <span>Legal & Privacy</span>
    </div>
    <h1 className="text-3xl font-bold text-[#111827] dark:text-[#F8FAFC]">Privacy Policy</h1>
    <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4 text-sm text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
      <p>
        <strong className="text-[#111827] dark:text-[#F8FAFC]">1. Account Information:</strong> ORBITA AI uses Firebase Authentication for email and password sign-in and stores only the account identifier and email address needed to operate your workspace.
      </p>
      <p>
        <strong className="text-[#111827] dark:text-[#F8FAFC]">2. Workspace Data Isolation:</strong> Your conversations, messages, saved outputs, custom prompt templates, and usage records are isolated to your account and protected by server-side ownership checks.
      </p>
      <p>
        <strong className="text-[#111827] dark:text-[#F8FAFC]">3. AI Processing:</strong> Prompts you send to ORBITA AI agents are transmitted securely from our server to our configured AI provider solely to generate your requested responses.
      </p>
      <p>
        <strong className="text-[#111827] dark:text-[#F8FAFC]">4. Data Deletion:</strong> You can delete individual conversations, saved outputs, custom prompts, or your entire ORBITA AI account directly from Account Settings at any time.
      </p>
    </div>
  </div>
);

export const TermsPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 space-y-6">
    <p className="text-sm font-medium text-[#4563FF]">Legal</p>
    <h1 className="text-3xl font-bold text-[#111827] dark:text-[#F8FAFC]">Terms of Service</h1>
    <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4 text-sm text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
      <p>
        <strong className="text-[#111827] dark:text-[#F8FAFC]">1. Acceptable Use:</strong> You are responsible for reviewing AI-generated drafts before publishing, sending to customers, or making business or financial decisions.
      </p>
      <p>
        <strong className="text-[#111827] dark:text-[#F8FAFC]">2. Research & Financial Outputs:</strong> ORBITA RESEARCH and ORBITA FINANCE provide structured organizational assistance and planning estimates—not audited financial records, regulated financial advice, or legal counsel.
      </p>
      <p>
        <strong className="text-[#111827] dark:text-[#F8FAFC]">3. Usage Limits:</strong> Daily request allowances apply according to your assigned workspace plan to maintain platform reliability.
      </p>
    </div>
  </div>
);
