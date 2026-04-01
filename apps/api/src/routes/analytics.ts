import { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase.js'
import { AppError } from '../lib/errors.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import {
  getBusinessAnalytics,
  getConsumerAnalytics,
  getSaleAnalytics,
  getPlatformStats,
} from '../lib/analytics.js'

export async function analyticsRoutes(app: FastifyInstance) {
  // GET /analytics/business — business dashboard analytics
  app.get('/analytics/business', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth

    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .single()

    if (!biz) throw new AppError(404, 'BIZ_NOT_FOUND', 'No business found')

    const analytics = await getBusinessAnalytics(biz.id)
    return { ok: true, data: analytics }
  })

  // GET /analytics/sale/:saleId — live sale analytics
  app.get('/analytics/sale/:saleId', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { saleId } = request.params as { saleId: string }

    // Verify ownership
    const { data: sale } = await supabase
      .from('flash_sales')
      .select('business_id, businesses!inner(owner_id)')
      .eq('id', saleId)
      .single()

    if (!sale || (sale as any).businesses?.owner_id !== userId) {
      throw new AppError(403, 'NOT_OWNER', 'You do not own this sale')
    }

    const analytics = await getSaleAnalytics(saleId)
    return { ok: true, data: analytics }
  })

  // GET /analytics/consumer — consumer personal stats
  app.get('/analytics/consumer', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const analytics = await getConsumerAnalytics(userId)
    return { ok: true, data: analytics }
  })

  // GET /analytics/platform — platform-wide (admin only)
  app.get('/analytics/platform', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth

    // Admin check is handled by adminAuth middleware; this is a fallback
    if (!userId) {
      throw new AppError(403, 'NOT_ADMIN', 'Admin access required')
    }

    const stats = await getPlatformStats()
    return { ok: true, data: stats }
  })
}
