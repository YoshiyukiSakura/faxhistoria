import { test, expect } from '@playwright/test';
import { registerUser, loginUser, cleanupTestData } from './test-helpers';

const testEmail = `e2e-test-auth-${Date.now()}@test.local`;
const testPassword = 'ValidPass123!';

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe('Auth E2E', () => {
  test('should register a new user → 201 + token + user', async ({ request }) => {
    const { res } = await registerUser(request, {
      email: testEmail,
      password: testPassword,
      displayName: 'Auth Test User',
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(testEmail);
  });

  test('should reject duplicate email → 409', async ({ request }) => {
    const { res } = await registerUser(request, {
      email: testEmail,
      password: testPassword,
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('CONFLICT');
  });

  test('should reject invalid email → 400', async ({ request }) => {
    const { res } = await registerUser(request, {
      email: 'not-an-email',
      password: testPassword,
    });
    expect(res.status()).toBe(400);
  });

  test('should reject short password → 400', async ({ request }) => {
    const { res } = await registerUser(request, {
      password: '12345',
    });
    expect(res.status()).toBe(400);
  });

  test('should login with correct credentials → 200 + token', async ({ request }) => {
    const res = await loginUser(request, testEmail, testPassword);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe(testEmail);
  });

  test('should reject wrong password → 401', async ({ request }) => {
    const res = await loginUser(request, testEmail, 'WrongPassword!');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });

  test('should reject non-existent email → 401', async ({ request }) => {
    const res = await loginUser(request, 'nonexistent@test.local', testPassword);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });

  test('should create guest account → 201 + token + guest user', async ({ request }) => {
    const res = await request.post('/api/auth/guest', { data: {} });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    expect(body.user.email).toContain('@guest.faxhistoria.local');
    expect(body.user.displayName).toContain('Guest-');
  });

  test('should reject protected route without token → 401', async ({ request }) => {
    const res = await request.get('/api/games');
    expect(res.status()).toBe(401);
  });

  test('should reject protected route with invalid token → 401', async ({ request }) => {
    const res = await request.get('/api/games', {
      headers: { authorization: 'Bearer invalid-token-abc123' },
    });
    expect(res.status()).toBe(401);
  });
});
