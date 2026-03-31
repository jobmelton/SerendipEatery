import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

const PRODUCTION_ORIGINS = [
  'https://serendip.app',
  'https://www.serendip.app',
  'https://serendipeatery.com',
  'https://www.serendipeatery.com',
]

/**
 * Register security headers (Helmet-style) and production CORS lock.
 */
export async function registerSecurityHeaders(app: FastifyInstance): Promise<void> {
  app.addHook('onSend', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Prevent clickjacking
    reply.header('X-Frame-Options', 'DENY')
    // Prevent MIME-type sniffing
    reply.header('X-Content-Type-Options', 'nosniff')
    // Control referrer information
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    // Prevent XSS (legacy header, still useful)
    reply.header('X-XSS-Protection', '1; mode=block')
    // Don't expose server info
    reply.header('X-Powered-By', '')
    // HSTS in production
    if (IS_PRODUCTION) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    // Permissions policy
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  })
}

/**
 * Get CORS origins based on environment.
 * In production, only allow known domains.
 * In development, allow localhost origins.
 */
export function getCorsOrigins(): string[] {
  if (IS_PRODUCTION) {
    return PRODUCTION_ORIGINS
  }

  return [
    process.env.CLERK_WEB_URL || 'http://localhost:3000',
    process.env.CLERK_CONSUMER_URL || 'exp://localhost:8081',
    process.env.CLERK_BUSINESS_URL || 'exp://localhost:8082',
  ]
}
