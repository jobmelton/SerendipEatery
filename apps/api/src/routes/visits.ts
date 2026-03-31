import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase, checkInsideFence } from '../lib/supabase'
import { validate } from '../lib/validate'
import { AppError } from '../lib/errors'
import { AuthenticatedRequest } from '../middleware/auth'
import { EARN_POINTS } from '@serendipeatery/shared'

const checkinSchema = z.object({
  visitIntentId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export async function visitRoutes(app: FastifyInstance) {
  // POST /visits/checkin — confirm arrival at the business
  app.post('/visits/checkin', {
    preHandler: validate(checkinSchema),
  }, async (request) => {
    const { userId } = request as AuthenticatedRequest
    const { visitIntentId, lat, lng } = request.body as z.infer<typeof checkinSchema>

    const { data: intent } = await supabase
      .from('visit_intents')
      .select('*')
      .eq('id', visitIntentId)
      .eq('user_id', userId)
      .single()

    if (!intent) throw new AppError(404, 'INTENT_NOT_FOUND', 'Visit intent not found')

    if (intent.state === 'confirmed') {
      throw new AppError(409, 'ALREADY_CONFIRMED', 'Visit already confirmed')
    }

    if (intent.state === 'expired') {
      throw new AppError(410, 'VISIT_EXPIRED', 'This visit intent has expired')
    }

    // Check if within the 60-min window
    if (new Date(intent.expires_at) < new Date()) {
      await supabase
        .from('visit_intents')
        .update({ state: 'expired' })
        .eq('id', visitIntentId)
      throw new AppError(410, 'VISIT_EXPIRED', 'This visit intent has expired')
    }

    // Verify user is inside geofence
    const inside = await checkInsideFence(intent.sale_id, lat, lng)
    if (!inside) {
      throw new AppError(400, 'OUTSIDE_FENCE', 'You are not close enough to the business')
    }

    const now = new Date().toISOString()

    const { data: updated, error } = await supabase
      .from('visit_intents')
      .update({
        state: 'confirmed',
        entered_fence_at: now,
        confirmed_at: now,
      })
      .eq('id', visitIntentId)
      .select()
      .single()

    if (error) throw new AppError(500, 'CHECKIN_FAILED', 'Failed to confirm visit')

    // Award confirmed_visit points
    await supabase.rpc('award_points', {
      p_user_id: userId,
      p_points: EARN_POINTS.confirmed_visit,
    })

    // Create billing event
    await supabase.from('billing_events').insert({
      business_id: intent.business_id,
      visit_intent_id: visitIntentId,
      type: 'confirmed_visit',
      amount_cents: 50, // $0.50 per confirmed visit
    })

    return { ok: true, data: updated }
  })

  // GET /visits/mine — get user's visit history
  app.get('/visits/mine', async (request) => {
    const { userId } = request as AuthenticatedRequest

    const { data, error } = await supabase
      .from('visit_intents')
      .select('*, flash_sales(*, businesses(name, type, cuisine))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw new AppError(500, 'FETCH_FAILED', 'Failed to fetch visits')
    return { ok: true, data }
  })
}
