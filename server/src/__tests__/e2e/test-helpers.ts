import { APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export const prisma = new PrismaClient();

let userCounter = 0;

export function uniqueEmail(): string {
  userCounter++;
  return `e2e-test-${Date.now()}-${userCounter}@test.local`;
}

export async function registerUser(
  request: APIRequestContext,
  overrides: { email?: string; password?: string; displayName?: string } = {},
) {
  const email = overrides.email || uniqueEmail();
  const password = overrides.password || 'TestPassword123!';
  const displayName = overrides.displayName || 'Test User';

  const res = await request.post('/api/auth/register', {
    data: { email, password, displayName },
  });

  return { res, email, password, displayName };
}

export async function loginUser(request: APIRequestContext, email: string, password: string) {
  return request.post('/api/auth/login', {
    data: { email, password },
  });
}

export async function createGame(
  request: APIRequestContext,
  token: string,
  overrides: { name?: string; playerCountry?: string; startYear?: number } = {},
) {
  return request.post('/api/games', {
    headers: { authorization: `Bearer ${token}` },
    data: {
      name: overrides.name || 'Test Game',
      playerCountry: overrides.playerCountry || 'United States',
      startYear: overrides.startYear || 2024,
    },
  });
}

export async function submitTurn(
  request: APIRequestContext,
  token: string,
  gameId: string,
  action: string,
  expectedTurnNumber: number,
  idempotencyKey?: string,
) {
  return request.post(`/api/games/${gameId}/turn`, {
    headers: {
      authorization: `Bearer ${token}`,
      'x-idempotency-key': idempotencyKey || uuidv4(),
    },
    data: { action, expectedTurnNumber },
    timeout: 240_000, // 4 min per AI call
  });
}

/**
 * Submit a turn with retry logic for transient AI failures (500s and timeouts).
 * On 500, the idempotency key is consumed (marked FAILED), so each retry uses a new key.
 * On timeout, we wait and retry since the AI endpoint may be temporarily overloaded.
 */
export async function submitTurnWithRetry(
  request: APIRequestContext,
  token: string,
  gameId: string,
  action: string,
  expectedTurnNumber: number,
  maxRetries = 2,
) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await submitTurn(request, token, gameId, action, expectedTurnNumber);
      if (res.status() !== 500) return res;
      // On 500 (AI failure), wait and retry with new idempotency key
    } catch (err) {
      lastError = err as Error;
      // Timeout or network error — wait and retry
    }
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  // Final attempt — let any error propagate
  return submitTurn(request, token, gameId, action, expectedTurnNumber);
}

export async function getGame(request: APIRequestContext, token: string, gameId: string) {
  return request.get(`/api/games/${gameId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

export async function listGames(request: APIRequestContext, token: string) {
  return request.get('/api/games', {
    headers: { authorization: `Bearer ${token}` },
  });
}

/**
 * Cleanup all e2e test data. Called after each test file.
 */
export async function cleanupTestData() {
  await prisma.modelRun.deleteMany({ where: { game: { name: { startsWith: 'Test Game' } } } });
  await prisma.turnEvent.deleteMany({ where: { turn: { game: { name: { startsWith: 'Test Game' } } } } });
  await prisma.turn.deleteMany({ where: { game: { name: { startsWith: 'Test Game' } } } });
  await prisma.idempotencyKey.deleteMany({ where: { game: { name: { startsWith: 'Test Game' } } } });
  await prisma.gameSnapshot.deleteMany({ where: { game: { name: { startsWith: 'Test Game' } } } });
  await prisma.game.deleteMany({ where: { name: { startsWith: 'Test Game' } } });
  await prisma.user.deleteMany({ where: { email: { contains: 'e2e-test-' } } });
}
