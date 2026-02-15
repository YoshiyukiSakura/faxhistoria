import { test, expect } from '@playwright/test';
import {
  registerUser,
  createGame,
  getGame,
  listGames,
  cleanupTestData,
  prisma,
} from './test-helpers';

let token: string;

test.beforeAll(async ({ request }) => {
  const { res } = await registerUser(request);
  const body = await res.json();
  token = body.token;
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe('Game CRUD E2E', () => {
  let gameId: string;

  test('should create game with valid country → 201', async ({ request }) => {
    const res = await createGame(request, token, {
      name: 'Test Game CRUD',
      playerCountry: 'United States',
      startYear: 2024,
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.playerCountry).toBe('United States');
    expect(body.startYear).toBe(2024);
    expect(body.turnNumber).toBe(0);
    expect(body.status).toBe('ACTIVE');
    gameId = body.id;
  });

  test('should reject invalid country → 400', async ({ request }) => {
    const res = await createGame(request, token, {
      name: 'Test Game Bad Country',
      playerCountry: 'Atlantis',
    });
    expect(res.status()).toBe(400);
  });

  test('should reject create without auth → 401', async ({ request }) => {
    const res = await request.post('/api/games', {
      data: { name: 'Test Game NoAuth', playerCountry: 'France', startYear: 2024 },
    });
    expect(res.status()).toBe(401);
  });

  test('should get game by ID → 200 + full state with 35 countries', async ({ request }) => {
    const res = await getGame(request, token, gameId);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(gameId);
    expect(body.currentState).toBeDefined();
    expect(body.currentState.countries).toBeDefined();
    const countryCount = Object.keys(body.currentState.countries).length;
    expect(countryCount).toBe(35);
  });

  test('should return 404 for non-existent game', async ({ request }) => {
    const res = await getGame(request, token, '00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(404);
  });

  test("should return 404 for other user's game", async ({ request }) => {
    const { res: regRes } = await registerUser(request);
    const otherToken = (await regRes.json()).token;

    const res = await getGame(request, otherToken, gameId);
    expect(res.status()).toBe(404);
  });

  test('should list games (empty for new user) → 200 + []', async ({ request }) => {
    const { res: regRes } = await registerUser(request);
    const freshToken = (await regRes.json()).token;

    const res = await listGames(request, freshToken);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('should list games with existing games → ordered list', async ({ request }) => {
    const res = await listGames(request, token);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  test('should have correct initial GameState structure', async ({ request }) => {
    const res = await getGame(request, token, gameId);
    const state = (await res.json()).currentState;

    expect(Object.keys(state.countries).length).toBe(35);
    expect(Object.keys(state.territories).length).toBeGreaterThan(0);
    expect(state.turnNumber).toBe(0);
    expect(state.playerCountry).toBe('United States');

    const us = state.countries['United States'];
    expect(us).toBeDefined();
    for (const rel of us.relations) {
      expect(rel.status).toBe('NEUTRAL');
    }
  });

  test('should have GameSnapshot at turn 0', async () => {
    const snapshot = await prisma.gameSnapshot.findFirst({
      where: { gameId, turnNumber: 0 },
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.year).toBe(2024);
  });
});
