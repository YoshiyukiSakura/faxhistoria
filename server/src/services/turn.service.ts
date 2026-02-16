import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import type { Game } from '@prisma/client';
import type {
  GameState,
  TurnDraftEvent,
  TurnProgressStage,
  TurnResponse,
  TurnStreamEvent,
  WorldEvent,
} from '@faxhistoria/shared';
import { runSimulation } from './ai/ai-service';
import { enrichEventsWithGeneratedImages } from './ai/event-image.service';
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
  onProgress?: (update: TurnProgressUpdate) => void;
}

export interface TurnProgressUpdate {
  stage: TurnProgressStage;
  progress: number;
  message: string;
  attempt?: number;
  totalAttempts?: number;
  liveEvent?: TurnStreamEvent;
  liveDraftEvent?: TurnDraftEvent;
}

export async function processTurn(input: ProcessTurnInput): Promise<TurnResponse> {
  const {
    gameId,
    userId,
    action,
    expectedTurnNumber,
    idempotencyKey,
    onProgress,
  } = input;
  const emitProgress = (update: TurnProgressUpdate) => {
    if (!onProgress) return;
    try {
      onProgress(update);
    } catch {
      // Progress channel failure should never break turn processing.
    }
  };
  emitProgress({
    stage: 'VALIDATING',
    progress: 8,
    message: 'Validating action, idempotency key, and quota',
  });

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
        // Lease expired — mark as FAILED, don't take over
        await tx.idempotencyKey.update({
          where: { id: existingKey.id },
          data: { status: 'FAILED' },
        });
        return { type: 'FAILED' as const };
      }
      if (existingKey.status === 'FAILED') {
        return { type: 'FAILED' as const };
      }
    }

    // 2. Lock and validate game (FOR UPDATE prevents concurrent turn-number races)
    const [game] = await tx.$queryRaw<Game[]>(
      Prisma.sql`SELECT * FROM "Game" WHERE id = ${gameId} AND "userId" = ${userId} FOR UPDATE`
    );
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

    // 5. P0 fix: Atomically check and decrement daily quota with user-row lock
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [user] = await tx.$queryRaw<{ id: string; dailyApiCalls: number; lastCallDate: Date | null }[]>(
      Prisma.sql`SELECT id, "dailyApiCalls", "lastCallDate" FROM "User" WHERE id = ${userId} FOR UPDATE`
    );
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
    emitProgress({
      stage: 'COMPLETED',
      progress: 100,
      message: 'Reused cached result for this idempotency key',
    });
    return phaseAResult.cachedResult;
  }
  if (phaseAResult.type === 'IN_PROGRESS') {
    emitProgress({
      stage: 'FAILED',
      progress: 100,
      message: 'Another request with the same idempotency key is still in progress',
    });
    throw new TurnError('Request is already being processed', 409);
  }
  if (phaseAResult.type === 'FAILED') {
    emitProgress({
      stage: 'FAILED',
      progress: 100,
      message: 'This idempotency key is marked failed and cannot be reused',
    });
    throw new TurnError('This request previously failed. Please use a new idempotency key.', 400);
  }
  if (phaseAResult.type === 'TURN_MISMATCH') {
    emitProgress({
      stage: 'FAILED',
      progress: 100,
      message: 'Turn number mismatch. Please refresh game state and retry',
    });
    throw new TurnError('Turn number mismatch', 409, phaseAResult.currentTurnNumber);
  }

  const { gameState, totalTokensUsed, turnNumber } = phaseAResult;
  emitProgress({
    stage: 'PROCESSING_AI',
    progress: 32,
    message: 'Validation complete. Requesting AI simulation',
  });

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
    simulationResult = await runSimulation(gameState, action, {
      onAiAttempt: (attempt, totalAttempts) => {
        emitProgress({
          stage: attempt > 1 ? 'AI_RETRY' : 'PROCESSING_AI',
          progress: attempt > 1 ? Math.min(40 + attempt * 8, 68) : 45,
          message:
            attempt > 1
              ? `AI output invalid, retrying (${attempt}/${totalAttempts})`
              : 'AI simulation is generating this turn',
          attempt,
          totalAttempts,
        });
      },
      onAiDraftEvent: (draftEvent) => {
        emitProgress({
          stage: 'PROCESSING_AI',
          progress: Math.min(72, 48 + draftEvent.sequence * 2),
          message:
            draftEvent.description.length > 0
              ? `Drafting event ${draftEvent.sequence}: ${draftEvent.type}`
              : `Drafting event ${draftEvent.sequence}`,
          liveDraftEvent: draftEvent,
        });
      },
    });
    modelRunData = {
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      promptTokens: simulationResult.usage.promptTokens,
      outputTokens: simulationResult.usage.outputTokens,
      latencyMs: simulationResult.latencyMs,
      success: true,
      errorMessage: null,
    };
    emitProgress({
      stage: 'APPLYING_EVENTS',
      progress: 74,
      message: 'AI response received. Applying validated world events',
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown AI error';

    // Mark idempotency key as FAILED (conditional to avoid overwriting if already changed)
    await prisma.idempotencyKey.updateMany({
      where: { gameId, key: idempotencyKey, status: 'IN_PROGRESS' },
      data: { status: 'FAILED' },
    });

    // P0 fix: Rollback daily quota since AI failed
    await rollbackDailyQuota(userId);

    emitProgress({
      stage: 'FAILED',
      progress: 100,
      message: `AI simulation failed: ${errorMsg}`,
    });
    throw new TurnError(`AI simulation failed: ${errorMsg}`, 500);
  }

  // Combine approved events and degraded fallbacks
  let allEvents: WorldEvent[] = [
    ...simulationResult.arbiterResult.approved,
    ...simulationResult.arbiterResult.degraded.map((d) => d.fallback),
  ];

  if (allEvents.length > 0) {
    emitProgress({
      stage: 'APPLYING_EVENTS',
      progress: 75,
      message: 'Generating event illustrations',
    });

    allEvents = await enrichEventsWithGeneratedImages(
      allEvents,
      {
        year: gameState.currentYear + 1,
        playerAction: action,
        gameId,
        turnNumber: turnNumber + 1,
      },
      {
        onProgress: ({ sequence, total, success, skipped, seed }) => {
          const status = skipped ? 'skipped' : success ? 'ready' : 'failed';
          emitProgress({
            stage: 'APPLYING_EVENTS',
            progress: Math.min(83, 75 + Math.round((sequence / total) * 8)),
            message: `Illustration ${sequence}/${total} ${status} (seed ${seed})`,
          });
        },
      },
    );
  }

  const totalEvents = allEvents.length;
  if (totalEvents === 0) {
    emitProgress({
      stage: 'APPLYING_EVENTS',
      progress: 80,
      message: 'No major events generated. Preparing to save turn',
    });
  } else {
    for (let index = 0; index < totalEvents; index++) {
      const event = allEvents[index];
      const sequence = index + 1;
      emitProgress({
        stage: 'APPLYING_EVENTS',
        progress: Math.min(85, 74 + Math.round((sequence / totalEvents) * 11)),
        message: `Event ${sequence}/${totalEvents}: ${event.type}`,
        liveEvent: {
          id: `${idempotencyKey}-${sequence}`,
          sequence,
          total: totalEvents,
          type: event.type,
          description: event.description,
          involvedCountries: event.involvedCountries,
          ...(event.imageSeed !== undefined ? { imageSeed: event.imageSeed } : {}),
          ...(event.imageUrl ? { imageUrl: event.imageUrl } : {}),
        },
      });
    }
  }

  // ═══ Phase C: Short Transaction - Apply Events and Commit ═══
  let turnResponse: TurnResponse;
  emitProgress({
    stage: 'PERSISTING',
    progress: 86,
    message: 'Persisting turn, events, and snapshots',
  });
  try {
    turnResponse = await prisma.$transaction(async (tx) => {
      // Re-lock game with FOR UPDATE to prevent concurrent commits
      const [game] = await tx.$queryRaw<Game[]>(
        Prisma.sql`SELECT * FROM "Game" WHERE id = ${gameId} FOR UPDATE`
      );
      if (!game) throw new TurnError('Game not found during commit', 500);

      // Re-check turn number (prevent advancement during Phase B)
      if (game.turnNumber !== turnNumber) {
        // Mark key as FAILED (conditional guard prevents stale worker overwrite)
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
          ...(e.imageSeed !== undefined ? { imageSeed: e.imageSeed } : {}),
          ...(e.imageUrl ? { imageUrl: e.imageUrl } : {}),
        })),
        worldNarrative: simulationResult.worldNarrative,
        yearSummary: simulationResult.yearSummary,
        stateVersion: newTurnNumber,
      };

      // Update idempotency key with conditional status guard (prevents stale worker overwrite)
      const { count } = await tx.idempotencyKey.updateMany({
        where: { gameId, key: idempotencyKey, status: 'IN_PROGRESS' },
        data: {
          status: 'COMPLETED',
          turnId: turn.id,
          cachedResult: response as any,
        },
      });
      if (count !== 1) {
        throw new TurnError('Idempotency key was modified by another process', 409);
      }

      return response;
    });
  } catch (err) {
    // Mark key as FAILED outside the failed transaction (conditional guard)
    await prisma.idempotencyKey.updateMany({
      where: { gameId, key: idempotencyKey, status: 'IN_PROGRESS' },
      data: { status: 'FAILED' },
    });
    await rollbackDailyQuota(userId);
    emitProgress({
      stage: 'FAILED',
      progress: 100,
      message: err instanceof Error ? err.message : 'Failed while saving turn',
    });
    throw err;
  }
  emitProgress({
    stage: 'COMPLETED',
    progress: 100,
    message: 'Turn completed successfully',
  });
  return turnResponse;
}

/**
 * P0 fix: Rollback daily quota when AI call fails after quota was decremented.
 * Single atomic operation that won't go below 0.
 */
async function rollbackDailyQuota(userId: string): Promise<void> {
  try {
    await prisma.user.updateMany({
      where: { id: userId, dailyApiCalls: { gt: 0 } },
      data: { dailyApiCalls: { decrement: 1 } },
    });
  } catch {
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
