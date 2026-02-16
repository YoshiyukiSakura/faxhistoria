import { createServer, type Server } from 'node:http';
import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { imageRoutes } from '../routes/image';

const ORIGINAL_PROXY_ALLOWED_ORIGINS = process.env.EVENT_IMAGE_PROXY_ALLOWED_ORIGINS;
const ORIGINAL_PROXY_TIMEOUT_MS = process.env.EVENT_IMAGE_PROXY_TIMEOUT_MS;
const ORIGINAL_PROXY_MAX_BYTES = process.env.EVENT_IMAGE_PROXY_MAX_BYTES;

async function startFixtureServer(handler: (url: string) => { status: number; type: string; body: string }) {
  const server = createServer((request, response) => {
    const { status, type, body } = handler(request.url || '/');
    response.writeHead(status, {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=60',
    });
    response.end(body);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind fixture server');
  }

  return {
    server,
    origin: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve(undefined);
    });
  });
}

describe('imageRoutes', () => {
  afterEach(async () => {
    process.env.EVENT_IMAGE_PROXY_ALLOWED_ORIGINS = ORIGINAL_PROXY_ALLOWED_ORIGINS;
    process.env.EVENT_IMAGE_PROXY_TIMEOUT_MS = ORIGINAL_PROXY_TIMEOUT_MS;
    process.env.EVENT_IMAGE_PROXY_MAX_BYTES = ORIGINAL_PROXY_MAX_BYTES;
  });

  it('proxies an allowed image origin', async () => {
    const fixture = await startFixtureServer((url) => {
      if (url === '/generated/example.png') {
        return { status: 200, type: 'image/png', body: 'fake-image' };
      }
      return { status: 404, type: 'text/plain', body: 'not found' };
    });
    process.env.EVENT_IMAGE_PROXY_ALLOWED_ORIGINS = fixture.origin;

    const app = Fastify();
    await app.register(imageRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/api/images/proxy',
      query: {
        url: `${fixture.origin}/generated/example.png`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.body).toBe('fake-image');

    await app.close();
    await closeServer(fixture.server);
  });

  it('rejects non-allowlisted origins', async () => {
    process.env.EVENT_IMAGE_PROXY_ALLOWED_ORIGINS = 'http://127.0.0.1:12345';

    const app = Fastify();
    await app.register(imageRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/api/images/proxy',
      query: {
        url: 'http://example.com/blocked.png',
      },
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });

  it('rejects non-image upstream content', async () => {
    const fixture = await startFixtureServer((url) => {
      if (url === '/generated/text.txt') {
        return { status: 200, type: 'text/plain', body: 'plain text' };
      }
      return { status: 404, type: 'text/plain', body: 'not found' };
    });
    process.env.EVENT_IMAGE_PROXY_ALLOWED_ORIGINS = fixture.origin;

    const app = Fastify();
    await app.register(imageRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/api/images/proxy',
      query: {
        url: `${fixture.origin}/generated/text.txt`,
      },
    });

    expect(response.statusCode).toBe(415);

    await app.close();
    await closeServer(fixture.server);
  });
});
