import Fastify from 'fastify'
import cors from '@fastify/cors'
import { requireAuth } from './middleware/auth'
import { errorHandler } from './lib/errors'
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

const app = Fastify({ logger: true })

// ─── Health check FIRST ──────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok' }))

// ─── Error handling ──────────────────────────────────────────────────────
app.setErrorHandler(errorHandler)

// ─── CORS ────────────────────────────────────────────────────────────────
try {
  await app.register(cors, {
    origin: [
      process.env.CLERK_WEB_URL || 'http://localhost:3000',
      process.env.CLERK_CONSUMER_URL || 'exp://localhost:8081',
      process.env.CLERK_BUSINESS_URL || 'exp://localhost:8082',
    ],
    credentials: true,
  })
} catch (err) {
  console.error('CORS registration failed:', err)
}

// ─── Rate limiting ───────────────────────────────────────────────────────
try {
  const { registerRateLimits } = await import('./lib/rateLimit')
  await registerRateLimits(app)
} catch (err) {
  console.error('Rate limiting failed:', err)
}

// ─── Public routes ───────────────────────────────────────────────────────
app.register(salesRoutes)

// ─── Protected routes ────────────────────────────────────────────────────
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

// ─── Start ───────────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 3001)

try {
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`API listening on 0.0.0.0:${port}`)
} catch (err) {
  console.error('FATAL: Server failed to start:', err)
  process.exit(1)
}

// ─── Fix workers (non-fatal, after server is listening) ──────────────────
try {
  const { startFixWorkers } = await import('./lib/fixes')
  startFixWorkers()
} catch (err) {
  console.error('Fix workers failed:', err)
}

export default app
