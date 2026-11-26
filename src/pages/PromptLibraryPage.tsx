import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Edit3, Plus, Search, Trash2, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLocationPath } from '../lib/router';
import type { Agent, PromptCategory, PromptTemplate } from '../types/orbita';

const CATEGORIES: Array<'All' | PromptCategory> = [
  'All',
  'Sales',
  'Marketing',
  'Research',
  'Finance',
  'Customer Support',
  'Operations',
  'General Productivity',
];

function defaultSlugForCategory(category: string): string {
  switch (category) {
    case 'Sales':
      return 'orbita-sales';
    case 'Marketing':
      return 'orbita-marketing';
    case 'Research':
      return 'orbita-research';
    case 'Finance':
      return 'orbita-finance';
    case 'Customer Support':
      return 'orbita-support';
    default:
      return 'orbita-operations';
  }
}

export const PromptLibraryPage: React.FC = () => {
  const { navigate } = useLocationPath();
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<'All' | PromptCategory>('All');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'platform' | 'personal'>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<PromptCategory>('General Productivity');
  const [formPrompt, setFormPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Use with agent modal
  const [launchPrompt, setLaunchPrompt] = useState<PromptTemplate | null>(null);
  const [launchSlug, setLaunchSlug] = useState('orbita-sales');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, aRes] = await Promise.all([
        apiFetch<{ prompts: PromptTemplate[] }>('/api/prompts'),
        apiFetch<{ agents: Agent[] }>('/api/agents'),
      ]);
      setPrompts(pRes.prompts);
      setAgents(aRes.agents);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingPrompt(null);
    setFormTitle('');
    setFormCategory('General Productivity');
    setFormPrompt('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (tpl: PromptTemplate) => {
    setEditingPrompt(tpl);
    setFormTitle(tpl.title);
    setFormCategory((tpl.category as PromptCategory) || 'General Productivity');
    setFormPrompt(tpl.prompt);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSavePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      if (editingPrompt) {
        await apiFetch(`/api/prompts/${editingPrompt.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ title: formTitle, category: formCategory, prompt: formPrompt }),
        });
      } else {
        await apiFetch('/api/prompts', {
          method: 'POST',
          body: JSON.stringify({ title: formTitle, category: formCategory, prompt: formPrompt }),
        });
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save prompt.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    await apiFetch(`/api/prompts/${id}`, { method: 'DELETE' });
    setPrompts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSaveCopyAsPersonal = async (tpl: PromptTemplate) => {
    await apiFetch('/api/prompts', {
      method: 'POST',
      body: JSON.stringify({
        title: `${tpl.title} (Personal Copy)`,
        category: tpl.category,
        prompt: tpl.prompt,
      }),
    });
    await loadData();
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    });
  };

  const filtered = prompts.filter((p) => {
    if (category !== 'All' && p.category !== category) return false;
    if (ownershipFilter === 'platform' && !p.is_platform) return false;
    if (ownershipFilter === 'personal' && p.is_platform) return false;
    const q = search.trim().toLowerCase();
    if (q && !p.title.toLowerCase().includes(q) && !p.prompt.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] dark:text-[#F8FAFC]">Prompt Library</h1>
          <p className="mt-1 text-sm text-[#667085] dark:text-[#A7B2C5]">
            Browse platform-provided business templates or create your own reusable personal prompts.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Personal Prompt</span>
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#667085] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompt templates..."
              className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-white dark:bg-[#182338] text-sm text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF]"
            />
          </div>

          <div className="inline-flex p-1 rounded-xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950]">
            {[
              { id: 'all', label: 'All' },
              { id: 'platform', label: 'Platform Templates' },
              { id: 'personal', label: 'Personal Prompts' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setOwnershipFilter(tab.id as 'all' | 'platform' | 'personal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  ownershipFilter === tab.id
                    ? 'bg-[#4563FF] text-white'
                    : 'text-[#667085] dark:text-[#A7B2C5]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                category === cat
                  ? 'bg-[#111827] dark:bg-[#F8FAFC] text-white dark:text-[#111827]'
                  : 'bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] text-[#667085] dark:text-[#A7B2C5]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] text-center space-y-2">
          <p className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC]">No prompts match these filters</p>
          <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">
            Try selecting another category or create a new personal prompt.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC]">{tpl.title}</h2>
                </div>
                <div className="mt-1 text-xs text-[#667085] dark:text-[#A7B2C5]">
                  {tpl.category} · {tpl.is_platform ? 'Platform Template' : 'Personal Prompt'}
                </div>
                <p className="mt-3 text-sm text-[#667085] dark:text-[#A7B2C5] whitespace-pre-wrap leading-relaxed line-clamp-4">
                  {tpl.prompt}
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-[#E6EAF0] dark:border-[#2B3950] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLaunchPrompt(tpl);
                      setLaunchSlug(defaultSlugForCategory(tpl.category));
                    }}
                    className="min-h-[36px] px-3.5 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Use with Agent</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(tpl.id, tpl.prompt)}
                    className="min-h-[36px] px-3 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedId === tpl.id ? <Check className="w-3.5 h-3.5 text-[#12B76A]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === tpl.id ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {tpl.is_platform ? (
                  <button
                    type="button"
                    onClick={() => handleSaveCopyAsPersonal(tpl)}
                    className="min-h-[36px] px-3 rounded-xl text-xs font-medium text-[#4563FF] hover:bg-[#4563FF]/10 cursor-pointer"
                  >
                    Save to Personal
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(tpl)}
                      aria-label="Edit personal prompt"
                      className="min-h-[36px] px-2.5 rounded-xl text-[#667085] hover:text-[#111827] dark:hover:text-[#F8FAFC] cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePrompt(tpl.id)}
                      aria-label="Delete personal prompt"
                      className="min-h-[36px] px-2.5 rounded-xl text-[#667085] hover:text-[#F04438] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Personal Prompt Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePrompt}
            className="w-full max-w-lg p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#111827] dark:text-[#F8FAFC]">
                {editingPrompt ? 'Edit Personal Prompt' : 'Create Personal Prompt'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-[#667085] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-[#F04438]/10 text-xs text-[#F04438]">{formError}</div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-1">
                Prompt Title
              </label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Quarterly Board Update Draft"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-1">
                Category
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as PromptCategory)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm"
              >
                {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-1">
                Prompt Instructions
              </label>
              <textarea
                rows={5}
                required
                value={formPrompt}
                onChange={(e) => setFormPrompt(e.target.value)}
                placeholder="Write the reusable prompt template..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm"
              />
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[42px] px-4 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] px-5 rounded-xl bg-[#4563FF] text-white text-sm font-semibold cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Prompt'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Use with Agent Modal */}
      {launchPrompt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-[#111827] dark:text-[#F8FAFC]">Run Prompt with Agent</h2>
            <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">
              Choose which ORBITA AI assistant should receive &quot;{launchPrompt.title}&quot;.
            </p>
            <select
              value={launchSlug}
              onChange={(e) => setLaunchSlug(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.slug}>
                  {a.name} — {a.category}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setLaunchPrompt(null)}
                className="min-h-[42px] px-4 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = launchPrompt.prompt;
                  setLaunchPrompt(null);
                  navigate(`/app/agents/${launchSlug}?prompt=${encodeURIComponent(text)}`);
                }}
                className="min-h-[42px] px-5 rounded-xl bg-[#4563FF] text-white text-sm font-semibold cursor-pointer"
              >
                Open Agent Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
