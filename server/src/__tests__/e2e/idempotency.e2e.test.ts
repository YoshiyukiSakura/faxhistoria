import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { registerUser, createGame, getGame, submitTurnWithRetry, cleanupTestData } from './test-helpers';

test.describe.configure({ mode: 'serial' });

let token: string;
let gameId: string;
let firstTurnOk = false;

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
  test('should complete first turn successfully', async ({ request }) => {
    test.slow();
    // Use retry helper for the first AI call
    const res = await submitTurnWithRetry(request, token, gameId, 'Build a new trade route with Japan', 0);
    expect(res.status()).toBe(200);
    firstTurnOk = true;
  });

  test('should return cached result for same idempotency key', async ({ request }) => {
    test.slow();
    test.skip(!firstTurnOk, 'First turn did not succeed');

    const key = uuidv4();

    // First request with explicit key
    const res1 = await request.post(`/api/games/${gameId}/turn`, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-idempotency-key': key,
      },
      data: { action: 'Invest in renewable energy', expectedTurnNumber: 1 },
      timeout: 240_000,
    });
    expect(res1.status()).toBe(200);
    const body1 = await res1.json();

    // Second request with SAME key — should return cached result
    const res2 = await request.post(`/api/games/${gameId}/turn`, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-idempotency-key': key,
      },
      data: { action: 'Invest in renewable energy', expectedTurnNumber: 1 },
      timeout: 30_000, // should be fast — cached
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
    test.skip(!firstTurnOk, 'First turn did not succeed');
    const res = await getGame(request, token, gameId);
    const game = await res.json();
    // After 2 turns, turnNumber should be 2
    expect(game.turnNumber).toBe(2);
  });

  test('should reject stale expectedTurnNumber after turn advanced → 409', async ({ request }) => {
    test.skip(!firstTurnOk, 'First turn did not succeed');
    const key = uuidv4();
    const res = await request.post(`/api/games/${gameId}/turn`, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-idempotency-key': key,
      },
      data: { action: 'Any action', expectedTurnNumber: 0 },
    });
    expect(res.status()).toBe(409);
  });
});
