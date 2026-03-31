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

const app = Fastify({ logger: true })

// ─── Error handling ───────────────────────────────────────────────────────
app.setErrorHandler(errorHandler)

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
})

// ─── Start ────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT) || 4000
const host = process.env.HOST || '0.0.0.0'

try {
  await app.listen({ port, host })
  console.log(`API listening on ${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

export default app
