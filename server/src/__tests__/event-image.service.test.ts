import type { WorldEvent } from '@faxhistoria/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { enrichEventsWithGeneratedImages } from '../services/ai/event-image.service';

const ORIGINAL_ENV = { ...process.env };

function buildNarrativeEvent(description: string): WorldEvent {
  return {
    type: 'NARRATIVE',
    description,
    involvedCountries: ['Japan'],
    date: '2024-01-01',
    economicEffects: [],
  };
}

describe('enrichEventsWithGeneratedImages', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns original events when endpoint is not configured', async () => {
    delete process.env.EVENT_IMAGE_ENDPOINT;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const input = [buildNarrativeEvent('Diplomatic statement was released.')];
    const output = await enrichEventsWithGeneratedImages(input, {
      year: 2025,
      playerAction: 'Issue a diplomatic warning',
    });

    expect(output).toEqual(input);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('normalizes relative image URLs with endpoint origin', async () => {
    process.env.EVENT_IMAGE_ENDPOINT = 'http://208.64.254.167:8013/api/generate';
    process.env.EVENT_IMAGE_ENABLED = 'true';

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ image_url: '/generated/evt.png' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const output = await enrichEventsWithGeneratedImages(
      [buildNarrativeEvent('A summit between leaders concludes with no treaty.')],
      {
        year: 2025,
        playerAction: 'Request emergency summit talks',
        gameId: 'g1',
        turnNumber: 3,
      },
    );

    expect(output[0].imageUrl).toBe('http://208.64.254.167:8013/generated/evt.png');
    expect(output[0].imagePrompt).toBeTypeOf('string');
    expect(output[0].imageSeed).toBeTypeOf('number');
  });

  it('maps local file paths to public URLs when configured', async () => {
    process.env.EVENT_IMAGE_ENDPOINT = 'http://127.0.0.1:8011/v1/images/generations';
    process.env.EVENT_IMAGE_ENABLED = 'true';
    process.env.EVENT_IMAGE_PUBLIC_BASE_URL = 'http://208.64.254.167:8013';
    process.env.EVENT_IMAGE_PUBLIC_PATH_PREFIX = '/generated';

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ url: '/home/admin/flux-images/flux2_abc.png' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const output = await enrichEventsWithGeneratedImages(
      [buildNarrativeEvent('Unexpected ceasefire discussions begin.')],
      {
        year: 2025,
        playerAction: 'Offer a conditional ceasefire framework',
        gameId: 'g2',
        turnNumber: 10,
      },
    );

    expect(output[0].imageUrl).toBe('http://208.64.254.167:8013/generated/flux2_abc.png');
  });

  it('does not block turn flow when image upstream fails', async () => {
    process.env.EVENT_IMAGE_ENDPOINT = 'http://127.0.0.1:8011/v1/images/generations';
    process.env.EVENT_IMAGE_ENABLED = 'true';

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response('bad gateway', {
        status: 502,
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const output = await enrichEventsWithGeneratedImages(
      [buildNarrativeEvent('Trade talks stalled after tariff dispute.')],
      {
        year: 2025,
        playerAction: 'Propose tariff freeze for 30 days',
        gameId: 'g3',
        turnNumber: 7,
      },
    );

    expect(output).toHaveLength(1);
    expect(output[0].imageUrl).toBeUndefined();
    expect(output[0].imagePrompt).toBeTypeOf('string');
    expect(output[0].imageSeed).toBeTypeOf('number');
  });

  it('uses stable deterministic seed for the same event context', async () => {
    process.env.EVENT_IMAGE_ENDPOINT = 'http://208.64.254.167:8013/api/generate';
    process.env.EVENT_IMAGE_ENABLED = 'true';

    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ image_url: '/generated/evt.png' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const event = buildNarrativeEvent('Same event should keep seed stable.');
    await enrichEventsWithGeneratedImages([event], {
      year: 2026,
      playerAction: 'Maintain regional deterrence posture',
      gameId: 'g-seed',
      turnNumber: 12,
    });
    await enrichEventsWithGeneratedImages([event], {
      year: 2026,
      playerAction: 'Maintain regional deterrence posture',
      gameId: 'g-seed',
      turnNumber: 12,
    });

    const firstBody = JSON.parse((fetchSpy.mock.calls[0][1]?.body as string) || '{}');
    const secondBody = JSON.parse((fetchSpy.mock.calls[1][1]?.body as string) || '{}');

    expect(firstBody.seed).toBeTypeOf('number');
    expect(firstBody.seed).toBe(secondBody.seed);
  });
});
