import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookmarkCheck,
  Check,
  FolderKanban,
  Layers,
  Library,
  Lock,
  MessageSquareText,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatPriceFromPaise, INITIAL_FALLBACK_PLANS } from '../lib/currency';
import { useLocationPath } from '../lib/router';
import { useAuth } from '../context/AuthContext';
import { AgentIcon } from '../components/AgentIcon';
import type { Agent, SubscriptionPlan } from '../types/orbita';

type PublicAgent = Omit<Agent, 'system_instruction' | 'is_active' | 'created_at'>;

const FALLBACK_PUBLIC_AGENTS: PublicAgent[] = [
  {
    id: 'agent-orbita-sales',
    name: 'ORBITA SALES',
    slug: 'orbita-sales',
    tagline: 'Revenue outreach, proposals, and deal communication',
    description: 'Drafts personalized sales emails, multi-step follow-up sequences, proposals, pitch scripts, and objection responses.',
    icon: 'BriefcaseBusiness',
    category: 'Revenue & Growth',
    accent_color: '#4563FF',
    capabilities: ['Sales email writing', 'Follow-up sequences', 'Sales proposals', 'Objection handling'],
    suggested_prompts: ['Write a professional sales email.', 'Create a follow-up sequence.'],
  },
  {
    id: 'agent-orbita-marketing',
    name: 'ORBITA MARKETING',
    slug: 'orbita-marketing',
    tagline: 'Brand positioning, campaigns, and content engines',
    description: 'Builds marketing strategies, 30-day content calendars, ad copy, SEO briefs, and audience positioning.',
    icon: 'Megaphone',
    category: 'Brand & Demand',
    accent_color: '#8B7CFF',
    capabilities: ['Marketing strategies', '30-day content calendars', 'Advertising copy', 'SEO content drafts'],
    suggested_prompts: ['Create a 30-day content calendar.', 'Develop a marketing strategy.'],
  },
  {
    id: 'agent-orbita-research',
    name: 'ORBITA RESEARCH',
    slug: 'orbita-research',
    tagline: 'Structured market intelligence and strategic analysis',
    description: 'Prepares SWOT analyses, competitor frameworks, business model comparisons, and clearly labeled fact-vs-assumption briefs.',
    icon: 'SearchCheck',
    category: 'Strategy & Intel',
    accent_color: '#20C9B7',
    capabilities: ['Market research', 'Competitor analysis', 'SWOT analysis', 'Business model analysis'],
    suggested_prompts: ['Analyze this business idea.', 'Create a SWOT analysis.'],
  },
  {
    id: 'agent-orbita-finance',
    name: 'ORBITA FINANCE',
    slug: 'orbita-finance',
    tagline: 'Budgets, cash-flow organization, and margin clarity',
    description: 'Organizes monthly budgets, expense summaries, cash-flow reports, and transparent profit margin calculations.',
    icon: 'Calculator',
    category: 'Finance & Planning',
    accent_color: '#12B76A',
    capabilities: ['Budget planning', 'Expense categorization', 'Cash-flow summaries', 'Profit margin math'],
    suggested_prompts: ['Create a monthly business budget.', 'Calculate my business profit margin.'],
  },
  {
    id: 'agent-orbita-support',
    name: 'ORBITA SUPPORT',
    slug: 'orbita-support',
    tagline: 'Empathetic customer responses, FAQs, and knowledge bases',
    description: 'Drafts calm complaint resolutions, FAQ pages, ticket handoff summaries, and self-service knowledge articles.',
    icon: 'Headset',
    category: 'Customer Experience',
    accent_color: '#F79009',
    capabilities: ['Customer support replies', 'FAQ creation', 'Complaint de-escalation', 'Knowledge-base articles'],
    suggested_prompts: ['Reply to this customer complaint.', 'Create an FAQ for my business.'],
  },
  {
    id: 'agent-orbita-operations',
    name: 'ORBITA OPERATIONS',
    slug: 'orbita-operations',
    tagline: 'SOPs, execution plans, checklists, and workflows',
    description: 'Generates executable SOPs, project execution plans, action-oriented meeting summaries, and workflow checklists.',
    icon: 'Workflow',
    category: 'Operations & Execution',
    accent_color: '#0EA5E9',
    capabilities: ['SOP creation', 'Workflow planning', 'Meeting summaries', 'Project plans'],
    suggested_prompts: ['Create an SOP for my business.', 'Build a project execution plan.'],
  },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Create an account', desc: 'Sign up securely with your email and password.' },
  { step: '02', title: 'Choose an AI agent', desc: 'Select Sales, Marketing, Research, Finance, Support, or Operations.' },
  { step: '03', title: 'Describe your task', desc: 'Enter your objective or start from a curated prompt template.' },
  { step: '04', title: 'Receive and refine the result', desc: 'Stream structured multi-turn responses and iterate in context.' },
  { step: '05', title: 'Save and reuse your work', desc: 'Bookmark high-value outputs and build your personal prompt library.' },
];

