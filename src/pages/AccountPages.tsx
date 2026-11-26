import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  HelpCircle,
  Info,
  LogOut,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLocationPath } from '../lib/router';
import type { FeedbackItem, NotificationItem, ThemePreference, User } from '../types/orbita';

export const NotificationsPage: React.FC = () => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ notifications: NotificationItem[] }>('/api/notifications')
      .then((res) => setItems(res.notifications))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#F8FAFC]">Notifications</h1>
        <p className="mt-1 text-sm text-[#667085] dark:text-[#A7B2C5]">
          Account updates, daily usage alerts, and feedback status notices.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className="h-20 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] text-center space-y-2">
          <Bell className="w-8 h-8 text-[#667085] mx-auto opacity-60" />
          <p className="text-sm font-semibold">You are all caught up</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <div
              key={n.id}
              className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] flex items-start gap-3.5"
            >
              {n.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-[#F79009] shrink-0 mt-0.5" />
              ) : n.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-[#12B76A] shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-[#4563FF] shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC]">{n.title}</div>
                <p className="mt-1 text-sm text-[#667085] dark:text-[#A7B2C5]">{n.message}</p>
                <div className="mt-2 text-xs text-[#667085] dark:text-[#A7B2C5]">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const { user, setUserState, logout } = useAuth();
  const { setThemePreference } = useTheme();
  const { navigate } = useLocationPath();

  const [name, setName] = useState(user?.name || '');
  const [themePref, setThemePref] = useState<ThemePreference>(user?.theme_preference || 'light');
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notifications_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ user: User }>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          theme_preference: themePref,
          notifications_enabled: notificationsEnabled,
        }),
      });
      setUserState(res.user);
      setThemePreference(res.user.theme_preference);
      setSavedMsg('Settings updated.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    if (deleteText.trim() !== 'DELETE') return;
    setDeleting(true);
    try {
      await apiFetch('/api/profile', { method: 'DELETE' });
      await logout();
      navigate('/login');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to delete account.');
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#F8FAFC]">Account Settings</h1>
        <p className="mt-1 text-sm text-[#667085] dark:text-[#A7B2C5]">
          Manage your workspace preferences, authentication details, and account data.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-5"
      >
        <h2 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC]">Profile & Preferences</h2>

        {savedMsg && (
          <div className="p-3 rounded-xl bg-[#12B76A]/10 border border-[#12B76A]/30 text-xs font-medium text-[#12B76A]">
            {savedMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 text-xs font-medium text-[#F04438]">
            {errorMsg}
          </div>
        )}

        <div>
          <label htmlFor="profile-name" className="block text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-1.5">
            Display Name
          </label>
          <input
            id="profile-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-1.5">
            Theme Preference
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as ThemePreference[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setThemePref(opt);
                  setThemePreference(opt);
                }}
                className={`min-h-[42px] px-3 rounded-xl border text-xs font-semibold capitalize cursor-pointer ${
                  themePref === opt
                    ? 'border-[#4563FF] bg-[#4563FF]/10 text-[#4563FF]'
                    : 'border-[#E6EAF0] dark:border-[#2B3950] text-[#667085] dark:text-[#A7B2C5]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 py-2 cursor-pointer">
          <div>
            <div className="text-sm font-semibold text-[#111827] dark:text-[#F8FAFC]">Workspace Notifications</div>
            <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">
              Receive usage allowance notices and feedback status updates.
            </div>
          </div>
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
            className="w-5 h-5 accent-[#4563FF]"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] px-5 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-sm font-semibold cursor-pointer"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </form>

      {/* Account & Security */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4">
        <div className="flex items-center gap-2 text-base font-bold text-[#111827] dark:text-[#F8FAFC]">
          <ShieldCheck className="w-5 h-5 text-[#12B76A]" />
          <span>Account &amp; Security</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">Authentication Provider</div>
            <div className="mt-0.5 font-medium">Firebase Authentication (Email &amp; Password)</div>
          </div>
          <div>
            <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">Account Email</div>
            <div className="mt-0.5 font-medium">{user.email}</div>
          </div>
          <div>
            <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">Workspace Plan</div>
            <div className="mt-0.5 font-medium capitalize">{user.plan}</div>
          </div>
          <div>
            <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">Role</div>
            <div className="mt-0.5 font-medium capitalize">{user.role}</div>
          </div>
        </div>
        <p className="text-xs text-[#667085] dark:text-[#A7B2C5] pt-2 border-t border-[#E6EAF0] dark:border-[#2B3950]">
          ORBITA AI verifies your identity with Firebase Authentication on every request.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[42px] px-4 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#F7F9FC] dark:hover:bg-[#202D43] cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out of ORBITA AI</span>
          </button>
        </div>
      </div>

      {/* Account Deletion */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#F04438]/30 space-y-3">
        <h2 className="text-base font-bold text-[#F04438]">Delete Account & Data</h2>
        <p className="text-xs text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
          Permanently deletes your ORBITA AI account along with all conversations, messages, saved outputs, custom prompt templates, and usage history.
        </p>
        <button
          type="button"
          onClick={() => {
            setDeleteText('');
            setDeleteConfirmOpen(true);
          }}
          className="min-h-[42px] px-4 rounded-xl border border-[#F04438]/40 text-[#F04438] hover:bg-[#F04438]/10 text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete My Account</span>
        </button>
      </div>

      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-[#F04438]">Confirm Permanent Deletion</h3>
            <p className="text-sm text-[#667085] dark:text-[#A7B2C5]">
              This action cannot be undone. Type <strong className="font-mono text-[#111827] dark:text-[#F8FAFC]">DELETE</strong> below to permanently delete your account.
            </p>
            <input
              type="text"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm font-mono"
            />
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="min-h-[42px] px-4 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteText.trim() !== 'DELETE' || deleting}
                onClick={handleDeleteAccount}
                className="min-h-[42px] px-5 rounded-xl bg-[#F04438] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const HelpPage: React.FC = () => {
  const [category, setCategory] = useState('Feature Request');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<FeedbackItem[]>([]);
  const [submittedNotice, setSubmittedNotice] = useState(false);

  const loadHistory = () => {
    apiFetch<{ feedback: FeedbackItem[] }>('/api/feedback').then((res) => setHistory(res.feedback));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setSubmittedNotice(false);
    try {
      await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({ category, message }),
      });
      setMessage('');
      setSubmittedNotice(true);
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#F8FAFC]">Help Centre</h1>
        <p className="mt-1 text-sm text-[#667085] dark:text-[#A7B2C5]">
          Guidance on using ORBITA AI assistants and submitting product feedback.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            q: 'How do multi-turn agent workspaces work?',
            a: 'Each conversation preserves previous messages with that agent so you can ask for revisions, shorter drafts, or format changes without repeating context.',
          },
          {
            q: 'How do I reuse high-performing responses?',
            a: 'Click Save Output below any assistant message to store it with a custom title in Saved Outputs, or save custom prompts in Prompt Library.',
          },
          {
            q: 'What guardrails do Research and Finance use?',
            a: 'ORBITA RESEARCH labels facts vs. assumptions without inventing citations. ORBITA FINANCE shows formulas clearly and notes that outputs are organizational estimates.',
          },
          {
            q: 'How is my account secured?',
            a: 'ORBITA AI uses Firebase Authentication and isolates all conversations, saved outputs, and personal prompts by your verified user ID on the server.',
          },
        ].map((faq) => (
          <div
            key={faq.q}
            className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950]"
          >
            <div className="flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-[#4563FF] shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-[#111827] dark:text-[#F8FAFC]">{faq.q}</h2>
                <p className="mt-1.5 text-xs sm:text-sm text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
                  {faq.a}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Feedback Form */}
      <form
        onSubmit={handleSubmit}
        className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4"
      >
        <h2 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC]">Send Feedback or Report an Issue</h2>
        {submittedNotice && (
          <div className="p-3 rounded-xl bg-[#12B76A]/10 border border-[#12B76A]/30 text-xs font-medium text-[#12B76A]">
            Thank you. Your feedback has been submitted for review.
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 text-xs text-[#F04438]">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-1">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full sm:w-64 min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm"
          >
            <option value="Feature Request">Feature Request</option>
            <option value="Agent Quality">Agent Quality</option>
            <option value="Bug Report">Bug Report</option>
            <option value="Account & Billing">Account &amp; Billing</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-1">
            Message
          </label>
          <textarea
            rows={4}
            required
            minLength={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your suggestion or issue..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] px-5 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>{submitting ? 'Submitting...' : 'Submit Feedback'}</span>
        </button>
      </form>

      {history.length > 0 && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-3">
          <h2 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC]">Your Submitted Feedback</h2>
          <div className="divide-y divide-[#E6EAF0] dark:divide-[#2B3950]">
            {history.map((fb) => (
              <div key={fb.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#111827] dark:text-[#F8FAFC]">{fb.category}</span>
                  <span className="text-xs font-medium text-[#4563FF] capitalize">{fb.status}</span>
                </div>
                <p className="mt-1 text-xs text-[#667085] dark:text-[#A7B2C5]">{fb.message}</p>
                {fb.admin_notes && (
                  <p className="mt-1 text-xs text-[#12B76A]">Admin note: {fb.admin_notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
