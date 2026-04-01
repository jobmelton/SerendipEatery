import { verifyToken } from '@clerk/backend'
import type { FastifyRequest, FastifyReply } from 'fastify'

export interface AuthenticatedRequest extends FastifyRequest {
  auth: { userId: string; sessionId: string; orgId?: string }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    reply.code(401).send({ ok: false, error: 'Missing Authorization header', code: 'AUTH_MISSING' })
    return
  }

  const token = header.replace('Bearer ', '').trim()
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! })
    ;(request as AuthenticatedRequest).auth = {
      userId: payload.sub,
      sessionId: payload.sid as string,
      orgId: payload.org_id as string | undefined,
    }
  } catch {
    reply.code(401).send({ ok: false, error: 'Invalid or expired token', code: 'AUTH_INVALID' })
  }
}

export async function optionalAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) return

  const token = header.replace('Bearer ', '').trim()
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! })
    ;(request as AuthenticatedRequest).auth = {
      userId: payload.sub,
      sessionId: payload.sid as string,
      orgId: payload.org_id as string | undefined,
    }
  } catch {
    // Optional auth — silently ignore failures
  }
}