export const LandingPage: React.FC = () => {
  const { navigate } = useLocationPath();
  const { user } = useAuth();
  const [agents, setAgents] = useState<PublicAgent[]>(FALLBACK_PUBLIC_AGENTS);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(INITIAL_FALLBACK_PLANS);
  const [previewSlug, setPreviewSlug] = useState<string>('orbita-sales');

  useEffect(() => {
    apiFetch<{ agents: PublicAgent[] }>('/api/public/agents')
      .then((res) => {
        if (res.agents?.length) {
          setAgents(res.agents);
        }
      })
      .catch(() => {
        // Keep fallback metadata
      });
    apiFetch<{ plans: SubscriptionPlan[] }>('/api/public/plans')
      .then((res) => {
        if (res.plans?.length) {
          setPlans(res.plans);
        }
      })
      .catch(() => {
        // Keep initial fallback plans
      });
  }, []);

  const activePreviewAgent = agents.find((a) => a.slug === previewSlug) || agents[0];

  const handleGetStarted = () => {
    navigate(user ? '/app' : '/signup');
  };

  const handleOpenAgent = (slug: string) => {
    navigate(user ? `/app/agents/${slug}` : '/signup');
  };

  return (
    <div>
      {/* HERO SECTION */}
      <section className="relative overflow-hidden border-b border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#101827]">
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-80 opacity-30 dark:opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(69,99,255,0.28), rgba(32,201,183,0.16), rgba(139,124,255,0.12), transparent 70%)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 lg:pt-20 lg:pb-24">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm font-medium text-[#4563FF] mb-3">
              AI Workforce Platform · Six Specialized Assistants
            </p>
            <h1 className="text-[clamp(2.25rem,4.5vw,3.75rem)] font-bold tracking-tight leading-[1.08] text-[#111827] dark:text-[#F8FAFC] [text-wrap:balance]">
              Meet Your New AI Workforce.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-[#667085] dark:text-[#A7B2C5] max-w-2xl mx-auto leading-relaxed">
              One intelligent workspace. Specialized AI agents. Endless possibilities. Let ORBITA AI help you research, market, sell, organize, and grow.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={handleGetStarted}
                className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>{user ? 'Open Workspace' : 'Get Started Free'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/agents')}
                className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#182338] hover:bg-[#F7F9FC] dark:hover:bg-[#202D43] text-[#111827] dark:text-[#F8FAFC] text-sm font-semibold inline-flex items-center justify-center transition-colors cursor-pointer"
              >
                Explore AI Agents
              </button>
            </div>
          </div>

          {/* Interactive Command Center Preview */}
          <div className="mt-12 lg:mt-16 rounded-2xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#182338] shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-3.5 border-b border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#202D43] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#111827] dark:text-[#F8FAFC]">
                <span>ORBITA AI Command Center</span>
                <span className="text-[#667085] dark:text-[#A7B2C5] font-normal hidden sm:inline">
                  · Interactive Workspace Preview
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAgent(activePreviewAgent.slug)}
                className="text-xs font-semibold text-[#4563FF] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Launch {activePreviewAgent.name}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Left Agent Selector */}
              <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#E6EAF0] dark:border-[#2B3950] p-3 sm:p-4 space-y-1.5 bg-white/70 dark:bg-[#182338]">
                <p className="px-2.5 pb-1 text-xs font-semibold text-[#667085] dark:text-[#A7B2C5]">
                  Select an assistant to inspect
                </p>
                {agents.map((agent) => {
                  const selected = agent.slug === activePreviewAgent.slug;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setPreviewSlug(agent.slug)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#4563FF]/10 text-[#111827] dark:text-[#F8FAFC]'
                          : 'hover:bg-[#F7F9FC] dark:hover:bg-[#202D43] text-[#667085] dark:text-[#A7B2C5]'
                      }`}
                    >
                      <AgentIcon icon={agent.icon} accentColor={agent.accent_color} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
                          {agent.name}
                        </div>
                        <div className="text-xs text-[#667085] dark:text-[#A7B2C5] truncate">
                          {agent.category}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Workspace Canvas Preview */}
              <div className="lg:col-span-8 p-5 sm:p-8 flex flex-col justify-between bg-[#F7F9FC] dark:bg-[#101827]/40">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <AgentIcon
                        icon={activePreviewAgent.icon}
                        accentColor={activePreviewAgent.accent_color}
                        size="lg"
                      />
                      <div>
                        <h2 className="text-lg font-bold text-[#111827] dark:text-[#F8FAFC]">
                          {activePreviewAgent.name}
                        </h2>
                        <p className="text-sm text-[#667085] dark:text-[#A7B2C5]">
                          {activePreviewAgent.tagline}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-5 text-sm sm:text-[15px] text-[#111827] dark:text-[#E2E8F0] leading-relaxed">
                    {activePreviewAgent.description}
                  </p>

                  <div className="mt-6">
                    <div className="text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-2.5">
                      Core capabilities
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activePreviewAgent.capabilities.slice(0, 6).map((cap) => (
                        <div
                          key={cap}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] text-xs sm:text-sm text-[#111827] dark:text-[#F8FAFC]"
                        >
                          <Check className="w-3.5 h-3.5 text-[#12B76A] shrink-0" />
                          <span className="truncate">{cap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-[#E6EAF0] dark:border-[#2B3950]">
                  <div className="text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-2">
                    Quick-start prompts inside this workspace
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activePreviewAgent.suggested_prompts.slice(0, 3).map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleOpenAgent(activePreviewAgent.slug)}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] hover:border-[#4563FF] text-xs font-medium text-[#111827] dark:text-[#F8FAFC] transition-colors cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HONEST BENEFITS STRIP */}
      <section className="py-12 border-b border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: 'Unified Command Center',
              body: 'Operate sales, marketing, research, finance, support, and operations assistants from one navigation bar.',
            },
            {
              title: 'Role-Specific Guardrails',
              body: 'Each assistant runs dedicated system instructions tailored to its business discipline.',
            },
            {
              title: 'Saved Outputs & Prompts',
              body: 'Keep your best drafts, templates, and multi-turn threads searchable across sessions.',
            },
            {
              title: 'Private Account Isolation',
              body: 'Firebase Authentication with server-enforced ownership on every conversation and record.',
            },
          ].map((item) => (
            <div key={item.title} className="space-y-1.5">
              <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC]">{item.title}</h3>
              <p className="text-sm text-[#667085] dark:text-[#A7B2C5] leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROBLEM & SOLUTION */}
      <section className="py-16 lg:py-20 bg-white dark:bg-[#182338] border-b border-[#E6EAF0] dark:border-[#2B3950]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC] [text-wrap:balance]">
              Stop rebuilding context across disconnected chat tabs.
            </h2>
            <p className="mt-3 text-base text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
              General chat windows force you to re-explain your role, tone, and formatting rules every time you switch from drafting a sales email to organizing a budget.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827]">
              <div className="text-sm font-semibold text-[#667085] dark:text-[#A7B2C5] mb-3">
                Fragmented AI tools
              </div>
              <ul className="space-y-3 text-sm text-[#111827] dark:text-[#E2E8F0]">
                <li>Switching between separate browser tabs and tools for each department</li>
                <li>Re-typing lengthy system instructions on every blank chat</li>
                <li>Useful drafts buried inside unorganized conversation streams</li>
                <li>No shared prompt library or per-function usage visibility</li>
              </ul>
            </div>
            <div className="p-6 rounded-2xl border border-[#4563FF]/30 bg-[#4563FF]/[0.04] dark:bg-[#4563FF]/10">
              <div className="text-sm font-semibold text-[#4563FF] mb-3">
                The ORBITA AI workspace
              </div>
              <ul className="space-y-3 text-sm text-[#111827] dark:text-[#F8FAFC]">
                <li>Six specialized agents ready with domain-calibrated instructions</li>
                <li>Dedicated multi-turn conversation history organized per agent</li>
                <li>One-click Saved Outputs library with custom titles and search</li>
                <li>Platform prompt templates paired with your own reusable prompts</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SIX SPECIALIZED AI AGENTS */}
      <section id="agents" className="py-16 lg:py-20 bg-[#F7F9FC] dark:bg-[#101827] border-b border-[#E6EAF0] dark:border-[#2B3950]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC]">
                Six specialized agents, built for real work.
              </h2>
              <p className="mt-2.5 text-base text-[#667085] dark:text-[#A7B2C5]">
                Every assistant in ORBITA AI has a clear functional scope, structured prompting, and persistent conversation threads.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/agents')}
              className="text-sm font-semibold text-[#4563FF] hover:underline whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
            >
              View full capabilities
            </button>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <AgentIcon icon={agent.icon} accentColor={agent.accent_color} size="md" />
                    <div>
                      <h3 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC]">{agent.name}</h3>
                      <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">{agent.category}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
                    {agent.description}
                  </p>
                  <ul className="mt-4 space-y-1.5">
                    {agent.capabilities.slice(0, 4).map((cap) => (
                      <li key={cap} className="text-xs text-[#111827] dark:text-[#E2E8F0] flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#20C9B7] shrink-0" />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-[#E6EAF0] dark:border-[#2B3950]">
                  <button
                    type="button"
                    onClick={() => handleOpenAgent(agent.slug)}
                    className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] hover:border-[#4563FF] hover:text-[#4563FF] text-sm font-semibold text-[#111827] dark:text-[#F8FAFC] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Open {agent.name}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 lg:py-20 bg-white dark:bg-[#182338] border-b border-[#E6EAF0] dark:border-[#2B3950]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC]">
              How ORBITA AI works
            </h2>
            <p className="mt-2.5 text-base text-[#667085] dark:text-[#A7B2C5]">
              Go from task description to reusable business output in five straightforward steps.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="p-5 rounded-2xl bg-[#F7F9FC] dark:bg-[#101827] border border-[#E6EAF0] dark:border-[#2B3950]"
              >
                <div className="font-mono text-sm font-semibold text-[#4563FF] tabular-nums mb-2">
                  {item.step}
                </div>
                <h3 className="text-base font-semibold text-[#111827] dark:text-[#F8FAFC]">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES BENTO */}
      <section id="features" className="py-16 lg:py-20 bg-[#F7F9FC] dark:bg-[#101827] border-b border-[#E6EAF0] dark:border-[#2B3950]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC]">
              Built as an operating environment, not a throwaway chat box.
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Sparkles, title: 'Specialized AI Agents', desc: 'Six purpose-built assistants tuned for distinct business roles.' },
              { icon: Layers, title: 'Unified Workspace', desc: 'Switch seamlessly between Sales, Marketing, Research, Finance, Support, and Ops.' },
              { icon: MessageSquareText, title: 'Persistent Conversations', desc: 'Rename, revisit, and continue multi-turn threads whenever work resumes.' },
              { icon: BookmarkCheck, title: 'Saved Outputs', desc: 'Store polished emails, SOPs, and analyses with custom titles.' },
              { icon: Library, title: 'Prompt Library', desc: 'Combine curated platform templates with your own custom team prompts.' },
              { icon: FolderKanban, title: 'Productivity Tools', desc: 'One-click copy, response regeneration, and quick task launch from your dashboard.' },
              { icon: Lock, title: 'Secure Account Access', desc: 'Firebase Authentication with strict server-side user data isolation.' },
              { icon: Workflow, title: 'Future Workflow Integrations', desc: 'Extensible architecture prepared for connected team workflows.' },
            ].map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950]"
                >
                  <Icon className="w-5 h-5 text-[#4563FF] mb-3" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC]">{feat.title}</h3>
                  <p className="mt-1.5 text-sm text-[#667085] dark:text-[#A7B2C5] leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section id="pricing" className="py-16 lg:py-20 bg-white dark:bg-[#182338] border-b border-[#E6EAF0] dark:border-[#2B3950]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC]">
                Transparent INR plans built to scale with your work.
              </h2>
              <p className="mt-2.5 text-base text-[#667085] dark:text-[#A7B2C5]">
                Start on Free at ₹0 or upgrade to Starter, Pro, or Business for expanded monthly AI credits across all six agents.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/pricing')}
              className="text-sm font-semibold text-[#4563FF] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Compare all plan details
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans
              .filter((p) => p.id !== 'free')
              .map((plan) => (
                <div
                  key={plan.id}
                  className={`p-6 rounded-2xl border flex flex-col justify-between ${
                    plan.id === 'pro'
                      ? 'border-[#4563FF] bg-[#4563FF]/[0.03] dark:bg-[#4563FF]/10'
                      : 'border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-bold uppercase text-[#111827] dark:text-[#F8FAFC]">
                        {plan.name}
                      </h3>
                      <span className="text-xs font-medium text-[#4563FF]">
                        {plan.monthly_credits.toLocaleString()} credits/mo
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="font-mono text-3xl font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                        {formatPriceFromPaise(plan.monthly_price_paise, plan.currency)}
                      </span>
                      <span className="text-xs text-[#667085] dark:text-[#A7B2C5]">/month</span>
                    </div>
                    <p className="mt-2 text-sm text-[#667085] dark:text-[#A7B2C5]">{plan.tagline}</p>
                    <ul className="mt-5 space-y-2.5 text-sm text-[#111827] dark:text-[#E2E8F0]">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-[#12B76A] shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={() => navigate(user ? '/app/billing' : '/pricing')}
                      className={`w-full min-h-[44px] rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                        plan.id === 'pro'
                          ? 'bg-[#4563FF] hover:bg-[#3652E6] text-white'
                          : 'border border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#182338] hover:border-[#4563FF] text-[#111827] dark:text-[#F8FAFC]'
                      }`}
                    >
                      {user ? `Choose ${plan.name}` : `Explore ${plan.name}`}
                    </button>
                  </div>
                </div>
              ))}
          </div>

          {/* Separate Free Plan Callout */}
          {(() => {
            const free = plans.find((p) => p.id === 'free');
            if (!free) return null;
            return (
              <div className="p-5 rounded-2xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-[#111827] dark:text-[#F8FAFC]">
                      {free.name} Plan
                    </span>
                    <span className="font-mono text-base font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                      {formatPriceFromPaise(free.monthly_price_paise, free.currency)}/month
                    </span>
                    <span className="text-xs text-[#667085] dark:text-[#A7B2C5]">
                      · {free.monthly_credits.toLocaleString()} credits/month · {free.included_agents_count} AI agents
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#667085] dark:text-[#A7B2C5]">{free.tagline}</p>
                </div>
                <button
                  type="button"
                  onClick={handleGetStarted}
                  className="min-h-[42px] px-5 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Start Free
                </button>
              </div>
            );
          })()}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 lg:py-20 bg-[#F7F9FC] dark:bg-[#101827]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#4563FF]/10 text-[#4563FF] mb-5">
            <Zap className="w-6 h-6" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC] [text-wrap:balance]">
            Your Next Workforce Starts Here.
          </h2>
          <p className="mt-3 text-base text-[#667085] dark:text-[#A7B2C5] max-w-xl mx-auto">
            Bring specialized sales, marketing, research, finance, customer support, and operations AI assistants into one organized command center.
          </p>
          <div className="mt-8">
            <button
              type="button"
              onClick={handleGetStarted}
              className="min-h-[48px] px-8 py-3 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>Start Using ORBITA AI</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
