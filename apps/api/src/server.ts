import Fastify from 'fastify'
import cors from '@fastify/cors'
import { requireAuth, AuthenticatedRequest } from './middleware/auth'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: [
    process.env.CLERK_WEB_URL || 'http://localhost:3000',
    process.env.CLERK_CONSUMER_URL || 'exp://localhost:8081',
    process.env.CLERK_BUSINESS_URL || 'exp://localhost:8082',
  ],
  credentials: true,
})

// ─── Health check (public) ────────────────────────────────────────────────
app.get('/health', async () => ({ ok: true, ts: Date.now() }))

// ─── Protected routes ─────────────────────────────────────────────────────
app.register(async (protectedRoutes) => {
  protectedRoutes.addHook('preHandler', requireAuth)

  protectedRoutes.get('/me', async (request) => {
    const { userId } = request as AuthenticatedRequest
    return { ok: true, data: { userId } }
  })
})

// ─── Start ────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT) || 4000
const host = process.env.HOST || '0.0.0.0'

try {
  await app.listen({ port, host })
  console.log(`🚀 API listening on ${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

export default app
