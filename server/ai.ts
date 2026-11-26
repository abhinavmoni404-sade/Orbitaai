import { GoogleGenAI } from '@google/genai';
import type { Content } from '@google/genai';
import type { Message } from '../src/types/orbita.ts';

export const ORBITA_MODEL = 'gemini-4-hydrogen';

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiConfigError(
      'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets to enable AI agent responses.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

export function formatFriendlyGeminiError(err: unknown): { status: number; message: string } {
  if (err instanceof GeminiConfigError) {
    return { status: 503, message: err.message };
  }
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 503,
      message:
        'The server Gemini API key was rejected or lacks permission. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'AI provider rate limit reached. Please wait a moment and try again.',
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 502,
      message: `The configured AI model (${ORBITA_MODEL}) could not be reached. Please verify server model configuration.`,
    };
  }
  return {
    status: 500,
    message: 'Unable to generate a response right now. Please try again in a moment.',
  };
}

export async function streamAgentResponse(params: {
  systemInstruction: string;
  historyMessages: Message[];
  userMessage: string;
  onChunk: (deltaText: string) => void;
}): Promise<{ fullText: string; model: string }> {
  const ai = getGenAIClient();

  // Keep last 24 messages for coherent multi-turn context without exceeding context bounds
  const recentHistory = params.historyMessages.slice(-24);
  const history: Content[] = recentHistory.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat = ai.chats.create({
    model: ORBITA_MODEL,
    config: {
      systemInstruction: params.systemInstruction,
    },
    history,
  });

  const stream = await chat.sendMessageStream({
    message: params.userMessage,
  });

  let fullText = '';
  for await (const chunk of stream) {
    const delta = chunk.text ?? '';
    if (delta) {
      fullText += delta;
      params.onChunk(delta);
    }
  }

  if (!fullText.trim()) {
    throw new Error('Empty response received from AI model.');
  }

  return {
    fullText,
    model: ORBITA_MODEL,
  };
}

export function deriveConversationTitle(firstPrompt: string): string {
  const cleaned = firstPrompt.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New conversation';
  if (cleaned.length <= 54) return cleaned;
  return `${cleaned.slice(0, 51).trim()}...`;
}
