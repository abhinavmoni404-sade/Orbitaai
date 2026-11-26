import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Search } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLocationPath } from '../lib/router';
import { AgentIcon } from '../components/AgentIcon';
import type { Agent } from '../types/orbita';

export const AgentsMarketplacePage: React.FC = () => {
  const { navigate } = useLocationPath();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  useEffect(() => {
    apiFetch<{ agents: Agent[] }>('/api/agents')
      .then((res) => setAgents(res.agents))
      .finally(() => setLoading(false));
  }, []);

  const categories = ['All', ...Array.from(new Set(agents.map((a) => a.category)))];

  const filtered = agents.filter((a) => {
    const matchesCategory = categoryFilter === 'All' || a.category === categoryFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.capabilities.some((c) => c.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#F8FAFC]">AI Agent Marketplace</h1>
        <p className="mt-1 text-sm text-[#667085] dark:text-[#A7B2C5]">
          Select a specialized ORBITA AI assistant to open its dedicated workspace.
        </p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents or capabilities..."
            className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#182338] text-sm text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-[#4563FF] text-white'
                  : 'bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] text-[#667085] dark:text-[#A7B2C5] hover:text-[#111827] dark:hover:text-[#F8FAFC]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-64 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] text-center">
          <p className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC]">No matching agents found</p>
          <p className="mt-1 text-xs text-[#667085] dark:text-[#A7B2C5]">Try clearing your search filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((agent) => (
            <div
              key={agent.id}
              className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3">
                  <AgentIcon icon={agent.icon} accentColor={agent.accent_color} size="lg" />
                  <div>
                    <h2 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC]">{agent.name}</h2>
                    <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">{agent.category}</p>
                  </div>
                </div>
                <p className="mt-3.5 text-sm text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
                  {agent.description}
                </p>
                <ul className="mt-4 space-y-1.5">
                  {agent.capabilities.map((cap) => (
                    <li key={cap} className="text-xs text-[#111827] dark:text-[#E2E8F0] flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#12B76A] shrink-0" />
                      <span>{cap}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E6EAF0] dark:border-[#2B3950]">
                <button
                  type="button"
                  onClick={() => navigate(`/app/agents/${agent.slug}`)}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Open Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
