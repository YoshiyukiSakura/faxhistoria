import { prisma } from '../lib/prisma';
import type { GameState, WorldEvent, TurnResponse } from '@faxhistoria/shared';
import { runSimulation } from './ai/ai-service';
import { applyEvents } from './state.service';

const DAILY_API_LIMIT = parseInt(process.env.DAILY_API_LIMIT || '50', 10);
const GAME_TOKEN_LIMIT = parseInt(process.env.GAME_TOKEN_LIMIT || '500000', 10);
const LEASE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes - P0 fix: IN_PROGRESS lease timeout

interface ProcessTurnInput {
  gameId: string;
  userId: string;
  action: string;
  expectedTurnNumber: number;
  idempotencyKey: string;
}

export async function processTurn(input: ProcessTurnInput): Promise<TurnResponse> {
  const { gameId, userId, action, expectedTurnNumber, idempotencyKey } = input;

  // ═══ Phase A: Short Transaction - Idempotency + Quota + Validation ═══
  const phaseAResult = await prisma.$transaction(async (tx) => {
    // 1. Check idempotency key FIRST (before any quota changes)
    const existingKey = await tx.idempotencyKey.findUnique({
      where: { gameId_key: { gameId, key: idempotencyKey } },
    });

    if (existingKey) {
      if (existingKey.status === 'COMPLETED' && existingKey.cachedResult) {
        return { type: 'IDEMPOTENT_HIT' as const, cachedResult: existingKey.cachedResult as TurnResponse };
      }
      if (existingKey.status === 'IN_PROGRESS') {
        // P0 fix: Check lease expiration
        const now = new Date();
        if (existingKey.leaseExpiresAt && existingKey.leaseExpiresAt > now) {
          return { type: 'IN_PROGRESS' as const };
        }
        // Lease expired - take over: delete the stale key and continue as new
        await tx.idempotencyKey.delete({
          where: { id: existingKey.id },
        });
        // Fall through to create new key below
      }
      if (existingKey.status === 'FAILED') {
        return { type: 'FAILED' as const };
      }
    }

    // 2. Lock and validate game
    const game = await tx.game.findFirst({
      where: { id: gameId, userId },
    });
    if (!game) {
      throw new TurnError('Game not found', 404);
    }
    if (game.status !== 'ACTIVE') {
      throw new TurnError('Game is not active', 400);
    }

    // 3. P0 fix: Validate expectedTurnNumber BEFORE quota decrement
    if (expectedTurnNumber !== game.turnNumber) {
      return {
        type: 'TURN_MISMATCH' as const,
        currentTurnNumber: game.turnNumber,
      };
    }

    // 4. Check game token limit
    if (game.totalTokensUsed >= GAME_TOKEN_LIMIT) {
      throw new TurnError('Game token limit exceeded', 429);
    }

    // 5. P0 fix: Only NOW decrement daily quota (after all validations pass)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new TurnError('User not found', 404);

    const lastDate = user.lastCallDate ? new Date(user.lastCallDate) : null;
    const isNewDay = !lastDate || lastDate < today;
    const currentCalls = isNewDay ? 0 : user.dailyApiCalls;

    if (currentCalls >= DAILY_API_LIMIT) {
      throw new TurnError('Daily API limit exceeded', 429);
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        dailyApiCalls: isNewDay ? 1 : { increment: 1 },
        lastCallDate: new Date(),
      },
    });

    // 6. Create idempotency key with lease timeout
    await tx.idempotencyKey.create({
      data: {
        gameId,
        key: idempotencyKey,
        status: 'IN_PROGRESS',
        leaseExpiresAt: new Date(Date.now() + LEASE_TIMEOUT_MS),
      },
    });

    return {
      type: 'PROCEED' as const,
      gameState: game.currentState as unknown as GameState,
      totalTokensUsed: game.totalTokensUsed,
      turnNumber: game.turnNumber,
    };
  });

  // Handle Phase A results
  if (phaseAResult.type === 'IDEMPOTENT_HIT') {
    return phaseAResult.cachedResult;
  }
  if (phaseAResult.type === 'IN_PROGRESS') {
    throw new TurnError('Request is already being processed', 409);
  }
  if (phaseAResult.type === 'FAILED') {
    throw new TurnError('This request previously failed. Please use a new idempotency key.', 400);
  }
  if (phaseAResult.type === 'TURN_MISMATCH') {
    throw new TurnError('Turn number mismatch', 409, phaseAResult.currentTurnNumber);
  }

  const { gameState, totalTokensUsed, turnNumber } = phaseAResult;

  // ═══ Phase B: AI Call (No locks, collect ModelRun data in memory) ═══
  let simulationResult;
  let modelRunData: {
    model: string;
    promptTokens: number;
    outputTokens: number;
    latencyMs: number;
    success: boolean;
    errorMessage: string | null;
  };

  try {
    simulationResult = await runSimulation(gameState, action);
    modelRunData = {
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      promptTokens: simulationResult.usage.promptTokens,
      outputTokens: simulationResult.usage.outputTokens,
      latencyMs: simulationResult.latencyMs,
      success: true,
      errorMessage: null,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown AI error';

    // Mark idempotency key as FAILED
    await prisma.idempotencyKey.updateMany({
      where: { gameId, key: idempotencyKey, status: 'IN_PROGRESS' },
      data: { status: 'FAILED' },
    });

    // P0 fix: Rollback daily quota since AI failed
    await rollbackDailyQuota(userId);

    throw new TurnError(`AI simulation failed: ${errorMsg}`, 500);
  }

  // Combine approved events and degraded fallbacks
  const allEvents: WorldEvent[] = [
    ...simulationResult.arbiterResult.approved,
    ...simulationResult.arbiterResult.degraded.map((d) => d.fallback),
  ];

  // ═══ Phase C: Short Transaction - Apply Events and Commit ═══
  const turnResponse = await prisma.$transaction(async (tx) => {
    // Re-lock and re-validate game
    const game = await tx.game.findFirst({
      where: { id: gameId },
    });
    if (!game) throw new TurnError('Game not found during commit', 500);

    // Re-check turn number (prevent advancement during Phase B)
    if (game.turnNumber !== turnNumber) {
      // Mark key as FAILED
      await tx.idempotencyKey.updateMany({
        where: { gameId, key: idempotencyKey, status: 'IN_PROGRESS' },
        data: { status: 'FAILED' },
      });
      throw new TurnError('Turn was advanced by another request', 409, game.turnNumber);
    }

    // Apply events to state
    const newState = applyEvents(gameState, allEvents);
    const newYear = gameState.currentYear + 1;
    const newTurnNumber = turnNumber + 1;
    newState.currentYear = newYear;
    newState.turnNumber = newTurnNumber;
    newState.worldNarrative = simulationResult.worldNarrative;

    // Create Turn record
    const turn = await tx.turn.create({
      data: {
        gameId,
        turnNumber: newTurnNumber,
        year: newYear,
        playerAction: action,
        status: 'COMPLETED',
      },
    });

    // Create TurnEvent records
    for (let i = 0; i < allEvents.length; i++) {
      await tx.turnEvent.create({
        data: {
          turnId: turn.id,
          eventType: allEvents[i].type,
          eventData: allEvents[i] as any,
          sequence: i,
        },
      });
    }

    // Create ModelRun record
    await tx.modelRun.create({
      data: {
        turnId: turn.id,
        gameId,
        ...modelRunData,
      },
    });

    // Update game state
    const newTokensUsed = totalTokensUsed + modelRunData.promptTokens + modelRunData.outputTokens;
    await tx.game.update({
      where: { id: gameId },
      data: {
        currentState: newState as any,
        turnNumber: newTurnNumber,
        currentYear: newYear,
        totalTokensUsed: newTokensUsed,
      },
    });

    // Auto-snapshot every 5 turns
    if (newTurnNumber % 5 === 0) {
      await tx.gameSnapshot.create({
        data: {
          gameId,
          turnNumber: newTurnNumber,
          year: newYear,
          state: newState as any,
        },
      });
    }

    // Build response
    const response: TurnResponse = {
      turnId: turn.id,
      turnNumber: newTurnNumber,
      year: newYear,
      events: allEvents.map((e) => ({
        type: e.type,
        description: e.description,
        involvedCountries: e.involvedCountries,
      })),
      worldNarrative: simulationResult.worldNarrative,
      yearSummary: simulationResult.yearSummary,
      stateVersion: newTurnNumber,
    };

    // Update idempotency key with full cached result
    await tx.idempotencyKey.updateMany({
      where: { gameId, key: idempotencyKey, status: 'IN_PROGRESS' },
      data: {
        status: 'COMPLETED',
        turnId: turn.id,
        cachedResult: response as any,
      },
    });

    return response;
  });

  return turnResponse;
}

/**
 * P0 fix: Rollback daily quota when AI call fails after quota was decremented.
 */
async function rollbackDailyQuota(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && user.dailyApiCalls > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { dailyApiCalls: { decrement: 1 } },
      });
    }
  } catch {
    // Non-critical: quota rollback failure is logged but doesn't break the flow
    console.error(`Failed to rollback daily quota for user ${userId}`);
  }
}

export class TurnError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly currentTurnNumber?: number,
  ) {
    super(message);
    this.name = 'TurnError';
  }
}
