import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { supabase, checkInsideFence } from '../lib/supabase'
import { validate } from '../lib/validate'
import { AppError } from '../lib/errors'
import { AuthenticatedRequest } from '../middleware/auth'
import { EARN_POINTS, TIER_BOOST_PCT, type ConsumerTier } from '@serendipeatery/shared'

const spinSchema = z.object({
  saleId: z.string().uuid(),
  spinLat: z.number().min(-90).max(90),
  spinLng: z.number().min(-180).max(180),
})

export async function spinRoutes(app: FastifyInstance) {
  // POST /spin — execute a spin
  app.post('/spin', {
    preHandler: validate(spinSchema),
  }, async (request) => {
    const { userId } = request as AuthenticatedRequest
    const { saleId, spinLat, spinLng } = request.body as z.infer<typeof spinSchema>

    // 1. Verify sale is live
    const { data: sale } = await supabase
      .from('flash_sales')
      .select('*, prizes(*)')
      .eq('id', saleId)
      .eq('status', 'live')
      .single()

    if (!sale) throw new AppError(404, 'SALE_NOT_LIVE', 'This sale is not currently live')

    // 2. Check spin cap
    if (sale.spins_used >= sale.max_spins_total) {
      throw new AppError(409, 'SPINS_EXHAUSTED', 'All spins for this sale have been used')
    }

    // 3. Check if user already spun this sale
    const { data: existing } = await supabase
      .from('visit_intents')
      .select('id')
      .eq('user_id', userId)
      .eq('sale_id', saleId)
      .single()

    if (existing) throw new AppError(409, 'ALREADY_SPUN', 'You already spun for this sale')

    // 4. Pick a prize (weighted random by remaining spins)
    const available = sale.prizes.filter((p: any) => p.spins_used < p.max_spins)
    if (available.length === 0) {
      throw new AppError(409, 'NO_PRIZES_LEFT', 'No prizes remaining')
    }

    const totalWeight = available.reduce((sum: number, p: any) => sum + (p.max_spins - p.spins_used), 0)
    let roll = Math.random() * totalWeight
    let prize = available[0]
    for (const p of available) {
      roll -= (p.max_spins - p.spins_used)
      if (roll <= 0) { prize = p; break }
    }

    // 5. Check geofence to determine initial state
    const insideFence = await checkInsideFence(saleId, spinLat, spinLng)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000) // 60 min
    const prizeCode = randomUUID().slice(0, 8).toUpperCase()

    const state = insideFence ? 'confirmed' : 'spun_away'

    // 6. Create visit intent
    const { data: intent, error: intentErr } = await supabase
      .from('visit_intents')
      .insert({
        user_id: userId,
        sale_id: saleId,
        business_id: sale.business_id,
        state,
        prize_won: prize.name,
        prize_code: prizeCode,
        spin_lat: spinLat,
        spin_lng: spinLng,
        spun_at: now.toISOString(),
        entered_fence_at: insideFence ? now.toISOString() : null,
        confirmed_at: insideFence ? now.toISOString() : null,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (intentErr) throw new AppError(500, 'INTENT_FAILED', 'Failed to create visit intent')

    // 7. Increment spins_used on sale and prize
    await supabase.rpc('increment_spins', { p_sale_id: saleId, p_prize_id: prize.id })

    // 8. Award points
    const { data: user } = await supabase
      .from('users')
      .select('points, consumer_tier')
      .eq('id', userId)
      .single()

    const basePoints = EARN_POINTS.spin
    const boostPct = user ? TIER_BOOST_PCT[user.consumer_tier as ConsumerTier] ?? 0 : 0
    const pointsEarned = Math.round(basePoints * (1 + boostPct / 100))

    await supabase
      .from('users')
      .update({ points: (user?.points ?? 0) + pointsEarned })
      .eq('id', userId)

    return {
      ok: true,
      data: {
        prizeId: prize.id,
        prizeName: prize.name,
        prizeType: prize.type,
        prizeValue: prize.value,
        code: prizeCode,
        expiresAt,
        pointsEarned,
        visitIntentId: intent.id,
      },
    }
  })
}
