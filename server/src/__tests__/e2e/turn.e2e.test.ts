import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
  registerUser,
  createGame,
  submitTurn,
  getGame,
  cleanupTestData,
  prisma,
} from './test-helpers';

const VALID_EVENT_TYPES = [
  'ALLIANCE',
  'ANNEXATION',
  'TRADE_DEAL',
  'WAR',
  'PEACE',
  'NARRATIVE',
  'ECONOMIC_SHIFT',
  'NARRATIVE_FALLBACK',
];

let token: string;
let gameId: string;

test.beforeAll(async ({ request }) => {
  const { res } = await registerUser(request);
  token = (await res.json()).token;

  const gameRes = await createGame(request, token, { name: 'Test Game Turn' });
  gameId = (await gameRes.json()).id;
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe('Turn Processing E2E (with real AI)', () => {
  test('should submit turn with valid action → 200 + TurnResponse', async ({ request }) => {
    const res = await submitTurn(request, token, gameId, 'Increase military spending by 10%', 0);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.turnId).toBeDefined();
    expect(body.turnNumber).toBe(1);
    expect(body.year).toBe(2025);
    expect(body.events).toBeDefined();
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.worldNarrative).toBeDefined();
    expect(body.yearSummary).toBeDefined();
    expect(body.stateVersion).toBe(1);
  });

  test('should have 1-10 events', async ({ request }) => {
    const res = await getGame(request, token, gameId);
    const game = await res.json();
    const latestTurn = game.turns[0];
    expect(latestTurn.events.length).toBeGreaterThanOrEqual(1);
    expect(latestTurn.events.length).toBeLessThanOrEqual(10);
  });

  test('should have valid event types', async ({ request }) => {
    const res = await getGame(request, token, gameId);
    const game = await res.json();
    const latestTurn = game.turns[0];
    for (const event of latestTurn.events) {
      expect(VALID_EVENT_TYPES).toContain(event.eventType);
    }
  });

  test('should have incremented turnNumber and year', async ({ request }) => {
    const res = await getGame(request, token, gameId);
    const game = await res.json();
    expect(game.turnNumber).toBe(1);
    expect(game.currentYear).toBe(2025);
  });

  test('should have created Turn record in DB', async () => {
    const turn = await prisma.turn.findFirst({
      where: { gameId, turnNumber: 1 },
    });
    expect(turn).not.toBeNull();
    expect(turn!.status).toBe('COMPLETED');
    expect(turn!.playerAction).toBe('Increase military spending by 10%');
  });

  test('should have created TurnEvent records', async () => {
    const turn = await prisma.turn.findFirst({
      where: { gameId, turnNumber: 1 },
      include: { events: true },
    });
    expect(turn!.events.length).toBeGreaterThanOrEqual(1);
  });

  test('should have created ModelRun record with token counts', async () => {
    const modelRun = await prisma.modelRun.findFirst({
      where: { gameId },
    });
    expect(modelRun).not.toBeNull();
    expect(modelRun!.model).toBe(process.env.DEEPSEEK_MODEL || 'deepseek-chat');
    expect(modelRun!.promptTokens).toBeGreaterThan(0);
    expect(modelRun!.outputTokens).toBeGreaterThan(0);
    expect(modelRun!.latencyMs).toBeGreaterThan(0);
    expect(modelRun!.success).toBe(true);
  });

  test('should reject turn without X-Idempotency-Key header → 400', async ({ request }) => {
    const res = await request.post(`/api/games/${gameId}/turn`, {
      headers: { authorization: `Bearer ${token}` },
      data: { action: 'Test action', expectedTurnNumber: 1 },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('MISSING_HEADER');
  });

  test('should reject wrong expectedTurnNumber → 409', async ({ request }) => {
    const res = await submitTurn(request, token, gameId, 'Some action', 999);
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.currentTurnNumber).toBeDefined();
  });

  test('should reject turn for non-existent game → 404', async ({ request }) => {
    const res = await submitTurn(
      request,
      token,
      '00000000-0000-0000-0000-000000000000',
      'Some action',
      0,
    );
    expect(res.status()).toBe(404);
  });

  test('should reject turn without auth → 401', async ({ request }) => {
    const res = await request.post(`/api/games/${gameId}/turn`, {
      headers: { 'x-idempotency-key': uuidv4() },
      data: { action: 'Test action', expectedTurnNumber: 0 },
    });
    expect(res.status()).toBe(401);
  });
});
