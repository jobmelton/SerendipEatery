import Fastify from 'fastify'

const app = Fastify({ logger: true })

// ─── Health check FIRST — before any plugins that might fail ─────────────
app.get('/health', async () => ({ status: 'ok' }))

async function start() {
  try {
    // ─── Error handling ──────────────────────────────────────────────
    const { errorHandler } = await import('./lib/errors.js')
    app.setErrorHandler(errorHandler)

    // ─── Security headers ────────────────────────────────────────────
    try {
      const { registerSecurityHeaders, getCorsOrigins } = await import('./middleware/security.js')
      await registerSecurityHeaders(app)

      const cors = (await import('@fastify/cors')).default
      await app.register(cors, {
        origin: getCorsOrigins(),
        credentials: true,
      })
    } catch (err) {
      console.error('CORS/Security setup failed (non-fatal):', err)
    }

    // ─── Rate limiting ───────────────────────────────────────────────
    try {
      const { registerRateLimits } = await import('./lib/rateLimit.js')
      await registerRateLimits(app)
    } catch (err) {
      console.error('Rate limiting setup failed (non-fatal):', err)
    }

    // ─── Routes ──────────────────────────────────────────────────────
    const { requireAuth } = await import('./middleware/auth.js')
    const { salesRoutes } = await import('./routes/sales.js')
    const { spinRoutes } = await import('./routes/spin.js')
    const { visitRoutes } = await import('./routes/visits.js')
    const { userRoutes } = await import('./routes/users.js')
    const { businessRoutes } = await import('./routes/businesses.js')
    const { loyaltyRoutes } = await import('./routes/loyalty.js')
    const { referralRoutes } = await import('./routes/referrals.js')
    const { shareRoutes } = await import('./routes/share.js')
    const { evidenceRoutes } = await import('./routes/evidence.js')
    const { analyticsRoutes } = await import('./routes/analytics.js')
    const { adminRoutes } = await import('./routes/admin.js')

    // Public routes
    app.register(salesRoutes)

    // Protected routes
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

    // ─── Fix workers (non-fatal) ─────────────────────────────────────
    try {
      const { startFixWorkers } = await import('./lib/fixes.js')
      startFixWorkers()
    } catch (err) {
      console.error('Fix workers failed to start (non-fatal):', err)
    }

    // ─── Listen ──────────────────────────────────────────────────────
    const port = Number(process.env.PORT ?? 3001)
    const host = '0.0.0.0'

    await app.listen({ port, host })
    console.log(`API listening on ${host}:${port}`)
  } catch (err) {
    console.error('FATAL: Server failed to start:', err)
    app.log.error(err)
    process.exit(1)
  }
}

start()

export default app
