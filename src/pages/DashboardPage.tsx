import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookmarkCheck,
  MessageSquare,
  Send,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLocationPath } from '../lib/router';
import { AgentIcon } from '../components/AgentIcon';
import type { Agent, Conversation, SavedOutput, UsageSummary } from '../types/orbita';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useLocationPath();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [savedOutputs, setSavedOutputs] = useState<SavedOutput[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [quickAgentSlug, setQuickAgentSlug] = useState('orbita-sales');
  const [quickTask, setQuickTask] = useState('');
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<{ agents: Agent[] }>('/api/agents'),
      apiFetch<{ conversations: Conversation[] }>('/api/conversations'),
      apiFetch<{ savedOutputs: SavedOutput[] }>('/api/saved-outputs'),
      apiFetch<UsageSummary>('/api/usage'),
    ])
      .then(([aRes, cRes, sRes, uRes]) => {
        setAgents(aRes.agents);
        if (aRes.agents.length > 0) setQuickAgentSlug(aRes.agents[0].slug);
        setConversations(cRes.conversations.slice(0, 5));
        setSavedOutputs(sRes.savedOutputs.slice(0, 4));
        setUsage(uRes);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleQuickLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTask.trim() || launching) return;
    setLaunching(true);
    try {
      const encodedPrompt = encodeURIComponent(quickTask.trim());
      navigate(`/app/agents/${quickAgentSlug}?prompt=${encodedPrompt}`);
    } finally {
      setLaunching(false);
    }
  };

  const quickSuggestions = [
    { label: 'Draft a sales outreach email', slug: 'orbita-sales', prompt: 'Write a professional sales email introducing our product to a mid-market operations director.' },
    { label: 'Build a 30-day content plan', slug: 'orbita-marketing', prompt: 'Create a 30-day content calendar for LinkedIn and Instagram to grow inbound awareness.' },
    { label: 'Run a SWOT analysis', slug: 'orbita-research', prompt: 'Create a structured SWOT analysis for launching a B2B SaaS productivity tool.' },
    { label: 'Draft a business SOP', slug: 'orbita-operations', prompt: 'Create a step-by-step SOP for onboarding a new client cleanly.' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
      {/* Header Welcome */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC]">
            Welcome back, {user?.name}
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-[#667085] dark:text-[#A7B2C5]">
            What would you like your AI workforce to help you accomplish today?
          </p>
        </div>

        {usage && (
          <div className="flex items-center gap-6 px-4 py-3 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950]">
            <div>
              <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">Today</div>
              <div className="font-mono text-base font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                {usage.today_requests}/{usage.daily_limit}
              </div>
            </div>
            <div className="h-7 w-px bg-[#E6EAF0] dark:bg-[#2B3950]" />
            <div>
              <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">Total requests</div>
              <div className="font-mono text-base font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                {usage.total_requests}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/usage')}
              className="text-xs font-semibold text-[#4563FF] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              View usage
            </button>
          </div>
        )}
      </div>

      {/* AI-Powered Quick Task Input */}
      <form
        onSubmit={handleQuickLaunch}
        className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#111827] dark:text-[#F8FAFC]">
            <Sparkles className="w-4 h-4 text-[#4563FF]" />
            <span>Launch a task with an agent</span>
          </div>
          <select
            aria-label="Choose AI agent"
            value={quickAgentSlug}
            onChange={(e) => setQuickAgentSlug(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm font-medium text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF]"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.slug}>
                {a.name} — {a.category}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            rows={2}
            value={quickTask}
            onChange={(e) => setQuickTask(e.target.value)}
            placeholder="Describe what you want drafted, analyzed, calculated, or organized..."
            className="flex-1 px-4 py-3 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF] resize-none"
          />
          <button
            type="submit"
            disabled={!quickTask.trim() || launching}
            className="min-h-[46px] px-6 py-3 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0 transition-colors cursor-pointer"
          >
            <span>Start Task</span>
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#667085] dark:text-[#A7B2C5]">Try:</span>
          {quickSuggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => navigate(`/app/agents/${s.slug}?prompt=${encodeURIComponent(s.prompt)}`)}
              className="px-3 py-1.5 rounded-lg bg-[#F7F9FC] dark:bg-[#101827] border border-[#E6EAF0] dark:border-[#2B3950] hover:border-[#4563FF] text-xs font-medium text-[#111827] dark:text-[#E2E8F0] transition-colors cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>
      </form>

      {/* Six Specialized Agent Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#111827] dark:text-[#F8FAFC]">Your AI Workforce</h2>
          <button
            type="button"
            onClick={() => navigate('/app/agents')}
            className="text-sm font-semibold text-[#4563FF] hover:underline cursor-pointer"
          >
            All agents
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-52 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] flex flex-col justify-between hover:border-[#4563FF]/50 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <AgentIcon icon={agent.icon} accentColor={agent.accent_color} size="md" />
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC] truncate">
                        {agent.name}
                      </h3>
                      <p className="text-xs text-[#667085] dark:text-[#A7B2C5] truncate">{agent.category}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[#667085] dark:text-[#A7B2C5] line-clamp-2 leading-relaxed">
                    {agent.description}
                  </p>
                  <div className="mt-3 text-xs text-[#667085] dark:text-[#A7B2C5]">
                    {agent.capabilities.slice(0, 3).join(' · ')}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-[#E6EAF0] dark:border-[#2B3950]">
                  <button
                    type="button"
                    onClick={() => navigate(`/app/agents/${agent.slug}`)}
                    className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#F7F9FC] dark:bg-[#202D43] hover:bg-[#4563FF] hover:text-white text-sm font-semibold text-[#111827] dark:text-[#F8FAFC] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Open Agent</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Conversations & Saved Outputs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <section className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC]">Recent Conversations</h2>
            <button
              type="button"
              onClick={() => navigate('/app/conversations')}
              className="text-xs font-semibold text-[#4563FF] hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="py-8 text-center space-y-2.5">
              <MessageSquare className="w-8 h-8 text-[#667085] mx-auto opacity-60" />
              <p className="text-sm font-medium text-[#111827] dark:text-[#F8FAFC]">No conversations yet</p>
              <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">
                Open any AI agent above or launch a task to start your first thread.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E6EAF0] dark:divide-[#2B3950]">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => navigate(`/app/agents/${conv.agent_slug}?conv=${conv.id}`)}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:opacity-80 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
                      {conv.title}
                    </div>
                    <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">
                      {conv.agent_name} · {new Date(conv.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#667085] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Saved Outputs */}
        <section className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC]">Saved Outputs</h2>
            <button
              type="button"
              onClick={() => navigate('/app/saved')}
              className="text-xs font-semibold text-[#4563FF] hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          {savedOutputs.length === 0 ? (
            <div className="py-8 text-center space-y-2.5">
              <BookmarkCheck className="w-8 h-8 text-[#667085] mx-auto opacity-60" />
              <p className="text-sm font-medium text-[#111827] dark:text-[#F8FAFC]">No saved outputs yet</p>
              <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">
                Click &quot;Save Output&quot; on any AI assistant response to keep reusable drafts here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E6EAF0] dark:divide-[#2B3950]">
              {savedOutputs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate('/app/saved')}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:opacity-80 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
                      {item.title}
                    </div>
                    <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">
                      {item.agent_name} · {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#667085] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
