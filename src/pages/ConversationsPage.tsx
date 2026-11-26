import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Edit3, MessageSquare, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLocationPath } from '../lib/router';
import { AgentIcon } from '../components/AgentIcon';
import type { Agent, Conversation } from '../types/orbita';

export const ConversationsPage: React.FC = () => {
  const { navigate } = useLocationPath();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [agentSlug, setAgentSlug] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (agentSlug) params.set('agentSlug', agentSlug);
      if (query.trim()) params.set('q', query.trim());
      const [cRes, aRes] = await Promise.all([
        apiFetch<{ conversations: Conversation[] }>(`/api/conversations?${params.toString()}`),
        apiFetch<{ agents: Agent[] }>('/api/agents'),
      ]);
      setConversations(cRes.conversations);
      setAgents(aRes.agents);
    } finally {
      setLoading(false);
    }
  }, [agentSlug, query]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRename = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    await apiFetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: editTitle.trim() }),
    });
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: editTitle.trim() } : c)));
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/conversations/${id}`, { method: 'DELETE' });
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#F8FAFC]">My Conversations</h1>
        <p className="mt-1 text-sm text-[#667085] dark:text-[#A7B2C5]">
          Search, resume, rename, or remove your persistent threads across all ORBITA AI agents.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversation titles..."
            className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#182338] text-sm text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF]"
          />
        </div>
        <select
          aria-label="Filter by agent"
          value={agentSlug}
          onChange={(e) => setAgentSlug(e.target.value)}
          className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#182338] text-sm text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF]"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.slug}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] animate-pulse" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] text-center space-y-3">
          <MessageSquare className="w-9 h-9 text-[#667085] mx-auto opacity-60" />
          <h2 className="text-base font-semibold text-[#111827] dark:text-[#F8FAFC]">No conversations found</h2>
          <p className="text-sm text-[#667085] dark:text-[#A7B2C5]">
            Start a new conversation inside any AI agent workspace.
          </p>
          <button
            type="button"
            onClick={() => navigate('/app/agents')}
            className="mt-2 px-5 py-2.5 rounded-xl bg-[#4563FF] text-white text-sm font-semibold cursor-pointer"
          >
            Explore AI Agents
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] divide-y divide-[#E6EAF0] dark:divide-[#2B3950]">
          {conversations.map((conv) => (
            <div key={conv.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <AgentIcon
                  icon={conv.agent_icon || 'Bot'}
                  accentColor={conv.agent_accent_color || '#4563FF'}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  {editingId === conv.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRename(conv.id);
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleRename(conv.id)}
                        className="w-full max-w-sm px-2.5 py-1 rounded-lg border border-[#4563FF] bg-[#F7F9FC] dark:bg-[#101827] text-sm"
                      />
                    </form>
                  ) : (
                    <h2 className="text-sm sm:text-base font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
                      {conv.title}
                    </h2>
                  )}
                  <div className="mt-0.5 text-xs text-[#667085] dark:text-[#A7B2C5] flex flex-wrap items-center gap-1.5">
                    <span>{conv.agent_name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{conv.message_count ?? 0} messages</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(conv.updated_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(conv.id);
                    setEditTitle(conv.title);
                  }}
                  aria-label="Rename conversation"
                  className="min-h-[38px] px-3 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-xs font-medium text-[#667085] dark:text-[#A7B2C5] hover:text-[#111827] dark:hover:text-[#F8FAFC] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Rename</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(conv.id)}
                  aria-label="Delete conversation"
                  className="min-h-[38px] px-3 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-xs font-medium text-[#667085] hover:text-[#F04438] hover:border-[#F04438]/40 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/app/agents/${conv.agent_slug}?conv=${conv.id}`)}
                  className="min-h-[38px] px-3.5 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Open</span>
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
