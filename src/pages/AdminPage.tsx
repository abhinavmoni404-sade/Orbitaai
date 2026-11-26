import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, ShieldAlert, XCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { calculateAnnualSavings, formatPriceFromPaise } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import type {
  AdminBillingConfig,
  Agent,
  ConfigStatus,
  FeedbackItem,
  InvoiceRecord,
  PaymentEnvironment,
  PaymentOrder,
  PlanId,
  SubscriptionPlan,
  SystemConfig,
  UserRole,
} from '../types/orbita';

interface AdminOverviewData {
  counts: {
    total_users: number;
    total_conversations: number;
    total_messages: number;
    total_saved_outputs: number;
    total_requests: number;
    open_feedback: number;
    contact_inquiries: number;
  };
  system_config: SystemConfig;
  config_status: ConfigStatus;
  audit_logs: Array<{
    id: string;
    admin_email: string;
    action: string;
    target_type: string;
    target_id: string;
    details: string | null;
    created_at: string;
  }>;
}

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan: PlanId;
  conversation_count: number;
  request_count: number;
  created_at: string;
}

interface AdminUsageData {
  by_agent: Array<{
    agent_id: string;
    agent_name: string;
    request_count: number;
    tokens_used: number;
  }>;
  recent_usage: Array<{
    id: string;
    usage_type: string;
    usage_amount: number;
    tokens_used: number;
    created_at: string;
    agent_name: string;
    user_email: string;
  }>;
}

interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  created_at: string;
}

interface AdminBillingData {
  plans: SubscriptionPlan[];
  billing_config: AdminBillingConfig;
  cashfree_configured: boolean;
  effective_environment: PaymentEnvironment;
  operational: boolean;
  orders: PaymentOrder[];
  invoices: InvoiceRecord[];
}

interface PlanDraft {
  monthlyInr: string;
  annualInr: string;
  monthlyCredits: number;
  dailyLimit: number;
  isActive: boolean;
}

