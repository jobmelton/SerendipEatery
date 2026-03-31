import Fastify from 'fastify'
import cors from '@fastify/cors'
import { requireAuth } from './middleware/auth'
import { errorHandler } from './lib/errors'
import { registerRateLimits } from './lib/rateLimit'
import { registerSecurityHeaders, getCorsOrigins } from './middleware/security'
import { salesRoutes } from './routes/sales'
import { spinRoutes } from './routes/spin'
import { visitRoutes } from './routes/visits'
import { userRoutes } from './routes/users'
import { businessRoutes } from './routes/businesses'
import { loyaltyRoutes } from './routes/loyalty'
import { referralRoutes } from './routes/referrals'
import { shareRoutes } from './routes/share'
import { evidenceRoutes } from './routes/evidence'
import { analyticsRoutes } from './routes/analytics'
import { adminRoutes } from './routes/admin'
import { startFixWorkers } from './lib/fixes'

const app = Fastify({ logger: true })

// ─── Error handling ───────────────────────────────────────────────────────
app.setErrorHandler(errorHandler)

// ─── Security headers ────────────────────────────────────────────────────
await registerSecurityHeaders(app)

// ─── Rate limiting ───────────────────────────────────────────────────────
await registerRateLimits(app)

// ─── CORS (locked to production domains in production) ───────────────────
await app.register(cors, {
  origin: getCorsOrigins(),
  credentials: true,
})

// ─── Health check (public) ────────────────────────────────────────────────
app.get('/health', async () => ({ ok: true, ts: Date.now() }))

// ─── Public routes ────────────────────────────────────────────────────────
app.register(salesRoutes)

// ─── Protected routes ─────────────────────────────────────────────────────
app.register(async (protectedRoutes) => {
  protectedRoutes.addHook('preHandler', requireAuth)

  protectedRoutes.register(spinRoutes)
  protectedRoutes.register(visitRoutes)
  protectedRoutes.register(userRoutes)
  protectedRoutes.register(businessRoutes)
  protectedRoutes.register(loyaltyRoutes)
  protectedRoutes.register(referralRoutes)
  protectedRoutes.register(shareRoutes)
  protectedRoutes.register(evidenceRoutes)
  protectedRoutes.register(analyticsRoutes)
  protectedRoutes.register(adminRoutes, { prefix: '/admin' })
})

// ─── Start ────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT) || 4000
const host = process.env.HOST || '0.0.0.0'

try {
  await app.listen({ port, host })
  console.log(`API listening on ${host}:${port}`)
  startFixWorkers()
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

export default app
