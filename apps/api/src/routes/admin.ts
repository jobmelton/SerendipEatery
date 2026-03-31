import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validate } from '../lib/validate'
import { AppError } from '../lib/errors'
import { requireAdmin } from '../middleware/adminAuth'
import { getPlatformStats } from '../lib/analytics'

const overrideSchema = z.object({
  plan: z.enum(['trial', 'starter', 'growth', 'pro']).optional(),
  trialLocked: z.boolean().optional(),
  trialEvidenceScore: z.number().min(0).max(5).optional(),
  subscriptionEndsAt: z.string().datetime().optional(),
})

export async function adminRoutes(app: FastifyInstance) {
  // All admin routes require admin auth
  app.addHook('preHandler', requireAdmin)

  // GET /admin/stats — platform stats
  app.get('/admin/stats', async () => {
    const stats = await getPlatformStats()

    // Additional: signups last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: recentUsers } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())

    const signupsByDay: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      signupsByDay[d.toISOString().slice(0, 10)] = 0
    }
    for (const u of recentUsers ?? []) {
      const day = u.created_at.slice(0, 10)
      if (signupsByDay[day] !== undefined) signupsByDay[day]++
    }

    return {
      ok: true,
      data: {
        ...stats,
        signupChart: Object.entries(signupsByDay).map(([date, count]) => ({ date, signups: count })),
      },
    }
  })

  // GET /admin/businesses — all businesses with filters
  app.get('/admin/businesses', async (request) => {
    const query = request.query as { plan?: string; sort?: string; order?: string }

    let q = supabase
      .from('businesses')
      .select('*')

    if (query.plan) {
      q = q.eq('plan', query.plan)
    }

    const sortCol = query.sort === 'revenue' ? 'biz_points' :
                    query.sort === 'visits' ? 'biz_points' :
                    query.sort === 'created_at' ? 'created_at' : 'created_at'

    q = q.order(sortCol, { ascending: query.order === 'asc' })
    q = q.limit(100)

    const { data, error } = await q
    if (error) throw new AppError(500, 'FETCH_FAILED', 'Failed to fetch businesses')

    return { ok: true, data: data ?? [] }
  })

  // PATCH /admin/businesses/:id — override billing plan or trial
  app.patch('/admin/businesses/:id', {
    preHandler: validate(overrideSchema),
  }, async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as z.infer<typeof overrideSchema>

    const updates: Record<string, unknown> = {}
    if (body.plan !== undefined) updates.plan = body.plan
    if (body.trialLocked !== undefined) updates.trial_locked = body.trialLocked
    if (body.trialEvidenceScore !== undefined) updates.trial_evidence_score = body.trialEvidenceScore
    if (body.subscriptionEndsAt !== undefined) updates.subscription_ends_at = body.subscriptionEndsAt

    if (Object.keys(updates).length === 0) {
      throw new AppError(400, 'NO_UPDATES', 'No fields to update')
    }

    const { data, error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new AppError(500, 'UPDATE_FAILED', 'Failed to update business')
    return { ok: true, data }
  })

  // GET /admin/sales — all active sales
  app.get('/admin/sales', async () => {
    const { data, error } = await supabase
      .from('flash_sales')
      .select('*, businesses(name, type), prizes(*)')
      .in('status', ['live', 'scheduled'])
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw new AppError(500, 'FETCH_FAILED', 'Failed to fetch sales')
    return { ok: true, data: data ?? [] }
  })

  // POST /admin/sales/:id/end — force-end a sale
  app.post('/admin/sales/:id/end', async (request) => {
    const { id } = request.params as { id: string }

    const { data, error } = await supabase
      .from('flash_sales')
      .update({ status: 'ended' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new AppError(500, 'UPDATE_FAILED', 'Failed to end sale')
    return { ok: true, data }
  })

  // GET /admin/notifications — worker queue stats (placeholder)
  app.get('/admin/notifications', async () => {
    // In production, query BullMQ for queue stats
    // For now, return notification table stats
    const { count: totalSent } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count: sentToday } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', today.toISOString())

    return {
      ok: true,
      data: {
        totalSent: totalSent ?? 0,
        sentToday: sentToday ?? 0,
        queueDepth: 0,
        failedJobs: 0,
      },
    }
  })

  // POST /admin/notifications/:jobId/retry — retry failed job (placeholder)
  app.post('/admin/notifications/:jobId/retry', async (request) => {
    const { jobId } = request.params as { jobId: string }
    // In production, use BullMQ to retry the job
    return { ok: true, data: { jobId, retried: true } }
  })
}
