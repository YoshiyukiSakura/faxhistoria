import OpenAI from 'openai';
import { z } from 'zod';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
});

export interface AIUsage {
  promptTokens: number;
  outputTokens: number;
}

export interface AICallResult<T> {
  data: T;
  usage: AIUsage;
  latencyMs: number;
}

export async function callDeepSeek<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  maxRetries = 2,
): Promise<AICallResult<T>> {
  let lastError = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const start = Date.now();
    let response: OpenAI.Chat.Completions.ChatCompletion;

    try {
      response = await client.chat.completions.create({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
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
      });
    } catch (err) {
      const latencyMs = Date.now() - start;
      lastError = err instanceof Error ? err.message : 'Unknown API error';
      if (attempt === maxRetries) {
        throw new AICallError(lastError, latencyMs, attempt + 1);
      }
      continue;
    }

    const latencyMs = Date.now() - start;
    const content = response.choices[0]?.message?.content;
    const usage: AIUsage = {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };

    if (!content) {
      lastError = 'Empty AI response';
      if (attempt === maxRetries) {
        throw new AICallError(lastError, latencyMs, attempt + 1);
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
        throw new AICallError(lastError, latencyMs, attempt + 1);
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
      throw new AICallError(lastError, latencyMs, attempt + 1);
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
