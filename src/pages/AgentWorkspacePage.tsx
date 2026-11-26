import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  Check,
  Copy,
  Edit3,
  History,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { apiFetch, streamPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLocationPath } from '../lib/router';
import { AgentIcon } from '../components/AgentIcon';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import type { Agent, Conversation, Message } from '../types/orbita';

interface AgentWorkspacePageProps {
  slug: string;
}

export const AgentWorkspacePage: React.FC<AgentWorkspacePageProps> = ({ slug }) => {
  const { search, navigate } = useLocationPath();
  const { refreshSession } = useAuth();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingConv, setLoadingConv] = useState(false);

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Rename state
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  // Save output modal
  const [saveModalMsg, setSaveModalMsg] = useState<Message | null>(null);
  const [saveTitle, setSaveTitle] = useState('');
  const [savingOutput, setSavingOutput] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const autoPromptSentRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const loadConversationMessages = useCallback(async (convId: string) => {
    setLoadingConv(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ conversation: Conversation; messages: Message[] }>(
        `/api/conversations/${convId}`
      );
      setActiveConv(res.conversation);
      setMessages(res.messages);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load conversation.');
    } finally {
      setLoadingConv(false);
    }
  }, []);

  const fetchAgentAndConversations = useCallback(async () => {
    setLoadingInit(true);
    setErrorMsg(null);
    try {
      const [agentRes, convRes] = await Promise.all([
        apiFetch<{ agent: Agent }>(`/api/agents/${slug}`),
        apiFetch<{ conversations: Conversation[] }>(`/api/conversations?agentSlug=${encodeURIComponent(slug)}`),
      ]);
      setAgent(agentRes.agent);
      setConversations(convRes.conversations);

      const params = new URLSearchParams(search);
      const convIdParam = params.get('conv');
      if (convIdParam && convRes.conversations.some((c) => c.id === convIdParam)) {
        await loadConversationMessages(convIdParam);
      } else {
        setActiveConv(null);
        setMessages([]);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load agent workspace.');
    } finally {
      setLoadingInit(false);
    }
  }, [slug, search, loadConversationMessages]);

  useEffect(() => {
    fetchAgentAndConversations();
  }, [fetchAgentAndConversations]);

  const sendMessage = useCallback(
    async (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || !agent || streaming) return;

      setErrorMsg(null);
      setStreaming(true);
      setStreamingContent('');

      try {
        let targetConv = activeConv;
        if (!targetConv) {
          const created = await apiFetch<{ conversation: Conversation }>('/api/conversations', {
            method: 'POST',
            body: JSON.stringify({ agent_id: agent.id }),
          });
          targetConv = created.conversation;
          setActiveConv(targetConv);
          setConversations((prev) => [targetConv!, ...prev]);
        }

        const convId = targetConv.id;
        setInput('');

        // Optimistic user message until meta confirms
        const tempUserId = `temp-${Date.now()}`;
        const optimisticMsg: Message = {
          id: tempUserId,
          conversation_id: convId,
          user_id: '',
          role: 'user',
          content: trimmed,
          model: null,
          tokens_used: 0,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMsg]);

        let accumulated = '';
        await streamPost(
          `/api/conversations/${convId}/messages`,
          { content: trimmed },
          {
            onMeta: (meta) => {
              const realUserMsg = meta.userMessage as Message | undefined;
              const newTitle = meta.conversationTitle as string | undefined;
              if (realUserMsg) {
                setMessages((prev) => prev.map((m) => (m.id === tempUserId ? realUserMsg : m)));
              }
              if (newTitle) {
                setActiveConv((prev) => (prev ? { ...prev, title: newTitle } : prev));
                setConversations((prev) =>
                  prev.map((c) => (c.id === convId ? { ...c, title: newTitle, updated_at: new Date().toISOString() } : c))
                );
              }
            },
            onChunk: (delta) => {
              accumulated += delta;
              setStreamingContent(accumulated);
            },
            onDone: (done) => {
              const assistantMsg = done.assistantMessage as Message | undefined;
              setStreamingContent('');
              if (assistantMsg) {
                setMessages((prev) => [...prev, assistantMsg]);
              }
              refreshSession();
            },
            onError: (msg) => {
              setStreamingContent('');
              setErrorMsg(msg);
            },
          }
        );
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to send message.');
        setStreamingContent('');
      } finally {
        setStreaming(false);
      }
    },
    [agent, activeConv, streaming, refreshSession]
  );

  // Handle ?prompt=... auto-dispatch once agent is loaded
  useEffect(() => {
    if (!agent || loadingInit) return;
    const params = new URLSearchParams(search);
    const promptParam = params.get('prompt');
    if (promptParam && autoPromptSentRef.current !== `${slug}:${promptParam}`) {
      autoPromptSentRef.current = `${slug}:${promptParam}`;
      // Clear query string cleanly so reload does not re-send
      navigate(`/app/agents/${slug}`, true);
      sendMessage(promptParam);
    }
  }, [agent, loadingInit, search, slug, navigate, sendMessage]);

  const handleRegenerate = async () => {
    if (!activeConv || streaming) return;
    setErrorMsg(null);
    setStreaming(true);
    setStreamingContent('');

    const previousMessages = messages;
    if (messages[messages.length - 1]?.role === 'assistant') {
      setMessages(messages.slice(0, -1));
    }

    let accumulated = '';
    try {
      await streamPost(
        `/api/conversations/${activeConv.id}/regenerate`,
        {},
        {
          onChunk: (delta) => {
            accumulated += delta;
            setStreamingContent(accumulated);
          },
          onDone: (done) => {
            const assistantMsg = done.assistantMessage as Message | undefined;
            setStreamingContent('');
            if (assistantMsg) {
              setMessages((prev) => [...prev, assistantMsg]);
            }
            refreshSession();
          },
          onError: (msg) => {
            setStreamingContent('');
            setMessages(previousMessages);
            setErrorMsg(msg);
          },
        }
      );
    } finally {
      setStreaming(false);
    }
  };

  const handleNewConversation = () => {
    setActiveConv(null);
    setMessages([]);
    setErrorMsg(null);
    setHistoryDrawerOpen(false);
    navigate(`/app/agents/${slug}`);
  };

  const handleDeleteConversation = async (convId: string) => {
    try {
      await apiFetch(`/api/conversations/${convId}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConv?.id === convId) {
        setActiveConv(null);
        setMessages([]);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to delete conversation.');
    }
  };

  const handleRenameSubmit = async (convId: string) => {
    const trimmed = renameText.trim();
    if (!trimmed) {
      setRenamingConvId(null);
      return;
    }
    try {
      await apiFetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: trimmed }),
      });
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, title: trimmed } : c)));
      if (activeConv?.id === convId) {
        setActiveConv((prev) => (prev ? { ...prev, title: trimmed } : prev));
      }
    } finally {
      setRenamingConvId(null);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    });
  };

  const openSaveModal = (msg: Message) => {
    setSaveModalMsg(msg);
    setSaveTitle(activeConv?.title && activeConv.title !== 'New conversation' ? activeConv.title : `${agent?.name || 'Agent'} Output`);
  };

  const handleConfirmSaveOutput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveModalMsg || !agent || !saveTitle.trim()) return;
    setSavingOutput(true);
    try {
      await apiFetch('/api/saved-outputs', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: agent.id,
          conversation_id: activeConv?.id || null,
          title: saveTitle.trim(),
          content: saveModalMsg.content,
        }),
      });
      setSaveModalMsg(null);
      setSavedNotice('Saved to your Saved Outputs library.');
      setTimeout(() => setSavedNotice(null), 2600);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save output.');
    } finally {
      setSavingOutput(false);
    }
  };

  const renderHistoryPanel = () => (
    <div className="flex flex-col h-full bg-white dark:bg-[#182338] border-r border-[#E6EAF0] dark:border-[#2B3950]">
      <div className="p-3.5 border-b border-[#E6EAF0] dark:border-[#2B3950] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleNewConversation}
          className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New conversation</span>
        </button>
        <button
          type="button"
          onClick={() => setHistoryDrawerOpen(false)}
          aria-label="Close conversation history"
          className="xl:hidden min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-[#667085]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-xs text-[#667085] dark:text-[#A7B2C5] text-center">
            No previous conversations with {agent?.name}.
          </p>
        ) : (
          conversations.map((c) => {
            const isActive = activeConv?.id === c.id;
            return (
              <div
                key={c.id}
                className={`group rounded-xl p-2.5 transition-colors ${
                  isActive
                    ? 'bg-[#4563FF]/10 text-[#111827] dark:text-[#F8FAFC]'
                    : 'hover:bg-[#F7F9FC] dark:hover:bg-[#202D43] text-[#667085] dark:text-[#A7B2C5]'
                }`}
              >
                {renamingConvId === c.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRenameSubmit(c.id);
                    }}
                    className="flex items-center gap-1"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      onBlur={() => handleRenameSubmit(c.id)}
                      className="w-full px-2 py-1 text-xs rounded border border-[#4563FF] bg-white dark:bg-[#101827] text-[#111827] dark:text-[#F8FAFC] focus:outline-none"
                    />
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryDrawerOpen(false);
                        loadConversationMessages(c.id);
                      }}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="text-xs font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
                        {c.title}
                      </div>
                      <div className="text-[11px] text-[#667085] dark:text-[#A7B2C5]">
                        {new Date(c.updated_at).toLocaleDateString()}
                      </div>
                    </button>
                    <div className="flex items-center gap-0.5 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        aria-label="Rename conversation"
                        onClick={() => {
                          setRenamingConvId(c.id);
                          setRenameText(c.title);
                        }}
                        className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#667085] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete conversation"
                        onClick={() => handleDeleteConversation(c.id)}
                        className="p-1.5 rounded-lg hover:bg-[#F04438]/10 text-[#667085] hover:text-[#F04438] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (loadingInit) {
    return (
      <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#4563FF]" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-xl font-bold">Agent unavailable</h1>
        <p className="text-sm text-[#667085] dark:text-[#A7B2C5]">{errorMsg || 'This agent could not be loaded.'}</p>
        <button
          type="button"
          onClick={() => navigate('/app/agents')}
          className="px-5 py-2.5 rounded-xl bg-[#4563FF] text-white text-sm font-semibold cursor-pointer"
        >
          Browse AI Agents
        </button>
      </div>
    );
  }

  const lastAssistantIdx = (() => {
    for (let idx = messages.length - 1; idx >= 0; idx--) {
      if (messages[idx].role === 'assistant') return idx;
    }
    return -1;
  })();

  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex overflow-hidden">
      {/* Desktop Conversation History Sidebar */}
      <div className="hidden xl:block w-72 shrink-0 h-full">{renderHistoryPanel()}</div>

      {/* Mobile / Tablet History Slide-over */}
      {historyDrawerOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setHistoryDrawerOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{renderHistoryPanel()}</div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-[#F7F9FC] dark:bg-[#101827]">
        {/* Workspace Header */}
        <div className="px-4 sm:px-6 py-3 bg-white dark:bg-[#182338] border-b border-[#E6EAF0] dark:border-[#2B3950] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <AgentIcon icon={agent.icon} accentColor={agent.accent_color} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-[#111827] dark:text-[#F8FAFC] truncate">
                  {agent.name}
                </h1>
                {activeConv && (
                  <span className="hidden sm:inline text-xs text-[#667085] dark:text-[#A7B2C5] truncate max-w-xs">
                    · {activeConv.title}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#667085] dark:text-[#A7B2C5] truncate">{agent.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setHistoryDrawerOpen(true)}
              className="xl:hidden min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-xs font-semibold text-[#111827] dark:text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>
            <button
              type="button"
              onClick={handleNewConversation}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] hover:border-[#4563FF] text-xs font-semibold text-[#111827] dark:text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </div>

        {/* Saved notice */}
        {savedNotice && (
          <div className="mx-4 sm:mx-6 mt-3 px-4 py-2.5 rounded-xl bg-[#12B76A]/10 border border-[#12B76A]/30 text-xs font-medium text-[#12B76A] flex items-center justify-between">
            <span>{savedNotice}</span>
            <button
              type="button"
              onClick={() => navigate('/app/saved')}
              className="underline font-semibold cursor-pointer"
            >
              View Saved Outputs
            </button>
          </div>
        )}

        {/* Messages Scroll Viewport */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          {loadingConv ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-[#4563FF]" />
            </div>
          ) : messages.length === 0 && !streaming ? (
            <div className="max-w-2xl mx-auto py-8 space-y-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-3">
                <div className="flex items-center gap-3">
                  <AgentIcon icon={agent.icon} accentColor={agent.accent_color} size="lg" />
                  <div>
                    <h2 className="text-lg font-bold text-[#111827] dark:text-[#F8FAFC]">{agent.name}</h2>
                    <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">{agent.category}</p>
                  </div>
                </div>
                <p className="text-sm text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
                  {agent.description}
                </p>
              </div>

              <div>
                <div className="text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-2.5">
                  Suggested prompts
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {agent.suggested_prompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="p-3.5 rounded-xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] hover:border-[#4563FF] text-left text-sm font-medium text-[#111827] dark:text-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[92%] sm:max-w-[84%] rounded-2xl px-4 py-3.5 ${
                        isUser
                          ? 'bg-[#4563FF] text-white'
                          : 'bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] text-[#111827] dark:text-[#F8FAFC]'
                      }`}
                    >
                      {isUser ? (
                        <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content}
                        </div>
                      ) : (
                        <>
                          <MarkdownRenderer content={msg.content} />
                          <div className="mt-3 pt-2.5 border-t border-[#E6EAF0] dark:border-[#2B3950] flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.id, msg.content)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#667085] dark:text-[#A7B2C5] hover:bg-[#F7F9FC] dark:hover:bg-[#202D43] hover:text-[#111827] dark:hover:text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              {copiedId === msg.id ? (
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

                            <button
                              type="button"
                              onClick={() => openSaveModal(msg)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#667085] dark:text-[#A7B2C5] hover:bg-[#F7F9FC] dark:hover:bg-[#202D43] hover:text-[#111827] dark:hover:text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                              <span>Save Output</span>
                            </button>

                            {idx === lastAssistantIdx && !streaming && (
                              <button
                                type="button"
                                onClick={handleRegenerate}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#667085] dark:text-[#A7B2C5] hover:bg-[#F7F9FC] dark:hover:bg-[#202D43] hover:text-[#111827] dark:hover:text-[#F8FAFC] inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Regenerate</span>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {streaming && (
                <div className="flex justify-start">
                  <div className="max-w-[92%] sm:max-w-[84%] rounded-2xl px-4 py-3.5 bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950]">
                    {streamingContent ? (
                      <MarkdownRenderer content={streamingContent} />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-[#667085] dark:text-[#A7B2C5]">
                        <Loader2 className="w-4 h-4 animate-spin text-[#4563FF]" />
                        <span>{agent.name} is thinking...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="mx-4 sm:mx-6 mb-2 px-4 py-2.5 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 flex items-center justify-between gap-3 text-xs sm:text-sm text-[#F04438]">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs font-semibold underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Composer */}
        <div className="p-3 sm:p-4 bg-white dark:bg-[#182338] border-t border-[#E6EAF0] dark:border-[#2B3950] shrink-0 pb-safe">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="max-w-3xl mx-auto flex items-end gap-2.5"
          >
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder={`Message ${agent.name}...`}
              disabled={streaming}
              className="flex-1 min-h-[46px] max-h-36 px-4 py-3 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm sm:text-[15px] text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF] resize-y"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              aria-label="Send message"
              className="min-h-[46px] min-w-[46px] px-4 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] disabled:opacity-50 text-white font-semibold inline-flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="hidden sm:inline text-sm">Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Save Output Modal */}
      {saveModalMsg && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmSaveOutput}
            className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-4 shadow-xl"
          >
            <h2 className="text-lg font-bold text-[#111827] dark:text-[#F8FAFC]">Save Output</h2>
            <div>
              <label htmlFor="save-output-title" className="block text-xs font-semibold text-[#667085] dark:text-[#A7B2C5] mb-1.5">
                Custom Title
              </label>
              <input
                id="save-output-title"
                type="text"
                required
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] bg-[#F7F9FC] dark:bg-[#101827] text-sm text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4563FF]"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSaveModalMsg(null)}
                className="min-h-[42px] px-4 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingOutput}
                className="min-h-[42px] px-5 rounded-xl bg-[#4563FF] text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
              >
                {savingOutput ? 'Saving...' : 'Save Output'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
