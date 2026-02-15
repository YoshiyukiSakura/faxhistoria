import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { registerUser, createGame, getGame, cleanupTestData } from './test-helpers';

let token: string;
let gameId: string;

test.beforeAll(async ({ request }) => {
  const { res } = await registerUser(request);
  token = (await res.json()).token;

  const gameRes = await createGame(request, token, { name: 'Test Game Idempotency' });
  gameId = (await gameRes.json()).id;
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe('Idempotency E2E', () => {
  test('should return cached result for same idempotency key', async ({ request }) => {
    const key = uuidv4();

    // First request
    const res1 = await request.post(`/api/games/${gameId}/turn`, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-idempotency-key': key,
      },
      data: { action: 'Build a new trade route with Japan', expectedTurnNumber: 0 },
    });
    expect(res1.status()).toBe(200);
    const body1 = await res1.json();

    // Second request with same key
    const res2 = await request.post(`/api/games/${gameId}/turn`, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-idempotency-key': key,
      },
      data: { action: 'Build a new trade route with Japan', expectedTurnNumber: 0 },
    });
    expect(res2.status()).toBe(200);
    const body2 = await res2.json();

    // Should be identical
    expect(body2.turnId).toBe(body1.turnId);
    expect(body2.turnNumber).toBe(body1.turnNumber);
    expect(body2.stateVersion).toBe(body1.stateVersion);
    expect(body2.events.length).toBe(body1.events.length);
  });

  test('should not advance turn twice with same key', async ({ request }) => {
    const res = await getGame(request, token, gameId);
    const game = await res.json();
    expect(game.turnNumber).toBe(1);
  });

  test('should reject stale expectedTurnNumber after turn advanced → 409', async ({ request }) => {
    // Current turn is 1. Submit turn 1 with a new key first.
    const key1 = uuidv4();
    const res1 = await request.post(`/api/games/${gameId}/turn`, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-idempotency-key': key1,
      },
      data: { action: 'Invest in renewable energy', expectedTurnNumber: 1 },
    });
    expect(res1.status()).toBe(200);

    // Now turn is 2. Try submitting with expectedTurnNumber=1 again (different key) → 409
    const key2 = uuidv4();
    const res2 = await request.post(`/api/games/${gameId}/turn`, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-idempotency-key': key2,
      },
      data: { action: 'Invest in renewable energy', expectedTurnNumber: 1 },
    });
    expect(res2.status()).toBe(409);
  });
});
