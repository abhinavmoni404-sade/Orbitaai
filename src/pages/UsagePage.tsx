import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { UsageSummary } from '../types/orbita';

export const UsagePage: React.FC = () => {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<UsageSummary>('/api/usage')
      .then(setUsage)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <div className="h-28 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] animate-pulse" />
        <div className="h-64 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] animate-pulse" />
      </div>
    );
  }

  if (!usage) return null;

  const maxAgentCount = Math.max(1, ...usage.by_agent.map((a) => a.request_count));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#F8FAFC]">Usage Analytics</h1>
        <p className="mt-1 text-sm text-[#667085] dark:text-[#A7B2C5]">
          Real usage tracked from your stored workspace requests and daily allowance.
        </p>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total AI Requests', value: usage.total_requests },
          { label: 'Used Today (UTC)', value: usage.today_requests },
          { label: 'Remaining Today', value: usage.remaining_today },
          { label: 'Daily Plan Limit', value: `${usage.daily_limit} (${usage.plan})` },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950]"
          >
            <div className="text-xs font-medium text-[#667085] dark:text-[#A7B2C5]">{stat.label}</div>
            <div className="mt-1.5 font-mono text-2xl font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Requests by Agent */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4">
        <h2 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC]">Requests by Agent</h2>
        <div className="space-y-3">
          {usage.by_agent.map((row) => (
            <div key={row.agent_id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[#111827] dark:text-[#F8FAFC]">{row.agent_name}</span>
                <span className="font-mono font-semibold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                  {row.request_count}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#F7F9FC] dark:bg-[#101827] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round((row.request_count / maxAgentCount) * 100)}%`,
                    backgroundColor: row.accent_color || '#4563FF',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6EAF0] dark:border-[#2B3950]">
          <h2 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC]">Recent Usage History</h2>
        </div>
        {usage.recent_activity.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <BarChart3 className="w-8 h-8 text-[#667085] mx-auto opacity-60" />
            <p className="text-sm font-medium text-[#111827] dark:text-[#F8FAFC]">No usage recorded yet</p>
            <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">
              Send a message to any ORBITA AI agent to see real request history here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-[#F7F9FC] dark:bg-[#202D43] text-xs font-semibold text-[#667085] dark:text-[#A7B2C5]">
                <tr>
                  <th className="px-6 py-3">Agent</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3 text-right">Requests</th>
                  <th className="px-6 py-3 text-right">Est. Tokens</th>
                  <th className="px-6 py-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EAF0] dark:divide-[#2B3950]">
                {usage.recent_activity.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#F7F9FC]/60 dark:hover:bg-[#202D43]/40">
                    <td className="px-6 py-3 font-medium text-[#111827] dark:text-[#F8FAFC]">{rec.agent_name}</td>
                    <td className="px-6 py-3 text-[#667085] dark:text-[#A7B2C5]">
                      {rec.usage_type === 'regenerate' ? 'Regenerate response' : 'Chat generation'}
                    </td>
                    <td className="px-6 py-3 text-right font-mono tabular-nums">{rec.usage_amount}</td>
                    <td className="px-6 py-3 text-right font-mono tabular-nums text-[#667085] dark:text-[#A7B2C5]">
                      {rec.tokens_used}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-xs tabular-nums text-[#667085] dark:text-[#A7B2C5]">
                      {new Date(rec.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
