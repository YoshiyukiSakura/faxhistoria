import { FastifyInstance } from 'fastify';
import { CreateGameRequestSchema, SELECTABLE_COUNTRIES } from '@faxhistoria/shared';
import { createGame, getGame, listGames } from '../services/game.service';

export async function gameRoutes(fastify: FastifyInstance) {
  // POST /api/games - Create a new game
  fastify.post('/api/games', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parsed = CreateGameRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        statusCode: 400,
      });
    }

    const { name, playerCountry, startYear } = parsed.data;

    if (!SELECTABLE_COUNTRIES.includes(playerCountry)) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: `Invalid country. Must be one of: ${SELECTABLE_COUNTRIES.join(', ')}`,
        statusCode: 400,
      });
    }

    const game = await createGame(request.jwtUser.userId, name, playerCountry, startYear);
    return reply.status(201).send(game);
  });

  // GET /api/games - List user's games
  fastify.get('/api/games', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const games = await listGames(request.jwtUser.userId);
    return reply.status(200).send(games);
  });

  // GET /api/games/:id - Get a specific game
  fastify.get('/api/games/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const game = await getGame(id, request.jwtUser.userId);

    if (!game) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Game not found',
        statusCode: 404,
      });
    }

    return reply.status(200).send(game);
  });
}
