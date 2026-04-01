import { FastifyRequest, FastifyReply } from 'fastify'
import { AuthenticatedRequest } from './auth.js'

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { userId } = (request as AuthenticatedRequest).auth

  if (!userId || !ADMIN_USER_IDS.includes(userId)) {
    return reply.code(403).send({
      ok: false,
      error: 'Admin access required',
      code: 'NOT_ADMIN',
    })
  }
}
