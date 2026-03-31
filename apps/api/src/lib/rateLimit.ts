import { FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'

export async function registerRateLimits(app: FastifyInstance): Promise<void> {
  // Global: 100 requests/min per IP
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => ({
      ok: false,
      error: 'Too many requests',
      code: 'RATE_LIMIT',
    }),
  })
}

// ─── Per-Route Rate Limit Configs ─────────────────────────────────────────

/** Spin endpoint: 10 spins/hour per user */
export const spinRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 hour',
      keyGenerator: (request: any) => request.userId ?? request.ip,
    },
  },
}

/** Auth endpoints: 5 attempts/15min per IP */
export const authRateLimit = {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '15 minutes',
      keyGenerator: (request: any) => request.ip,
    },
  },
}

/** Notification endpoints: 20/min per user */
export const notificationRateLimit = {
  config: {
    rateLimit: {
      max: 20,
      timeWindow: '1 minute',
      keyGenerator: (request: any) => request.userId ?? request.ip,
    },
  },
}
