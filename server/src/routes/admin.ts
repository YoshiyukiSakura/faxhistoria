import { FastifyInstance } from 'fastify';
import { AdminStatsResponseSchema } from '@faxhistoria/shared';
import { getAdminStats } from '../services/admin.service';

function getAdminEmailSet() {
  const configured = process.env.ADMIN_EMAILS
    ?.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return new Set(configured ?? []);
}

export async function adminRoutes(fastify: FastifyInstance) {
  const adminEmails = getAdminEmailSet();

  // GET /api/admin/stats - Player and token usage statistics
  fastify.get('/api/admin/stats', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const requesterEmail = request.jwtUser.email.toLowerCase();
    const isAdmin = adminEmails.size === 0 || adminEmails.has(requesterEmail);
    if (!isAdmin) {
      return reply.status(403).send({
        error: 'FORBIDDEN',
        message: 'Admin access required',
        statusCode: 403,
      });
    }

    const stats = await getAdminStats();
    const parsed = AdminStatsResponseSchema.safeParse(stats);
    if (!parsed.success) {
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to build admin stats response',
        statusCode: 500,
      });
    }

    return reply.status(200).send(parsed.data);
  });
}
