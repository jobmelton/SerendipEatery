process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason)
  process.exit(1)
})

import Fastify from 'fastify'
import cors from '@fastify/cors'
import { requireAuth } from './middleware/auth.js'
import { errorHandler } from './lib/errors.js'
import { salesRoutes } from './routes/sales.js'
import { spinRoutes } from './routes/spin.js'
import { visitRoutes } from './routes/visits.js'
import { userRoutes } from './routes/users.js'
import { businessRoutes } from './routes/businesses.js'
import { loyaltyRoutes } from './routes/loyalty.js'
import { referralRoutes } from './routes/referrals.js'
import { shareRoutes } from './routes/share.js'
import { evidenceRoutes } from './routes/evidence.js'
import { analyticsRoutes } from './routes/analytics.js'
import { adminRoutes } from './routes/admin.js'
import { battleRoutes } from './routes/battles.js'
import { battleRealtimeRoutes } from './routes/battles-realtime.js'
import { tournamentRoutes } from './routes/tournaments.js'
import { badgeRoutes } from './routes/badges.js'
import { recordRoutes } from './routes/record.js'
import { clerkWebhookRoutes } from './routes/webhooks/clerk.js'
import { stripeIdentityWebhookRoutes } from './routes/webhooks/stripe-identity.js'

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
  const { registerRateLimits } = await import('./lib/rateLimit.js')
  await registerRateLimits(app)
} catch (err) {
  console.error('Rate limiting failed:', err)
}

// ─── Public routes ───────────────────────────────────────────────────────
app.register(salesRoutes)
app.register(battleRealtimeRoutes)
app.register(tournamentRoutes)
app.register(badgeRoutes)
app.register(recordRoutes)
app.register(clerkWebhookRoutes)
app.register(stripeIdentityWebhookRoutes)

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
  protectedRoutes.register(battleRoutes)
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
  const { startFixWorkers } = await import('./lib/fixes.js')
  startFixWorkers()
} catch (err) {
  console.error('Fix workers failed:', err)
}

// ─── House Bot (non-fatal, after server is listening) ────────────────────
try {
  const { watchForUnansweredChallenges, replenishBotLootbox } = await import('./lib/houseBot.js')
  watchForUnansweredChallenges()
  // Replenish bot lootbox every 30 minutes
  setInterval(replenishBotLootbox, 30 * 60 * 1000)
  replenishBotLootbox() // initial run
} catch (err) {
  console.error('House Bot failed:', err)
}

export default app
