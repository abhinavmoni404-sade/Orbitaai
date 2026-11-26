import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BookmarkCheck, Check, Copy, Eye, Search, Trash2, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLocationPath } from '../lib/router';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import type { Agent, SavedOutput } from '../types/orbita';

export const SavedOutputsPage: React.FC = () => {
  const { navigate } = useLocationPath();
  const [items, setItems] = useState<SavedOutput[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [agentSlug, setAgentSlug] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<SavedOutput | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (agentSlug) params.set('agentSlug', agentSlug);
      if (query.trim()) params.set('q', query.trim());
      const [sRes, aRes] = await Promise.all([
        apiFetch<{ savedOutputs: SavedOutput[] }>(`/api/saved-outputs?${params.toString()}`),
        apiFetch<{ agents: Agent[] }>('/api/agents'),
      ]);
      setItems(sRes.savedOutputs);
      setAgents(aRes.agents);
    } finally {
      setLoading(false);
    }
  }, [agentSlug, query]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    });
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/saved-outputs/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (viewingItem?.id === id) setViewingItem(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#F8FAFC]">Saved Outputs</h1>
        <p className="mt-1 text-sm text-[#667085] dark:text-[#A7B2C5]">
          Review, copy, and reuse drafts, reports, SOPs, and analyses bookmarked from your AI agents.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved titles or content..."
            className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#182338] text-sm text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF]"
          />
        </div>
        <select
          aria-label="Filter saved outputs by agent"
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] text-center space-y-3">
          <BookmarkCheck className="w-9 h-9 text-[#667085] mx-auto opacity-60" />
          <h2 className="text-base font-semibold text-[#111827] dark:text-[#F8FAFC]">No saved outputs yet</h2>
          <p className="text-sm text-[#667085] dark:text-[#A7B2C5] max-w-md mx-auto">
            Inside any agent conversation, click &quot;Save Output&quot; beneath a response to store it with a custom title here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC] truncate">
                      {item.title}
                    </h2>
                    <div className="mt-0.5 text-xs text-[#667085] dark:text-[#A7B2C5]">
                      {item.agent_name} · {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[#667085] dark:text-[#A7B2C5] line-clamp-3 leading-relaxed">
                  {item.content}
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-[#E6EAF0] dark:border-[#2B3950] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewingItem(item)}
                    className="min-h-[36px] px-3 rounded-xl bg-[#F7F9FC] dark:bg-[#202D43] text-xs font-semibold text-[#111827] dark:text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(item.id, item.content)}
                    className="min-h-[36px] px-3 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-xs font-semibold text-[#111827] dark:text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#12B76A]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {item.conversation_id && item.agent_slug && (
                    <button
                      type="button"
                      onClick={() => navigate(`/app/agents/${item.agent_slug}?conv=${item.conversation_id}`)}
                      className="min-h-[36px] px-3 rounded-xl text-xs font-semibold text-[#4563FF] hover:bg-[#4563FF]/10 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Thread</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    aria-label="Delete saved output"
                    className="min-h-[36px] px-2.5 rounded-xl text-[#667085] hover:text-[#F04438] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] shadow-xl">
            <div className="px-6 py-4 border-b border-[#E6EAF0] dark:border-[#2B3950] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[#111827] dark:text-[#F8FAFC] truncate">
                  {viewingItem.title}
                </h2>
                <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">
                  {viewingItem.agent_name} · {new Date(viewingItem.created_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                aria-label="Close viewer"
                className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#667085] hover:bg-[#F7F9FC] dark:hover:bg-[#202D43] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <MarkdownRenderer content={viewingItem.content} />
            </div>
            <div className="px-6 py-3.5 border-t border-[#E6EAF0] dark:border-[#2B3950] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleCopy(viewingItem.id, viewingItem.content)}
                className="min-h-[40px] px-4 rounded-xl bg-[#4563FF] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedId === viewingItem.id ? 'Copied' : 'Copy Content'}</span>
              </button>
              {viewingItem.conversation_id && viewingItem.agent_slug && (
                <button
                  type="button"
                  onClick={() => navigate(`/app/agents/${viewingItem.agent_slug}?conv=${viewingItem.conversation_id}`)}
                  className="min-h-[40px] px-4 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Open Original Conversation</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
