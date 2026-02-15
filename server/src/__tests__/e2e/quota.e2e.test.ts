import { test, expect } from '@playwright/test';
import {
  registerUser,
  createGame,
  submitTurnWithRetry,
  cleanupTestData,
  prisma,
} from './test-helpers';

let token: string;
let userId: string;

test.beforeAll(async ({ request }) => {
  const { res } = await registerUser(request);
  const body = await res.json();
  token = body.token;
  userId = body.user.id;
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe('Quota & Rate Limiting E2E', () => {
  test('should increment dailyApiCalls per turn', async ({ request }) => {
    test.slow(); // AI call can be slow
    const gameRes = await createGame(request, token, { name: 'Test Game Quota 1' });
    const gameId = (await gameRes.json()).id;

    const userBefore = await prisma.user.findUnique({ where: { id: userId } });
    const callsBefore = userBefore!.dailyApiCalls;

    const res = await submitTurnWithRetry(request, token, gameId, 'Invest in education', 0);
    expect(res.status()).toBe(200);

    const userAfter = await prisma.user.findUnique({ where: { id: userId } });
    expect(userAfter!.dailyApiCalls).toBe(callsBefore + 1);
  });

  test('should reset quota on new day', async ({ request }) => {
    test.slow(); // AI call can be slow
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);

    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyApiCalls: 999,
        lastCallDate: yesterday,
      },
    });

    const gameRes = await createGame(request, token, { name: 'Test Game Quota Reset' });
    const gameId = (await gameRes.json()).id;

    const res = await submitTurnWithRetry(request, token, gameId, 'Open trade negotiations', 0);
    expect(res.status()).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user!.dailyApiCalls).toBe(1);
  });

  test('should return 429 when daily limit reached', async ({ request }) => {
    const dailyLimit = parseInt(process.env.DAILY_API_LIMIT || '50', 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        dailyApiCalls: dailyLimit,
        lastCallDate: new Date(),
      },
    });

    const gameRes = await createGame(request, token, { name: 'Test Game Quota Limit' });
    const gameId = (await gameRes.json()).id;

    const res = await submitTurnWithRetry(request, token, gameId, 'Any action', 0);
    expect(res.status()).toBe(429);
  });
});
