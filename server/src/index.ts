import './env';
import Fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { authPlugin } from './plugins/auth';
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { gameRoutes } from './routes/game';
import { turnRoutes } from './routes/turn';

const PORT = Number(process.env.PORT) || 40010;
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}
const JWT_SECRET = getRequiredEnv('JWT_SECRET');
getRequiredEnv('DEEPSEEK_API_KEY');
getRequiredEnv('DEEPSEEK_BASE_URL');
getRequiredEnv('DEEPSEEK_MODEL');

async function main() {
  const fastify = Fastify({ logger: true });

  // Register plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await fastify.register(jwt, {
    secret: JWT_SECRET,
  });

  await fastify.register(authPlugin);

  // Register routes
  await fastify.register(authRoutes);
  await fastify.register(adminRoutes);
  await fastify.register(gameRoutes);
  await fastify.register(turnRoutes);

  // Health check
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Global error handler
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    fastify.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.message,
        statusCode: 400,
      });
    }

    return reply.status(error.statusCode || 500).send({
      error: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      statusCode: error.statusCode || 500,
    });
  });

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
