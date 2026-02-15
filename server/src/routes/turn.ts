import { FastifyInstance } from 'fastify';
import { SubmitTurnRequestSchema } from '@faxhistoria/shared';
import { processTurn, TurnError } from '../services/turn.service';

export async function turnRoutes(fastify: FastifyInstance) {
  // POST /api/games/:id/turn - Submit a turn
  fastify.post('/api/games/:id/turn', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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
        return reply.status(err.statusCode).send({
          error: err.statusCode === 409 ? 'CONFLICT' : err.statusCode === 429 ? 'RATE_LIMIT' : 'ERROR',
          message: err.message,
          statusCode: err.statusCode,
          ...(err.currentTurnNumber !== undefined ? { currentTurnNumber: err.currentTurnNumber } : {}),
        });
      }
      throw err;
    }
  });
}
