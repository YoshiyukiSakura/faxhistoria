import { test, expect } from '@playwright/test';
import { registerUser, createGame, getAdminStats, cleanupTestData } from './test-helpers';

const configuredAdminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe('Admin Stats E2E', () => {
  test('should reject admin stats request without token → 401', async ({ request }) => {
    const res = await request.get('/api/admin/stats');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });

  test('should return admin stats for allowed users', async ({ request }) => {
    const { res, email } = await registerUser(request, {
      displayName: 'Admin Stats User',
    });
    const token = (await res.json()).token as string;

    const gameRes = await createGame(request, token, {
      name: 'Test Game Admin Stats',
    });
    expect(gameRes.status()).toBe(201);

    const statsRes = await getAdminStats(request, token);
    const userIsAllowed = configuredAdminEmails.size === 0 || configuredAdminEmails.has(email.toLowerCase());

    if (!userIsAllowed) {
      expect(statsRes.status()).toBe(403);
      const forbidden = await statsRes.json();
      expect(forbidden.error).toBe('FORBIDDEN');
      return;
    }

    expect(statsRes.status()).toBe(200);
    const body = await statsRes.json();
    expect(body.generatedAt).toBeDefined();
    expect(typeof body.playerCount).toBe('number');
    expect(body.playerCount).toBeGreaterThanOrEqual(1);
    expect(typeof body.activePlayerCount).toBe('number');
    expect(body.activePlayerCount).toBeGreaterThanOrEqual(1);
    expect(typeof body.tokenUsage.totalModelRuns).toBe('number');
    expect(typeof body.tokenUsage.successfulModelRuns).toBe('number');
    expect(typeof body.tokenUsage.failedModelRuns).toBe('number');
    expect(typeof body.tokenUsage.promptTokens).toBe('number');
    expect(typeof body.tokenUsage.outputTokens).toBe('number');
    expect(typeof body.tokenUsage.totalTokens).toBe('number');
    expect(Array.isArray(body.players)).toBe(true);
    expect(body.players.length).toBeGreaterThanOrEqual(1);

    const createdPlayer = body.players.find((player: { email: string }) => player.email === email);
    expect(createdPlayer).toBeDefined();
    if (!createdPlayer) {
      throw new Error('Expected created player to be present in admin response');
    }
    expect(typeof createdPlayer.id).toBe('string');
    expect(typeof createdPlayer.displayName).toBe('string');
    expect(typeof createdPlayer.createdAt).toBe('string');
    expect(typeof createdPlayer.dailyApiCalls).toBe('number');
    expect(
      createdPlayer.lastCallDate === null || typeof createdPlayer.lastCallDate === 'string',
    ).toBeTruthy();
    expect(typeof createdPlayer.totalGames).toBe('number');
    expect(typeof createdPlayer.activeGames).toBe('number');
    expect(typeof createdPlayer.completedGames).toBe('number');
    expect(typeof createdPlayer.abandonedGames).toBe('number');
    expect(
      createdPlayer.latestGameAt === null || typeof createdPlayer.latestGameAt === 'string',
    ).toBeTruthy();
  });
});
