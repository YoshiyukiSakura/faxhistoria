import type { TurnProgressEvent, TurnResponse } from '@faxhistoria/shared';

const BASE_URL = '/api';

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('auth');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? res.statusText, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),

  postWithIdempotency: <T>(path: string, body: unknown, idempotencyKey: string) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'X-Idempotency-Key': idempotencyKey },
    }),

  postTurnWithProgress: async (
    path: string,
    body: unknown,
    idempotencyKey: string,
    onProgress?: (event: TurnProgressEvent) => void,
  ): Promise<TurnResponse> => {
    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Idempotency-Key': idempotencyKey,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const bodyJson = await res.json().catch(() => ({ message: res.statusText }));
      throw new ApiError(res.status, bodyJson.message ?? res.statusText, bodyJson);
    }

    if (!res.body) {
      throw new ApiError(500, 'Streaming is not available');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: TurnResponse | null = null;
    let streamError: ApiError | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let separatorIdx = buffer.indexOf('\n\n');

      while (separatorIdx !== -1) {
        const frame = buffer.slice(0, separatorIdx).trim();
        buffer = buffer.slice(separatorIdx + 2);

        if (frame) {
          let eventName = 'message';
          const dataLines: string[] = [];
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim());
            }
          }

          if (dataLines.length > 0) {
            try {
              const payload = JSON.parse(dataLines.join('\n')) as TurnProgressEvent;
              onProgress?.(payload);

              if (eventName === 'complete' && payload.result) {
                finalResult = payload.result;
              }
              if (eventName === 'error') {
                const statusCode = payload.error?.statusCode ?? 500;
                const message = payload.error?.message ?? payload.message;
                streamError = new ApiError(statusCode, message, payload.error);
              }
            } catch {
              // Ignore malformed SSE frames and continue.
            }
          }
        }

        separatorIdx = buffer.indexOf('\n\n');
      }
    }

    if (streamError) {
      throw streamError;
    }
    if (!finalResult) {
      throw new ApiError(500, 'Stream ended before completion');
    }
    return finalResult;
  },
};

export { ApiError };
