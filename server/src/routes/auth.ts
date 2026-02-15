import { FastifyInstance } from 'fastify';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  GuestLoginRequestSchema,
} from '@faxhistoria/shared';
import {
  createUser,
  createGuestUser,
  findUserByEmail,
  verifyPassword,
} from '../services/auth.service';

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/register
  fastify.post('/api/auth/register', async (request, reply) => {
    const parsed = RegisterRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        statusCode: 400,
      });
    }

    const { email, password, displayName } = parsed.data;

    // Check if user already exists
    const existing = await findUserByEmail(email);
    if (existing) {
      return reply.status(409).send({
        error: 'CONFLICT',
        message: 'Email already registered',
        statusCode: 409,
      });
    }

    const user = await createUser(email, password, displayName);
    const token = fastify.jwt.sign({ userId: user.id, email: user.email });

    return reply.status(201).send({ token, user });
  });

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (request, reply) => {
    const parsed = LoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        statusCode: 400,
      });
    }

    const { email, password } = parsed.data;
    const user = await findUserByEmail(email);
    if (!user) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Invalid email or password',
        statusCode: 401,
      });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Invalid email or password',
        statusCode: 401,
      });
    }

    const token = fastify.jwt.sign({ userId: user.id, email: user.email });

    return reply.status(200).send({
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  });

  // POST /api/auth/guest
  fastify.post('/api/auth/guest', async (request, reply) => {
    const parsed = GuestLoginRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
        statusCode: 400,
      });
    }

    const user = await createGuestUser();
    const token = fastify.jwt.sign({ userId: user.id, email: user.email });

    return reply.status(201).send({ token, user });
  });
}
