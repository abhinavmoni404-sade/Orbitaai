import { auth } from '../firebase';

async function getBearerToken(): Promise<string | null> {
  const current = auth.currentUser;
  if (!current) return null;
  try {
    return await current.getIdToken();
  } catch {
    return null;
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = await getBearerToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { error: text };
    }
  }

  if (!response.ok) {
    const msg =
      typeof parsed.error === 'string' && parsed.error
        ? parsed.error
        : `Request failed with status ${response.status}`;
    throw new Error(msg);
  }

  return parsed as T;
}

export async function streamPost(
  url: string,
  body: Record<string, unknown>,
  handlers: {
    onMeta?: (data: Record<string, unknown>) => void;
    onChunk: (delta: string) => void;
    onDone: (data: Record<string, unknown>) => void;
    onError: (message: string) => void;
  }
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = await getBearerToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let msg = `Request failed (${response.status})`;
    try {
      const errJson = (await response.json()) as { error?: string };
      if (errJson.error) msg = errJson.error;
    } catch {
      // ignore
    }
    handlers.onError(msg);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError('Streaming response unavailable.');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const block of parts) {
      const lines = block.split('\n');
      let eventName = currentEvent;
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }

      if (dataLines.length === 0) continue;
      const rawData = dataLines.join('\n');
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(rawData) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (eventName === 'meta' && handlers.onMeta) {
        handlers.onMeta(parsed);
      } else if (eventName === 'chunk') {
        if (typeof parsed.delta === 'string') {
          handlers.onChunk(parsed.delta);
        }
      } else if (eventName === 'done') {
        handlers.onDone(parsed);
      } else if (eventName === 'error') {
        handlers.onError(
          typeof parsed.message === 'string' ? parsed.message : 'Generation failed.'
        );
      }
      currentEvent = 'message';
    }
  }
}
