import { basename } from 'path';
import { createHash } from 'crypto';
import type { WorldEvent } from '@faxhistoria/shared';

const DEFAULT_IMAGE_SIZE = '384x384';
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_PROMPT_LENGTH = 700;
const DEFAULT_PUBLIC_PATH_PREFIX = '/generated';
const DEFAULT_SEED_SALT = 'faxhistoria-event-image-v1';
const MAX_SEED = 2_147_483_647;

interface EventImageRuntimeConfig {
  enabled: boolean;
  endpoint: string;
  endpointOrigin: string;
  timeoutMs: number;
  size: string;
  model?: string;
  apiKey?: string;
  publicBaseURL?: string;
  publicPathPrefix: string;
  maxPromptLength: number;
  deterministicSeed: boolean;
  seedSalt: string;
}

export interface EventImageContext {
  year: number;
  playerAction: string;
  gameId?: string;
  turnNumber?: number;
}

export interface EventImageProgress {
  sequence: number;
  total: number;
  success: boolean;
  skipped: boolean;
  seed: number;
  imageUrl?: string;
}

export interface EnrichEventsWithImagesOptions {
  onProgress?: (progress: EventImageProgress) => void;
}

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeBaseURL(rawValue: string | undefined): string | undefined {
  const value = rawValue?.trim();
  if (!value) return undefined;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizePublicPathPrefix(rawValue: string | undefined): string {
  const value = rawValue?.trim();
  if (!value) return DEFAULT_PUBLIC_PATH_PREFIX;
  if (!value.startsWith('/')) return `/${value}`;
  return value;
}

function parseBoolean(rawValue: string | undefined, fallback: boolean): boolean {
  if (!rawValue) return fallback;
  const value = rawValue.trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function readEventImageConfig(): EventImageRuntimeConfig {
  const endpoint = (process.env.EVENT_IMAGE_ENDPOINT || '').trim();
  const enabledFlag = (process.env.EVENT_IMAGE_ENABLED || 'true').trim().toLowerCase();
  const enabled = enabledFlag !== 'false' && endpoint.length > 0;

  if (!enabled) {
    return {
      enabled: false,
      endpoint: '',
      endpointOrigin: '',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      size: DEFAULT_IMAGE_SIZE,
      publicPathPrefix: DEFAULT_PUBLIC_PATH_PREFIX,
      maxPromptLength: DEFAULT_MAX_PROMPT_LENGTH,
      deterministicSeed: true,
      seedSalt: DEFAULT_SEED_SALT,
    };
  }

  let endpointOrigin = '';
  try {
    endpointOrigin = new URL(endpoint).origin;
  } catch {
    console.warn(`[event-image] invalid EVENT_IMAGE_ENDPOINT: "${endpoint}", disabling generation`);
    return {
      enabled: false,
      endpoint: '',
      endpointOrigin: '',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      size: DEFAULT_IMAGE_SIZE,
      publicPathPrefix: DEFAULT_PUBLIC_PATH_PREFIX,
      maxPromptLength: DEFAULT_MAX_PROMPT_LENGTH,
      deterministicSeed: true,
      seedSalt: DEFAULT_SEED_SALT,
    };
  }

  const apiKey = (process.env.EVENT_IMAGE_API_KEY || '').trim();
  return {
    enabled: true,
    endpoint,
    endpointOrigin,
    timeoutMs: parsePositiveInt(process.env.EVENT_IMAGE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    size: (process.env.EVENT_IMAGE_SIZE || DEFAULT_IMAGE_SIZE).trim() || DEFAULT_IMAGE_SIZE,
    model: (process.env.EVENT_IMAGE_MODEL || '').trim() || undefined,
    apiKey: apiKey || undefined,
    publicBaseURL: normalizeBaseURL(process.env.EVENT_IMAGE_PUBLIC_BASE_URL),
    publicPathPrefix: normalizePublicPathPrefix(process.env.EVENT_IMAGE_PUBLIC_PATH_PREFIX),
    maxPromptLength: parsePositiveInt(process.env.EVENT_IMAGE_PROMPT_MAX_LENGTH, DEFAULT_MAX_PROMPT_LENGTH),
    deterministicSeed: parseBoolean(process.env.EVENT_IMAGE_DETERMINISTIC_SEED, true),
    seedSalt: (process.env.EVENT_IMAGE_SEED_SALT || DEFAULT_SEED_SALT).trim() || DEFAULT_SEED_SALT,
  };
}

function makeEventImagePrompt(event: WorldEvent, context: EventImageContext, maxLength: number): string {
  const countriesText =
    event.involvedCountries.length > 0
      ? `Countries involved: ${event.involvedCountries.join(', ')}.`
      : 'No specific country focus.';

  const normalizedAction = context.playerAction.replace(/\s+/g, ' ').trim();
  const normalizedDescription = event.description.replace(/\s+/g, ' ').trim();
  const prompt = [
    `Year ${context.year}.`,
    `Geopolitical simulation event illustration.`,
    `Event type: ${event.type}.`,
    `Event description: ${normalizedDescription}.`,
    countriesText,
    `Player strategic action context: ${normalizedAction}.`,
    'Cinematic realism, documentary style, dramatic lighting, no text, no watermark, no logo.',
  ].join(' ');

  if (prompt.length <= maxLength) return prompt;
  return `${prompt.slice(0, maxLength - 3)}...`;
}

function toAbsoluteUrl(rawUrl: string, baseURL: string): string | null {
  try {
    return new URL(rawUrl, baseURL).toString();
  } catch {
    return null;
  }
}

function normalizeImageUrl(rawUrl: string, config: EventImageRuntimeConfig): string | null {
  const value = rawUrl.trim();
  if (!value) return null;

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  // Local file path from raw FLUX endpoint. Map filename to a public serving prefix.
  if (value.startsWith('/home/') || value.startsWith('/Users/')) {
    if (!config.publicBaseURL) return null;
    const filename = basename(value);
    return toAbsoluteUrl(`${config.publicPathPrefix}/${filename}`, config.publicBaseURL);
  }

  if (value.startsWith('/')) {
    return toAbsoluteUrl(value, config.publicBaseURL || config.endpointOrigin);
  }

  return toAbsoluteUrl(value, config.publicBaseURL || config.endpointOrigin);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractImageUrl(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) return null;

  const topLevelImageUrl = record.image_url;
  if (typeof topLevelImageUrl === 'string') {
    return topLevelImageUrl;
  }

  const data = record.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = asRecord(data[0]);
  if (!first) return null;
  return typeof first.url === 'string' ? first.url : null;
}

function withEventImage(
  event: WorldEvent,
  imagePrompt: string,
  imageSeed: number,
  imageUrl?: string,
): WorldEvent {
  if (!imageUrl) {
    return {
      ...event,
      imagePrompt,
      imageSeed,
    };
  }
  return {
    ...event,
    imagePrompt,
    imageSeed,
    imageUrl,
  };
}

function makeDeterministicSeed(
  event: WorldEvent,
  sequence: number,
  context: EventImageContext,
  seedSalt: string,
): number {
  const basis = [
    seedSalt,
    context.gameId || 'game',
    String(context.turnNumber ?? context.year),
    String(context.year),
    String(sequence),
    event.type,
    event.description,
    event.involvedCountries.join('|'),
    context.playerAction,
  ].join('||');

  const hex = createHash('sha256').update(basis).digest('hex').slice(0, 8);
  const parsed = Number.parseInt(hex, 16);
  return parsed % MAX_SEED;
}

async function generateSingleEventImage(
  event: WorldEvent,
  sequence: number,
  context: EventImageContext,
  config: EventImageRuntimeConfig,
): Promise<WorldEvent> {
  const imagePrompt = makeEventImagePrompt(event, context, config.maxPromptLength);
  const imageSeed = config.deterministicSeed
    ? makeDeterministicSeed(event, sequence, context, config.seedSalt)
    : Math.floor(Math.random() * MAX_SEED);
  const body: Record<string, unknown> = {
    prompt: imagePrompt,
    size: config.size,
    seed: imageSeed,
  };
  if (config.model) {
    body.model = config.model;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, config.timeoutMs);

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[event-image] upstream failed (${response.status}) for event ${event.type}`);
      return withEventImage(event, imagePrompt, imageSeed);
    }

    const payload = (await response.json()) as unknown;
    const rawImageUrl = extractImageUrl(payload);
    if (!rawImageUrl) {
      console.warn(`[event-image] upstream did not return a URL for event ${event.type}`);
      return withEventImage(event, imagePrompt, imageSeed);
    }

    const normalizedImageUrl = normalizeImageUrl(rawImageUrl, config);
    if (!normalizedImageUrl) {
      console.warn(`[event-image] could not normalize image URL "${rawImageUrl}"`);
      return withEventImage(event, imagePrompt, imageSeed);
    }

    return withEventImage(event, imagePrompt, imageSeed, normalizedImageUrl);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error';
    console.warn(`[event-image] request failed for event ${event.type}: ${reason}`);
    return withEventImage(event, imagePrompt, imageSeed);
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichEventsWithGeneratedImages(
  events: WorldEvent[],
  context: EventImageContext,
  options: EnrichEventsWithImagesOptions = {},
): Promise<WorldEvent[]> {
  if (events.length === 0) return events;
  const config = readEventImageConfig();
  if (!config.enabled) return events;

  const output: WorldEvent[] = [];
  for (let i = 0; i < events.length; i++) {
    const sequence = i + 1;
    const enriched = await generateSingleEventImage(events[i], sequence, context, config);
    output.push(enriched);
    options.onProgress?.({
      sequence,
      total: events.length,
      success: Boolean(enriched.imageUrl),
      skipped: !enriched.imageUrl,
      seed: enriched.imageSeed ?? 0,
      imageUrl: enriched.imageUrl,
    });
  }
  return output;
}
