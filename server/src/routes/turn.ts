import { FastifyInstance, type FastifyReply } from 'fastify';
import type { TurnProgressEvent } from '@faxhistoria/shared';
import { SubmitTurnRequestSchema } from '@faxhistoria/shared';
import {
  processTurn,
  TurnError,
  type TurnProgressUpdate,
} from '../services/turn.service';

const HEARTBEAT_MS = 1000;

function toErrorPayload(err: TurnError) {
  return {
    error: err.statusCode === 409 ? 'CONFLICT' : err.statusCode === 429 ? 'RATE_LIMIT' : 'ERROR',
    message: err.message,
    statusCode: err.statusCode,
    ...(err.currentTurnNumber !== undefined ? { currentTurnNumber: err.currentTurnNumber } : {}),
  };
}

function buildProgressEvent(update: TurnProgressUpdate): TurnProgressEvent {
  return {
    stage: update.stage,
    progress: Math.max(0, Math.min(100, update.progress)),
    message: update.message,
    timestamp: new Date().toISOString(),
    ...(update.attempt !== undefined ? { attempt: update.attempt } : {}),
    ...(update.totalAttempts !== undefined ? { totalAttempts: update.totalAttempts } : {}),
    ...(update.liveEvent ? { liveEvent: update.liveEvent } : {}),
    ...(update.liveDraftEvent ? { liveDraftEvent: update.liveDraftEvent } : {}),
  };
}

function writeSse(reply: FastifyReply, event: string, data: TurnProgressEvent) {
  if (reply.raw.writableEnded) return;
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function turnRoutes(fastify: FastifyInstance) {
  // POST /api/games/:id/turn - Submit a turn
  fastify.post('/api/games/:id/turn', {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const { id: gameId } = request.params as { id: string };

    // Validate request body
    const parsed = SubmitTurnRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        statusCode: 400,
      });
    }

    // Get idempotency key from header
    const idempotencyKey = request.headers['x-idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      return reply.status(400).send({
        error: 'MISSING_HEADER',
        message: 'X-Idempotency-Key header is required',
        statusCode: 400,
      });
    }

    try {
      const result = await processTurn({
        gameId,
        userId: request.jwtUser.userId,
        action: parsed.data.action,
        expectedTurnNumber: parsed.data.expectedTurnNumber,
        idempotencyKey,
      });

      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof TurnError) {
        return reply.status(err.statusCode).send(toErrorPayload(err));
      }
      throw err;
    }
  });

  // POST /api/games/:id/turn/stream - Submit a turn with SSE progress
  fastify.post('/api/games/:id/turn/stream', {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const { id: gameId } = request.params as { id: string };

    const parsed = SubmitTurnRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        statusCode: 400,
      });
    }

    const idempotencyKey = request.headers['x-idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      return reply.status(400).send({
        error: 'MISSING_HEADER',
        message: 'X-Idempotency-Key header is required',
        statusCode: 400,
      });
    }

    reply.hijack();
    reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    reply.raw.flushHeaders?.();

    let closed = false;
    let currentProgress = 0;
    let aiHeartbeat: NodeJS.Timeout | null = null;

    const stopHeartbeat = () => {
      if (aiHeartbeat) {
        clearInterval(aiHeartbeat);
        aiHeartbeat = null;
      }
    };

    const emit = (event: string, update: TurnProgressUpdate) => {
      const normalized: TurnProgressUpdate = {
        ...update,
        progress: Math.max(update.progress, currentProgress),
      };
      currentProgress = normalized.progress;
      writeSse(reply, event, buildProgressEvent(normalized));
    };

    request.raw.on('close', () => {
      closed = true;
      stopHeartbeat();
    });

    emit('progress', {
      stage: 'VALIDATING',
      progress: 2,
      message: 'Turn request received',
    });

    try {
      const result = await processTurn({
        gameId,
        userId: request.jwtUser.userId,
        action: parsed.data.action,
        expectedTurnNumber: parsed.data.expectedTurnNumber,
        idempotencyKey,
        onProgress: (update) => {
          if (closed) return;

          if (update.stage === 'PROCESSING_AI' || update.stage === 'AI_RETRY') {
            if (!aiHeartbeat) {
              aiHeartbeat = setInterval(() => {
                if (closed) {
                  stopHeartbeat();
                  return;
                }
                const next = Math.min(79, currentProgress + 1);
                if (next > currentProgress) {
                  emit('progress', {
                    stage: 'PROCESSING_AI',
                    progress: next,
                    message: 'AI simulation is still running...',
                  });
                }
              }, HEARTBEAT_MS);
            }
          } else {
            stopHeartbeat();
          }

          emit('progress', update);
        },
      });

      stopHeartbeat();
      writeSse(reply, 'complete', {
        ...buildProgressEvent({
          stage: 'COMPLETED',
          progress: 100,
          message: 'Turn completed successfully',
        }),
        result,
      });
    } catch (err) {
      stopHeartbeat();
      if (err instanceof TurnError) {
        writeSse(reply, 'error', {
          ...buildProgressEvent({
            stage: 'FAILED',
            progress: 100,
            message: err.message,
          }),
          error: {
            message: err.message,
            statusCode: err.statusCode,
          },
        });
      } else {
        writeSse(reply, 'error', {
          ...buildProgressEvent({
            stage: 'FAILED',
            progress: 100,
            message: 'Unexpected server error',
          }),
          error: {
            message: err instanceof Error ? err.message : 'Unknown error',
            statusCode: 500,
          },
        });
      }
    } finally {
      stopHeartbeat();
      if (!closed && !reply.raw.writableEnded) {
        reply.raw.end();
      }
    }
  });
}
