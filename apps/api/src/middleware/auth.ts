import { FastifyRequest, FastifyReply } from 'fastify'
import { createClerkClient } from '@clerk/backend'

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
})

export interface AuthenticatedRequest extends FastifyRequest {
  userId: string
  sessionClaims: Record<string, unknown>
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ ok: false, error: 'Missing token', code: 'AUTH_MISSING' })
  }

  const token = authHeader.slice(7)

  try {
    const { sub, ...claims } = await clerk.verifyToken(token, {
      authorizedParties: [
        process.env.CLERK_WEB_URL!,
        process.env.CLERK_CONSUMER_URL!,
        process.env.CLERK_BUSINESS_URL!,
      ].filter(Boolean),
    })

    ;(request as AuthenticatedRequest).userId = sub
    ;(request as AuthenticatedRequest).sessionClaims = claims
  } catch {
    return reply.code(401).send({ ok: false, error: 'Invalid token', code: 'AUTH_INVALID' })
  }
}
