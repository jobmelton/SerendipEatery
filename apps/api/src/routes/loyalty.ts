import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { validate } from '../lib/validate.js'
import { AppError } from '../lib/errors.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { getTierProgress, crossConvert } from '../lib/loyalty.js'

const convertSchema = z.object({
  businessId: z.string().uuid(),
  amount: z.number().int().min(1),
})

export async function loyaltyRoutes(app: FastifyInstance) {
  // GET /loyalty/me — points balance, tier, progress, boost
  app.get('/loyalty/me', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth

    const { data: user, error } = await supabase
      .from('users')
      .select('points, consumer_tier')
      .eq('id', userId)
      .single()

    if (error || !user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')

    const progress = getTierProgress(user.points ?? 0, 'consumer')

    // Also check if user has a linked business
    const { data: biz } = await supabase
      .from('businesses')
      .select('id, biz_points, biz_tier')
      .eq('owner_id', userId)
      .limit(1)
      .single()

    const businessProgress = biz
      ? getTierProgress(biz.biz_points ?? 0, 'business')
      : null

    return {
      ok: true,
      data: {
        consumer: progress,
        business: businessProgress,
      },
    }
  })

  // GET /loyalty/leaderboard — top 20 users by points (anonymized)
  app.get('/loyalty/leaderboard', async () => {
    // Try the SQL function first
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_leaderboard')

    if (!rpcErr && rpcData) {
      return { ok: true, data: rpcData }
    }

    // Fallback: query directly with anonymization
    const { data, error } = await supabase
      .from('users')
      .select('display_name, points, consumer_tier')
      .order('points', { ascending: false })
      .limit(20)

    if (error) throw new AppError(500, 'FETCH_FAILED', 'Failed to fetch leaderboard')

    const anonymized = (data ?? []).map((u, i) => {
      const name = u.display_name ?? 'Anonymous'
      const parts = name.split(' ')
      const display = parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1][0]}.`
        : parts[0]

      return {
        rank: i + 1,
        displayName: display,
        points: u.points,
        tier: u.consumer_tier,
      }
    })

    return { ok: true, data: anonymized }
  })

  // POST /loyalty/convert — convert business points to consumer points
  app.post('/loyalty/convert', {
    preHandler: validate(convertSchema),
  }, async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { businessId, amount } = request.body as z.infer<typeof convertSchema>

    const result = await crossConvert(userId, businessId, amount)

    return { ok: true, data: result }
  })
}
