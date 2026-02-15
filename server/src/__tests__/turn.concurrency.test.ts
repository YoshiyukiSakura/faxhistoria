import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Concurrency unit tests for turn.service.ts.
 * Fully mocked — no DB or AI dependency.
 */

vi.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    idempotencyKey: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../services/ai/ai-service', () => ({
  runSimulation: vi.fn(),
}));

vi.mock('../services/state.service', () => ({
  applyEvents: vi.fn((state: any) => ({ ...state })),
}));

// Import after mocks are set up
import { processTurn } from '../services/turn.service';
import { prisma } from '../lib/prisma';

describe('Turn concurrency (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns IN_PROGRESS (409) when lease is still active', async () => {
    const futureDate = new Date(Date.now() + 300_000);

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      return cb({
        idempotencyKey: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'key-1',
            status: 'IN_PROGRESS',
            leaseExpiresAt: futureDate,
            cachedResult: null,
          }),
        },
        $queryRaw: vi.fn(),
        user: { findUnique: vi.fn(), update: vi.fn() },
      });
    });

    await expect(
      processTurn({
        gameId: 'game-1',
        userId: 'user-1',
        action: 'test',
        expectedTurnNumber: 0,
        idempotencyKey: 'key-abc',
      }),
    ).rejects.toThrow('Request is already being processed');
  });

  it('returns FAILED when lease has expired', async () => {
    const pastDate = new Date(Date.now() - 300_000);

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      return cb({
        idempotencyKey: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'key-1',
            status: 'IN_PROGRESS',
            leaseExpiresAt: pastDate,
            cachedResult: null,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        $queryRaw: vi.fn(),
        user: { findUnique: vi.fn(), update: vi.fn() },
      });
    });

    await expect(
      processTurn({
        gameId: 'game-1',
        userId: 'user-1',
        action: 'test',
        expectedTurnNumber: 0,
        idempotencyKey: 'key-abc',
      }),
    ).rejects.toThrow('This request previously failed');
  });

  it('returns cached result for COMPLETED idempotency key', async () => {
    const cachedResponse = {
      turnId: 'turn-1',
      turnNumber: 1,
      year: 2025,
      events: [],
      worldNarrative: 'cached',
      yearSummary: 'cached',
      stateVersion: 1,
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      return cb({
        idempotencyKey: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'key-1',
            status: 'COMPLETED',
            cachedResult: cachedResponse,
          }),
        },
        $queryRaw: vi.fn(),
        user: { findUnique: vi.fn(), update: vi.fn() },
      });
    });

    const result = await processTurn({
      gameId: 'game-1',
      userId: 'user-1',
      action: 'test',
      expectedTurnNumber: 0,
      idempotencyKey: 'key-abc',
    });

    expect(result).toEqual(cachedResponse);
  });

  it('returns 409 on turn number mismatch', async () => {
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      return cb({
        idempotencyKey: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({}),
        },
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: 'game-1',
            userId: 'user-1',
            status: 'ACTIVE',
            turnNumber: 5,
            totalTokensUsed: 0,
            currentState: {},
          },
        ]),
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'user-1',
            dailyApiCalls: 0,
            lastCallDate: null,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      });
    });

    await expect(
      processTurn({
        gameId: 'game-1',
        userId: 'user-1',
        action: 'test',
        expectedTurnNumber: 0,
        idempotencyKey: 'key-abc',
      }),
    ).rejects.toThrow('Turn number mismatch');
  });
});
