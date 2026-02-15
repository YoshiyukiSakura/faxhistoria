import OpenAI from 'openai';
import { z } from 'zod';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-chat';

interface DeepSeekRuntimeConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

let cachedClient: OpenAI | null = null;
let cachedClientSignature = '';

function redactKey(apiKey: string): string {
  if (apiKey.length <= 4) return '***';
  return `***${apiKey.slice(-4)}`;
}

function readDeepSeekConfig(): DeepSeekRuntimeConfig {
  const apiKey = (process.env.DEEPSEEK_API_KEY || '').trim();
  const baseURL = (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).trim();
  const model = (process.env.DEEPSEEK_MODEL || DEFAULT_MODEL).trim();

  if (!apiKey) {
    throw new DeepSeekConfigError(
      'DEEPSEEK_API_KEY is missing. Set it in the repo-root .env and restart PM2 with --update-env.',
    );
  }
  if (!baseURL) {
    throw new DeepSeekConfigError('DEEPSEEK_BASE_URL is missing.');
  }
  if (!model) {
    throw new DeepSeekConfigError('DEEPSEEK_MODEL is missing.');
  }

  return { apiKey, baseURL, model };
}

function getClient(config: DeepSeekRuntimeConfig): OpenAI {
  const signature = `${config.baseURL}|${config.apiKey}`;
  if (!cachedClient || cachedClientSignature !== signature) {
    cachedClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    cachedClientSignature = signature;
  }
  return cachedClient;
}

function formatApiError(err: unknown, config: DeepSeekRuntimeConfig): string {
  const e = err as {
    status?: number;
    code?: string;
    message?: string;
    error?: {
      message?: string;
      code?: string;
    };
  };

  const status = typeof e.status === 'number' ? e.status : undefined;
  const upstreamMessage =
    typeof e.error?.message === 'string'
      ? e.error.message
      : err instanceof Error
        ? err.message
        : 'Unknown API error';
  const code =
    typeof e.error?.code === 'string'
      ? e.error.code
      : typeof e.code === 'string'
        ? e.code
        : undefined;

  const context = `baseURL=${config.baseURL}, model=${config.model}, key=${redactKey(config.apiKey)}`;
  if (status === 401) {
    return `DeepSeek auth failed (401). ${context}. Upstream: ${upstreamMessage}`;
  }
  return `DeepSeek request failed${status ? ` (status ${status})` : ''}. ${context}. Upstream: ${upstreamMessage}${code ? ` (code: ${code})` : ''}`;
}

export interface AIUsage {
  promptTokens: number;
  outputTokens: number;
}

export interface AICallResult<T> {
  data: T;
  usage: AIUsage;
  latencyMs: number;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export async function callDeepSeek<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T, any, any>,
  maxRetries = 2,
  onAttempt?: (attempt: number, totalAttempts: number) => void,
  onStreamChunk?: (
    chunk: string,
    accumulated: string,
    attempt: number,
    totalAttempts: number,
  ) => void,
): Promise<AICallResult<T>> {
  let lastError = '';
  const totalAttempts = maxRetries + 1;
  let config: DeepSeekRuntimeConfig;
  let client: OpenAI;
  try {
    config = readDeepSeekConfig();
    client = getClient(config);
  } catch (err) {
    throw new AICallError(err instanceof Error ? err.message : 'DeepSeek configuration error', 0, 0);
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const currentAttempt = attempt + 1;
    onAttempt?.(currentAttempt, totalAttempts);
    const start = Date.now();
    let content = '';
    let usage: AIUsage = {
      promptTokens: 0,
      outputTokens: 0,
    };

    try {
      const stream = await client.chat.completions.create({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content:
              attempt > 0
                ? `${userPrompt}\n\n[RETRY ATTEMPT ${attempt}] Previous error: ${lastError}. Please fix the JSON output.`
                : userPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 8192,
        temperature: 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          content += delta;
          onStreamChunk?.(delta, content, currentAttempt, totalAttempts);
        }

        const chunkUsage = (chunk as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
        if (chunkUsage) {
          usage = {
            promptTokens: chunkUsage.prompt_tokens ?? usage.promptTokens,
            outputTokens: chunkUsage.completion_tokens ?? usage.outputTokens,
          };
        }
      }
    } catch (err) {
      const latencyMs = Date.now() - start;
      lastError = formatApiError(err, config);
      if (attempt === maxRetries) {
        throw new AICallError(lastError, latencyMs, currentAttempt);
      }
      continue;
    }

    const latencyMs = Date.now() - start;
    if (usage.promptTokens <= 0) {
      usage.promptTokens = estimateTokens(systemPrompt) + estimateTokens(userPrompt);
    }
    if (usage.outputTokens <= 0) {
      usage.outputTokens = estimateTokens(content);
    }

    if (!content) {
      lastError = 'Empty AI response';
      if (attempt === maxRetries) {
        throw new AICallError(lastError, latencyMs, currentAttempt);
      }
      continue;
    }

    // JSON parse with retry on failure
    let jsonObj: unknown;
    try {
      jsonObj = JSON.parse(content);
    } catch (e) {
      lastError = `JSON parse failed: ${e instanceof Error ? e.message : 'unknown'}`;
      if (attempt === maxRetries) {
        throw new AICallError(lastError, latencyMs, currentAttempt);
      }
      continue;
    }

    // Zod validation
    const parsed = schema.safeParse(jsonObj);
    if (parsed.success) {
      return { data: parsed.data, usage, latencyMs };
    }

    lastError = `Zod validation: ${parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`;
    if (attempt === maxRetries) {
      throw new AICallError(lastError, latencyMs, currentAttempt);
    }
  }

  // Should not reach here
  throw new AICallError(lastError, 0, maxRetries + 1);
}

export class AICallError extends Error {
  constructor(
    message: string,
    public readonly latencyMs: number,
    public readonly attempts: number,
  ) {
    super(`AI call failed after ${attempts} attempts: ${message}`);
    this.name = 'AICallError';
  }
}

class DeepSeekConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeepSeekConfigError';
  }
}
