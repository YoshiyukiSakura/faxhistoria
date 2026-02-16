import { FastifyInstance } from 'fastify';
import { ImageProxyQuerySchema } from '@faxhistoria/shared';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_CACHE_CONTROL = 'public, max-age=600, stale-while-revalidate=3600';

interface ImageProxyConfig {
  allowedOrigins: Set<string>;
  timeoutMs: number;
  maxBytes: number;
}

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseOrigin(rawValue: string | undefined): string | null {
  const value = rawValue?.trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function parseAllowedOrigins(rawValue: string | undefined): Set<string> {
  const value = rawValue?.trim();
  if (!value) return new Set<string>();

  return value
    .split(',')
    .map((origin) => parseOrigin(origin))
    .filter((origin): origin is string => Boolean(origin))
    .reduce((set, origin) => {
      set.add(origin);
      return set;
    }, new Set<string>());
}

function readImageProxyConfig(): ImageProxyConfig {
  const explicitOrigins = parseAllowedOrigins(process.env.EVENT_IMAGE_PROXY_ALLOWED_ORIGINS);
  if (explicitOrigins.size > 0) {
    return {
      allowedOrigins: explicitOrigins,
      timeoutMs: parsePositiveInt(process.env.EVENT_IMAGE_PROXY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
      maxBytes: parsePositiveInt(process.env.EVENT_IMAGE_PROXY_MAX_BYTES, DEFAULT_MAX_BYTES),
    };
  }

  const fallbackOrigins = [parseOrigin(process.env.EVENT_IMAGE_PUBLIC_BASE_URL)];
  const endpointOrigin = parseOrigin(process.env.EVENT_IMAGE_ENDPOINT);
  if (endpointOrigin) fallbackOrigins.push(endpointOrigin);

  return {
    allowedOrigins: fallbackOrigins
      .filter((origin): origin is string => Boolean(origin))
      .reduce((set, origin) => {
        set.add(origin);
        return set;
      }, new Set<string>()),
    timeoutMs: parsePositiveInt(process.env.EVENT_IMAGE_PROXY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxBytes: parsePositiveInt(process.env.EVENT_IMAGE_PROXY_MAX_BYTES, DEFAULT_MAX_BYTES),
  };
}

export async function imageRoutes(fastify: FastifyInstance) {
  fastify.get('/api/images/proxy', {
    config: {
      rateLimit: {
        max: 120,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const parsed = ImageProxyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        statusCode: 400,
      });
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(parsed.data.url);
    } catch {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'url: Invalid URL',
        statusCode: 400,
      });
    }

    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'url: Only http/https URLs are supported',
        statusCode: 400,
      });
    }

    const config = readImageProxyConfig();
    if (config.allowedOrigins.size === 0) {
      return reply.status(503).send({
        error: 'IMAGE_PROXY_UNAVAILABLE',
        message: 'Image proxy is not configured',
        statusCode: 503,
      });
    }

    if (!config.allowedOrigins.has(targetUrl.origin)) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Image origin is not allowed',
        statusCode: 403,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const upstream = await fetch(targetUrl.toString(), {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
      });

      if (!upstream.ok) {
        const statusCode = upstream.status === 404 ? 404 : 502;
        return reply.status(statusCode).send({
          error: 'IMAGE_PROXY_FAILED',
          message: `Image upstream returned status ${upstream.status}`,
          statusCode,
        });
      }

      const contentType = upstream.headers.get('content-type')?.trim() || 'application/octet-stream';
      if (!contentType.toLowerCase().startsWith('image/')) {
        return reply.status(415).send({
          error: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Upstream response is not an image',
          statusCode: 415,
        });
      }

      const declaredLength = Number.parseInt(upstream.headers.get('content-length') || '', 10);
      if (Number.isFinite(declaredLength) && declaredLength > config.maxBytes) {
        return reply.status(413).send({
          error: 'PAYLOAD_TOO_LARGE',
          message: 'Image exceeds proxy size limit',
          statusCode: 413,
        });
      }

      const bytes = Buffer.from(await upstream.arrayBuffer());
      if (bytes.byteLength > config.maxBytes) {
        return reply.status(413).send({
          error: 'PAYLOAD_TOO_LARGE',
          message: 'Image exceeds proxy size limit',
          statusCode: 413,
        });
      }

      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', DEFAULT_CACHE_CONTROL);
      reply.header('X-Content-Type-Options', 'nosniff');
      return reply.status(200).send(bytes);
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      return reply.status(isTimeout ? 504 : 502).send({
        error: 'IMAGE_PROXY_FAILED',
        message: isTimeout ? 'Image proxy upstream timed out' : 'Image proxy request failed',
        statusCode: isTimeout ? 504 : 502,
      });
    } finally {
      clearTimeout(timeout);
    }
  });
}