type AdminTab = 'overview' | 'users' | 'agents' | 'billing' | 'usage' | 'feedback' | 'config';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [usageData, setUsageData] = useState<AdminUsageData | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [sysConfig, setSysConfig] = useState<SystemConfig | null>(null);
  const [billingData, setBillingData] = useState<AdminBillingData | null>(null);
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanDraft>>({});
  const [billingDraft, setBillingDraft] = useState<AdminBillingConfig | null>(null);
  const [currenciesInput, setCurrenciesInput] = useState('INR');
  const [reconcilingOrderId, setReconcilingOrderId] = useState<string | null>(null);
  const [reconcileRef, setReconcileRef] = useState('');
  const [reconcileNote, setReconcileNote] = useState('');
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [ov, us, ag, ug, fb, inq, bl] = await Promise.all([
        apiFetch<AdminOverviewData>('/api/admin/overview'),
        apiFetch<{ users: AdminUserRow[] }>('/api/admin/users'),
        apiFetch<{ agents: Agent[] }>('/api/admin/agents'),
        apiFetch<AdminUsageData>('/api/admin/usage'),
        apiFetch<{ feedback: FeedbackItem[] }>('/api/admin/feedback'),
        apiFetch<{ inquiries: ContactInquiry[] }>('/api/admin/inquiries'),
        apiFetch<AdminBillingData>('/api/admin/billing'),
      ]);
      setOverview(ov);
      setSysConfig(ov.system_config);
      setUsers(us.users);
      setAgents(ag.agents);
      setUsageData(ug);
      setFeedback(fb.feedback);
      setInquiries(inq.inquiries);
      setBillingData(bl);
      setBillingDraft(bl.billing_config);
      setCurrenciesInput(bl.billing_config.supported_currencies.join(', '));
      const drafts: Record<string, PlanDraft> = {};
      for (const p of bl.plans) {
        drafts[p.id] = {
          monthlyInr: (p.monthly_price_paise / 100).toString(),
          annualInr: p.annual_price_paise !== null ? (p.annual_price_paise / 100).toString() : '',
          monthlyCredits: p.monthly_credits,
          dailyLimit: p.daily_limit,
          isActive: p.is_active,
        };
      }
      setPlanDrafts(drafts);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load admin console.');
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAll();
    }
  }, [user, loadAll]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-[#F04438] mx-auto" />
        <h1 className="text-xl font-bold">Administrator Access Required</h1>
        <p className="text-sm text-[#667085] dark:text-[#A7B2C5]">
          This route is restricted on the server to authorized ORBITA AI administrators.
        </p>
      </div>
    );
  }

  const handleUpdateUser = async (targetId: string, role: UserRole, plan: PlanId) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/admin/users/${targetId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role, plan }),
      });
      setStatusMsg('User permissions updated.');
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleToggleAgent = async (agent: Agent) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/admin/agents/${agent.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !agent.is_active }),
      });
      setStatusMsg(`${agent.name} updated.`);
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update agent.');
    }
  };

  const handleSaveAgentEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;
    try {
      await apiFetch(`/api/admin/agents/${editingAgent.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          tagline: editingAgent.tagline,
          description: editingAgent.description,
          system_instruction: editingAgent.system_instruction,
        }),
      });
      setEditingAgent(null);
      setStatusMsg('Agent configuration saved.');
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update agent.');
    }
  };

  const handleFeedbackUpdate = async (id: string, status: 'open' | 'reviewed' | 'resolved') => {
    await apiFetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setStatusMsg('Feedback status updated.');
    await loadAll();
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sysConfig) return;
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await apiFetch('/api/admin/config', {
        method: 'PATCH',
        body: JSON.stringify(sysConfig),
      });
      setStatusMsg('System configuration saved.');
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save system configuration.');
    }
  };

  const handleSavePlan = async (planId: PlanId) => {
    const draft = planDrafts[planId];
    if (!draft) return;
    setErrorMsg(null);
    setStatusMsg(null);

    const monthlyNum = Number(draft.monthlyInr);
    if (!Number.isFinite(monthlyNum) || monthlyNum < 0) {
      setErrorMsg('Monthly price must be 0 or greater.');
      return;
    }

    let annualPaise: number | null = null;
    if (draft.annualInr.trim() !== '') {
      const annualNum = Number(draft.annualInr);
      if (!Number.isFinite(annualNum) || annualNum <= 0) {
        setErrorMsg('Annual price must be a positive amount or left blank to disable annual billing.');
        return;
      }
      annualPaise = Math.round(annualNum * 100);
    }

    try {
      await apiFetch(`/api/admin/billing/plans/${planId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          monthly_price_paise: Math.round(monthlyNum * 100),
          annual_price_paise: annualPaise,
          monthly_credits: Math.floor(Number(draft.monthlyCredits)),
          daily_limit: Math.floor(Number(draft.dailyLimit)),
          is_active: draft.isActive,
        }),
      });
      setStatusMsg(`Plan "${planId}" pricing and allowances updated.`);
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update subscription plan.');
    }
  };

  const handleSaveBillingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingDraft) return;
    setErrorMsg(null);
    setStatusMsg(null);

    const parsedCurrencies = currenciesInput
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    try {
      await apiFetch('/api/admin/billing/config', {
        method: 'PATCH',
        body: JSON.stringify({
          merchant_upi_id: billingDraft.merchant_upi_id,
          supported_currencies: parsedCurrencies,
          enabled_payment_methods: billingDraft.enabled_payment_methods,
          payment_environment: billingDraft.payment_environment,
          production_payments_enabled: billingDraft.production_payments_enabled,
          merchant_verified: billingDraft.merchant_verified,
          provider_approved: billingDraft.provider_approved,
          legal_requirements_completed: billingDraft.legal_requirements_completed,
        }),
      });
      setStatusMsg('Billing and merchant payment configuration updated.');
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save billing configuration.');
    }
  };

  const toggleBillingMethod = (method: string) => {
    if (!billingDraft) return;
    const exists = billingDraft.enabled_payment_methods.includes(method);
    const next = exists
      ? billingDraft.enabled_payment_methods.filter((m) => m !== method)
      : [...billingDraft.enabled_payment_methods, method];
    setBillingDraft({ ...billingDraft, enabled_payment_methods: next });
  };

  const handleReconcileOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcilingOrderId) return;
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await apiFetch(`/api/admin/billing/orders/${reconcilingOrderId}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({
          gateway_payment_id: reconcileRef,
          verification_note: reconcileNote,
        }),
      });
      setReconcilingOrderId(null);
      setReconcileRef('');
      setReconcileNote('');
      setStatusMsg('Order reconciled and subscription activated with invoice issued.');
      await loadAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Order reconciliation failed.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#F8FAFC]">Administration Console</h1>
        <p className="mt-1 text-sm text-[#667085] dark:text-[#A7B2C5]">
          Server-verified administrative controls for users, AI agents, billing plans, usage monitoring, and configuration.
        </p>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-xl bg-[#12B76A]/10 border border-[#12B76A]/30 text-xs font-medium text-[#12B76A]">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 text-xs font-medium text-[#F04438]">
          {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'users', label: 'Users' },
            { id: 'agents', label: 'Agents' },
            { id: 'billing', label: 'Plans & Billing' },
            { id: 'usage', label: 'Usage Monitoring' },
            { id: 'feedback', label: 'Feedback & Inquiries' },
            { id: 'config', label: 'System Config' },
          ] as Array<{ id: AdminTab; label: string }>
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
              tab === t.id
                ? 'bg-[#4563FF] text-white'
                : 'bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] text-[#667085] dark:text-[#A7B2C5]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Registered Users', value: overview.counts.total_users },
              { label: 'Total Conversations', value: overview.counts.total_conversations },
              { label: 'Total AI Requests', value: overview.counts.total_requests },
              { label: 'Open Feedback', value: overview.counts.open_feedback },
            ].map((s) => (
              <div
                key={s.label}
                className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950]"
              >
                <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">{s.label}</div>
                <div className="mt-1 font-mono text-2xl font-bold tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Environment & Integration Status */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4">
            <h2 className="text-base font-bold">Environment &amp; Integration Status</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                { label: 'GEMINI_API_KEY (AI Engine)', ok: overview.config_status.gemini_configured },
                { label: 'Firebase Authentication', ok: overview.config_status.firebase_auth_configured },
                { label: 'ADMIN_EMAIL Bootstrap', ok: overview.config_status.admin_email_configured },
                {
                  label: `Cashfree Hosted Checkout (${overview.config_status.payment_environment.toUpperCase()})`,
                  ok: overview.config_status.cashfree_configured,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="px-4 py-3 rounded-xl bg-[#F7F9FC] dark:bg-[#101827] border border-[#E6EAF0] dark:border-[#2B3950] flex items-center justify-between"
                >
                  <span className="text-xs sm:text-sm font-medium">{item.label}</span>
                  {item.ok ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#12B76A]">
                      <CheckCircle2 className="w-4 h-4" />
                      Configured
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#F79009]">
                      <XCircle className="w-4 h-4" />
                      Not set
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Admin Audit Log */}
          <div className="rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6EAF0] dark:border-[#2B3950]">
              <h2 className="text-base font-bold">Recent Administrative Audit Log</h2>
            </div>
            {overview.audit_logs.length === 0 ? (
              <p className="p-6 text-xs text-[#667085]">No administrative changes recorded yet.</p>
            ) : (
              <div className="divide-y divide-[#E6EAF0] dark:divide-[#2B3950] text-xs">
                {overview.audit_logs.map((log) => (
                  <div key={log.id} className="px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold">{log.admin_email}</span> ·{' '}
                      <span className="font-mono">{log.action}</span> ({log.target_type})
                      {log.details && <span className="text-[#667085] ml-2">{log.details}</span>}
                    </div>
                    <span className="font-mono text-[#667085] tabular-nums">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-[#F7F9FC] dark:bg-[#202D43] text-xs font-semibold text-[#667085]">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3 text-right">Conversations</th>
                <th className="px-5 py-3 text-right">Requests</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EAF0] dark:divide-[#2B3950]">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3">
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs text-[#667085]">{u.email}</div>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      aria-label={`Role for ${u.email}`}
                      value={u.role}
                      disabled={u.id === user.id}
                      onChange={(e) => handleUpdateUser(u.id, e.target.value as UserRole, u.plan)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-xs"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      aria-label={`Plan for ${u.email}`}
                      value={u.plan}
                      onChange={(e) => handleUpdateUser(u.id, u.role, e.target.value as PlanId)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-xs"
                    >
                      <option value="free">free</option>
                      <option value="starter">starter</option>
                      <option value="pro">pro</option>
                      <option value="business">business</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums">{u.conversation_count}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums">{u.request_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'agents' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((ag) => (
              <div
                key={ag.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold">{ag.name}</h2>
                    <div className="text-xs text-[#667085]">{ag.category} · {ag.is_active ? 'Active' : 'Paused'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingAgent(ag)}
                      className="px-3 py-1.5 rounded-lg border border-[#E6EAF0] dark:border-[#2B3950] text-xs font-semibold cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAgent(ag)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        ag.is_active
                          ? 'bg-[#F79009]/15 text-[#F79009]'
                          : 'bg-[#12B76A]/15 text-[#12B76A]'
                      }`}
                    >
                      {ag.is_active ? 'Pause' : 'Activate'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">{ag.description}</p>
              </div>
            ))}
          </div>

          {editingAgent && (
            <form
              onSubmit={handleSaveAgentEdits}
              className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#4563FF]/40 space-y-4"
            >
              <h3 className="text-base font-bold">Edit {editingAgent.name}</h3>
              <div>
                <label className="block text-xs font-semibold text-[#667085] mb-1">Tagline</label>
                <input
                  type="text"
                  value={editingAgent.tagline}
                  onChange={(e) => setEditingAgent({ ...editingAgent, tagline: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#667085] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingAgent.description}
                  onChange={(e) => setEditingAgent({ ...editingAgent, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#667085] mb-1">System Instruction</label>
                <textarea
                  rows={6}
                  value={editingAgent.system_instruction}
                  onChange={(e) => setEditingAgent({ ...editingAgent, system_instruction: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-xs font-mono"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAgent(null)}
                  className="px-4 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#4563FF] text-white text-xs font-semibold cursor-pointer"
                >
                  Save Agent
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === 'billing' && billingData && billingDraft && (
        <div className="space-y-6">
          {/* Subscription Plan Catalog Editor */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">Subscription Pricing &amp; Credit Catalog (INR / Paise)</h2>
                <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">
                  Monthly and annual prices are persisted server-side in integer minor units (paise). Leave annual price blank unless configured. Existing subscribers retain their agreed terms.
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 ${
                  billingData.operational
                    ? 'bg-[#12B76A]/15 text-[#12B76A]'
                    : 'bg-[#F79009]/15 text-[#F79009]'
                }`}
              >
                Gateway: {billingData.effective_environment.toUpperCase()} ·{' '}
                {billingData.cashfree_configured ? 'Credentials set' : 'Sandbox credentials not set'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {billingData.plans.map((p) => {
                const draft = planDrafts[p.id];
                if (!draft) return null;
                const monthlyPreviewPaise = Number.isFinite(Number(draft.monthlyInr))
                  ? Math.max(0, Math.round(Number(draft.monthlyInr) * 100))
                  : p.monthly_price_paise;
                const annualPreviewPaise =
                  draft.annualInr.trim() !== '' && Number.isFinite(Number(draft.annualInr))
                    ? Math.max(0, Math.round(Number(draft.annualInr) * 100))
                    : null;
                const savingsPreview = calculateAnnualSavings(monthlyPreviewPaise, annualPreviewPaise);

                return (
                  <div
                    key={p.id}
                    className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-mono uppercase text-[#4563FF] font-semibold">{p.id}</div>
                        <h3 className="text-base font-bold">{p.name}</h3>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(e) =>
                            setPlanDrafts({
                              ...planDrafts,
                              [p.id]: { ...draft, isActive: e.target.checked },
                            })
                          }
                          className="w-4 h-4 accent-[#4563FF]"
                        />
                        Active
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#667085] mb-1">
                          Monthly Price (INR)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={draft.monthlyInr}
                          onChange={(e) =>
                            setPlanDrafts({
                              ...planDrafts,
                              [p.id]: { ...draft, monthlyInr: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm font-mono tabular-nums"
                        />
                        <div className="mt-1 text-[11px] font-mono text-[#667085] tabular-nums">
                          {monthlyPreviewPaise} paise
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#667085] mb-1">
                          Annual Price (INR, optional)
                        </label>
                        <input
                          type="number"
                          min={1}
                          step="1"
                          placeholder="Not configured"
                          value={draft.annualInr}
                          onChange={(e) =>
                            setPlanDrafts({
                              ...planDrafts,
                              [p.id]: { ...draft, annualInr: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm font-mono tabular-nums"
                        />
                        <div className="mt-1 text-[11px] font-mono text-[#667085] tabular-nums">
                          {annualPreviewPaise !== null ? `${annualPreviewPaise} paise` : 'Disabled'}
                          {savingsPreview ? ` · Save ${savingsPreview.savingsPercent}%` : ''}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#667085] mb-1">
                          Monthly Credits
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={draft.monthlyCredits}
                          onChange={(e) =>
                            setPlanDrafts({
                              ...planDrafts,
                              [p.id]: { ...draft, monthlyCredits: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm font-mono tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#667085] mb-1">
                          Daily Request Limit
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={draft.dailyLimit}
                          onChange={(e) =>
                            setPlanDrafts({
                              ...planDrafts,
                              [p.id]: { ...draft, dailyLimit: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm font-mono tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleSavePlan(p.id)}
                        className="min-h-[38px] px-4 rounded-xl bg-[#4563FF] text-white text-xs font-semibold cursor-pointer"
                      >
                        Save {p.name}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Merchant UPI Reference & Cashfree Environment Config */}
          <form
            onSubmit={handleSaveBillingConfig}
            className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-5"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#4563FF]" />
              <h2 className="text-base font-bold">Cashfree Hosted Checkout &amp; Merchant UPI Reference</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#667085] mb-1">
                  Server-Side Merchant UPI Reference (Admin Only)
                </label>
                <input
                  type="text"
                  value={billingDraft.merchant_upi_id}
                  onChange={(e) => setBillingDraft({ ...billingDraft, merchant_upi_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm font-mono"
                />
                <p className="mt-1 text-[11px] text-[#667085]">
                  Stored server-side only; never exposed to public/client billing endpoints. Used only in authorized merchant provider flows.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#667085] mb-1">
                  Supported Currencies (comma-separated ISO codes)
                </label>
                <input
                  type="text"
                  value={currenciesInput}
                  onChange={(e) => setCurrenciesInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-[#667085] mb-2">Enabled Cashfree Hosted Methods</div>
                <div className="flex flex-wrap gap-3">
                  {(['upi', 'card', 'netbanking'] as const).map((m) => (
                    <label key={m} className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingDraft.enabled_payment_methods.includes(m)}
                        onChange={() => toggleBillingMethod(m)}
                        className="w-4 h-4 accent-[#4563FF]"
                      />
                      <span className="uppercase">{m}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#667085] mb-1">Payment Environment</label>
                <select
                  value={billingDraft.payment_environment}
                  onChange={(e) =>
                    setBillingDraft({
                      ...billingDraft,
                      payment_environment: e.target.value as PaymentEnvironment,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm"
                >
                  <option value="sandbox">SANDBOX (Test mode — safe default)</option>
                  <option value="production">PRODUCTION (Requires full verification)</option>
                </select>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F9FC] dark:bg-[#101827] border border-[#E6EAF0] dark:border-[#2B3950] space-y-2.5">
              <div className="text-xs font-bold text-[#111827] dark:text-[#F8FAFC]">
                Production Go-Live Verification Gate
              </div>
              <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">
                Production payments remain blocked on the server until all three compliance checks and server-side Cashfree API secrets (<span className="font-mono">CASHFREE_APP_ID</span>, <span className="font-mono">CASHFREE_SECRET_KEY</span>) are satisfied.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={billingDraft.merchant_verified}
                    onChange={(e) => setBillingDraft({ ...billingDraft, merchant_verified: e.target.checked })}
                    className="w-4 h-4 accent-[#4563FF]"
                  />
                  Merchant KYC &amp; bank verification completed
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={billingDraft.provider_approved}
                    onChange={(e) => setBillingDraft({ ...billingDraft, provider_approved: e.target.checked })}
                    className="w-4 h-4 accent-[#4563FF]"
                  />
                  Cashfree merchant account approved
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={billingDraft.legal_requirements_completed}
                    onChange={(e) =>
                      setBillingDraft({ ...billingDraft, legal_requirements_completed: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#4563FF]"
                  />
                  Terms, refund policy &amp; tax disclosures published
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={billingDraft.production_payments_enabled}
                    onChange={(e) =>
                      setBillingDraft({ ...billingDraft, production_payments_enabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#4563FF]"
                  />
                  Enable live production payments
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-[#4563FF] text-white text-sm font-semibold cursor-pointer"
              >
                Save Billing Settings
              </button>
            </div>
          </form>

          {/* Payment Orders & Reconciliation */}
          <div className="rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] overflow-x-auto">
            <div className="px-5 py-4 border-b border-[#E6EAF0] dark:border-[#2B3950] flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Payment Orders &amp; Authorized Reconciliation</h2>
              <span className="text-xs text-[#667085]">
                Subscriptions activate only after Cashfree webhook, gateway verification, or audited admin reconciliation.
              </span>
            </div>
            {billingData.orders.length === 0 ? (
              <p className="p-5 text-xs text-[#667085]">No payment orders created yet.</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#F7F9FC] dark:bg-[#202D43] text-[#667085]">
                  <tr>
                    <th className="px-4 py-2.5">Order ID</th>
                    <th className="px-4 py-2.5">User</th>
                    <th className="px-4 py-2.5">Plan / Cycle</th>
                    <th className="px-4 py-2.5">Amount</th>
                    <th className="px-4 py-2.5">Env</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EAF0] dark:divide-[#2B3950]">
                  {billingData.orders.map((ord) => (
                    <tr key={ord.id}>
                      <td className="px-4 py-2.5 font-mono">{ord.id}</td>
                      <td className="px-4 py-2.5">{ord.user_email ?? ord.user_id}</td>
                      <td className="px-4 py-2.5 capitalize">
                        {ord.plan_id} · {ord.billing_cycle}
                      </td>
                      <td className="px-4 py-2.5 font-mono tabular-nums">
                        {formatPriceFromPaise(ord.amount_paise, ord.currency)}
                      </td>
                      <td className="px-4 py-2.5 uppercase font-mono">{ord.payment_environment}</td>
                      <td className="px-4 py-2.5 capitalize font-semibold">{ord.status}</td>
                      <td className="px-4 py-2.5 text-right">
                        {ord.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReconcilingOrderId(ord.id);
                              setReconcileRef('');
                              setReconcileNote('');
                            }}
                            className="px-2.5 py-1 rounded-lg border border-[#4563FF]/40 text-[#4563FF] font-semibold cursor-pointer"
                          >
                            Reconcile
                          </button>
                        ) : (
                          <span className="font-mono text-[#667085]">{ord.gateway_payment_id ?? '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {reconcilingOrderId && (
            <form
              onSubmit={handleReconcileOrder}
              className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#4563FF]/40 space-y-4 max-w-xl"
            >
              <h3 className="text-sm font-bold">Reconcile Pending Order: {reconcilingOrderId}</h3>
              <p className="text-xs text-[#667085]">
                Enter the verified Cashfree payment ID or bank settlement UTR after verifying funds inside the merchant dashboard. This action is audit-logged.
              </p>
              <div>
                <label className="block text-xs font-semibold text-[#667085] mb-1">
                  Verified Gateway Payment / UTR Reference
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={reconcileRef}
                  onChange={(e) => setReconcileRef(e.target.value)}
                  placeholder="cf_pay_... or verified UTR"
                  className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#667085] mb-1">Verification Note</label>
                <input
                  type="text"
                  value={reconcileNote}
                  onChange={(e) => setReconcileNote(e.target.value)}
                  placeholder="Verified in Cashfree merchant portal"
                  className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReconcilingOrderId(null)}
                  className="px-4 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#12B76A] text-white text-xs font-semibold cursor-pointer"
                >
                  Verify &amp; Activate Subscription
                </button>
              </div>
            </form>
          )}

          {/* Issued Invoices */}
          <div className="rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] overflow-x-auto">
            <div className="px-5 py-3.5 border-b border-[#E6EAF0] dark:border-[#2B3950] font-bold text-sm">
              Issued Invoices
            </div>
            {billingData.invoices.length === 0 ? (
              <p className="p-5 text-xs text-[#667085]">No invoices issued yet.</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#F7F9FC] dark:bg-[#202D43] text-[#667085]">
                  <tr>
                    <th className="px-4 py-2.5">Invoice #</th>
                    <th className="px-4 py-2.5">User</th>
                    <th className="px-4 py-2.5">Plan</th>
                    <th className="px-4 py-2.5">Amount</th>
                    <th className="px-4 py-2.5">Issued At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6EAF0] dark:divide-[#2B3950]">
                  {billingData.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-2.5 font-mono font-semibold">{inv.invoice_number}</td>
                      <td className="px-4 py-2.5">{inv.user_email ?? inv.user_id}</td>
                      <td className="px-4 py-2.5">
                        {inv.plan_name} ({inv.billing_cycle})
                      </td>
                      <td className="px-4 py-2.5 font-mono tabular-nums">
                        {formatPriceFromPaise(inv.amount_paise, inv.currency)}
                      </td>
                      <td className="px-4 py-2.5 font-mono tabular-nums">
                        {new Date(inv.issued_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'usage' && usageData && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-[#F7F9FC] dark:bg-[#202D43] text-xs font-semibold text-[#667085]">
                <tr>
                  <th className="px-5 py-3">Agent</th>
                  <th className="px-5 py-3 text-right">Requests</th>
                  <th className="px-5 py-3 text-right">Est. Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EAF0] dark:divide-[#2B3950]">
                {usageData.by_agent.map((row) => (
                  <tr key={row.agent_id}>
                    <td className="px-5 py-3 font-semibold">{row.agent_name}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{row.request_count}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums">{row.tokens_used}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] overflow-x-auto">
            <div className="px-5 py-3.5 border-b border-[#E6EAF0] dark:border-[#2B3950] font-bold text-sm">
              Recent Usage Events
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#F7F9FC] dark:bg-[#202D43] text-[#667085]">
                <tr>
                  <th className="px-5 py-2.5">User</th>
                  <th className="px-5 py-2.5">Agent</th>
                  <th className="px-5 py-2.5">Type</th>
                  <th className="px-5 py-2.5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EAF0] dark:divide-[#2B3950]">
                {usageData.recent_usage.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-2.5">{r.user_email}</td>
                    <td className="px-5 py-2.5 font-medium">{r.agent_name}</td>
                    <td className="px-5 py-2.5">{r.usage_type}</td>
                    <td className="px-5 py-2.5 text-right font-mono tabular-nums">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'feedback' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4">
            <h2 className="text-base font-bold">User Feedback</h2>
            {feedback.length === 0 ? (
              <p className="text-xs text-[#667085]">No user feedback submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {feedback.map((fb) => (
                  <div key={fb.id} className="p-3.5 rounded-xl bg-[#F7F9FC] dark:bg-[#101827] border border-[#E6EAF0] dark:border-[#2B3950] space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold">{fb.category} · {fb.user_email}</span>
                      <select
                        value={fb.status}
                        onChange={(e) =>
                          handleFeedbackUpdate(fb.id, e.target.value as 'open' | 'reviewed' | 'resolved')
                        }
                        className="px-2 py-1 rounded border border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#182338]"
                      >
                        <option value="open">open</option>
                        <option value="reviewed">reviewed</option>
                        <option value="resolved">resolved</option>
                      </select>
                    </div>
                    <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">{fb.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4">
            <h2 className="text-base font-bold">Public Contact Inquiries</h2>
            {inquiries.length === 0 ? (
              <p className="text-xs text-[#667085]">No public inquiries received yet.</p>
            ) : (
              <div className="space-y-3">
                {inquiries.map((inq) => (
                  <div key={inq.id} className="p-3.5 rounded-xl bg-[#F7F9FC] dark:bg-[#101827] border border-[#E6EAF0] dark:border-[#2B3950] space-y-1">
                    <div className="text-xs font-semibold">
                      {inq.name} ({inq.email}) {inq.company ? `· ${inq.company}` : ''}
                    </div>
                    <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">{inq.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'config' && sysConfig && (
        <form
          onSubmit={handleSaveConfig}
          className="max-w-xl p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4"
        >
          <h2 className="text-base font-bold">System Configuration &amp; Quotas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#667085] mb-1">Free Daily Limit</label>
              <input
                type="number"
                min={1}
                value={sysConfig.free_daily_limit}
                onChange={(e) => setSysConfig({ ...sysConfig, free_daily_limit: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#667085] mb-1">Starter Daily Limit</label>
              <input
                type="number"
                min={1}
                value={sysConfig.starter_daily_limit}
                onChange={(e) => setSysConfig({ ...sysConfig, starter_daily_limit: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#667085] mb-1">Pro Daily Limit</label>
              <input
                type="number"
                min={1}
                value={sysConfig.pro_daily_limit}
                onChange={(e) => setSysConfig({ ...sysConfig, pro_daily_limit: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#667085] mb-1">Business Daily Limit</label>
              <input
                type="number"
                min={1}
                value={sysConfig.business_daily_limit}
                onChange={(e) => setSysConfig({ ...sysConfig, business_daily_limit: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm font-mono tabular-nums"
              />
            </div>
          </div>

          <label className="flex items-center justify-between py-2 cursor-pointer text-sm">
            <span>Allow new account signups</span>
            <input
              type="checkbox"
              checked={sysConfig.allow_new_signups}
              onChange={(e) => setSysConfig({ ...sysConfig, allow_new_signups: e.target.checked })}
              className="w-5 h-5 accent-[#4563FF]"
            />
          </label>

          <label className="flex items-center justify-between py-2 cursor-pointer text-sm">
            <span>Maintenance mode (pauses non-admin AI requests)</span>
            <input
              type="checkbox"
              checked={sysConfig.maintenance_mode}
              onChange={(e) => setSysConfig({ ...sysConfig, maintenance_mode: e.target.checked })}
              className="w-5 h-5 accent-[#4563FF]"
            />
          </label>

          <button
            type="submit"
            className="min-h-[44px] px-5 rounded-xl bg-[#4563FF] text-white text-sm font-semibold cursor-pointer"
          >
            Save Configuration
          </button>
        </form>
      )}
    </div>
  );
};
