import { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase'
import { AppError } from '../lib/errors'
import { AuthenticatedRequest } from '../middleware/auth'
import {
  getBusinessAnalytics,
  getConsumerAnalytics,
  getSaleAnalytics,
  getPlatformStats,
} from '../lib/analytics'

export async function analyticsRoutes(app: FastifyInstance) {
  // GET /analytics/business — business dashboard analytics
  app.get('/analytics/business', async (request) => {
    const { userId } = request as AuthenticatedRequest

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
    const { userId } = request as AuthenticatedRequest
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
    const { userId } = request as AuthenticatedRequest
    const analytics = await getConsumerAnalytics(userId)
    return { ok: true, data: analytics }
  })

  // GET /analytics/platform — platform-wide (admin only)
  app.get('/analytics/platform', async (request) => {
    const { userId, sessionClaims } = request as AuthenticatedRequest

    // Check admin role in session claims
    const role = (sessionClaims as any)?.metadata?.role
    if (role !== 'admin') {
      throw new AppError(403, 'NOT_ADMIN', 'Admin access required')
    }

    const stats = await getPlatformStats()
    return { ok: true, data: stats }
  })
}
