import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validate } from '../lib/validate'
import { AppError } from '../lib/errors'
import { AuthenticatedRequest } from '../middleware/auth'
import { EARN_POINTS } from '@serendipeatery/shared'
import {
  verifyInsideFence,
  processTruckPing,
  resolveTransition,
  createBillingEvent,
} from '../lib/geofence'
import { awardPoints } from '../lib/loyalty'

const checkinSchema = z.object({
  visitIntentId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const truckPingSchema = z.object({
  businessId: z.string().uuid(),
  saleId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const influencedSchema = z.object({
  saleId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const passiveSchema = z.object({
  saleId: z.string().uuid(),
  notificationId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export async function visitRoutes(app: FastifyInstance) {
  // ─── POST /visits/checkin — confirm arrival (spun_away → confirmed) ───
  app.post('/visits/checkin', {
    preHandler: validate(checkinSchema),
  }, async (request) => {
    const { userId } = request as AuthenticatedRequest
    const { visitIntentId, lat, lng } = request.body as z.infer<typeof checkinSchema>

    // 1. Fetch the visit intent
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

    // 2. Server-side geofence check via PostGIS
    const inside = await verifyInsideFence(intent.sale_id, lat, lng)
    if (!inside) {
      throw new AppError(400, 'OUTSIDE_FENCE', 'You are not close enough to the business')
    }

    // 3. Run state machine transition
    const { newState, billingEvent, confirmedAt } = resolveTransition(
      intent.state,
      'checkin',
      intent.spun_at,
      intent.expires_at,
      null,
      null,
    )

    // If expired by time check inside the state machine
    if (newState === 'expired') {
      await supabase
        .from('visit_intents')
        .update({ state: 'expired' })
        .eq('id', visitIntentId)
      throw new AppError(410, 'VISIT_EXPIRED', 'This visit intent has expired')
    }

    // 4. Update visit intent
    const now = new Date().toISOString()
    const { data: updated, error } = await supabase
      .from('visit_intents')
      .update({
        state: newState,
        entered_fence_at: now,
        confirmed_at: confirmedAt,
      })
      .eq('id', visitIntentId)
      .select()
      .single()

    if (error) throw new AppError(500, 'CHECKIN_FAILED', 'Failed to confirm visit')

    // 5. Award points via loyalty engine and create billing event
    if (billingEvent) {
      await Promise.all([
        awardPoints(userId, EARN_POINTS.confirmed_visit, 'confirmed_visit', visitIntentId),
        createBillingEvent(intent.business_id, visitIntentId, newState),
      ])
    }

    return { ok: true, data: updated }
  })

  // ─── POST /visits/truck-ping — food truck location update ─────────────
  app.post('/visits/truck-ping', {
    preHandler: validate(truckPingSchema),
  }, async (request) => {
    const { userId } = request as AuthenticatedRequest
    const { businessId, saleId, lat, lng } = request.body as z.infer<typeof truckPingSchema>

    // Verify ownership
    const { data: biz } = await supabase
      .from('businesses')
      .select('id, type')
      .eq('id', businessId)
      .eq('owner_id', userId)
      .single()

    if (!biz) throw new AppError(403, 'NOT_OWNER', 'You do not own this business')
    if (biz.type !== 'truck') {
      throw new AppError(400, 'NOT_A_TRUCK', 'Location pings are only for food trucks')
    }

    const result = await processTruckPing(businessId, saleId, lat, lng)

    return {
      ok: true,
      data: {
        moved: result.moved,
        distanceM: Math.round(result.distanceM * 100) / 100,
        message: result.moved
          ? 'Geofence updated — new location recorded'
          : 'Location unchanged — within 5m of last snapshot',
      },
    }
  })

  // ─── POST /visits/influenced — record an influenced visit ─────────────
  app.post('/visits/influenced', {
    preHandler: validate(influencedSchema),
  }, async (request) => {
    const { userId } = request as AuthenticatedRequest
    const { saleId, lat, lng } = request.body as z.infer<typeof influencedSchema>

    // Verify the sale exists and has ended
    const { data: sale } = await supabase
      .from('flash_sales')
      .select('id, business_id, status, ends_at')
      .eq('id', saleId)
      .single()

    if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale not found')

    // User must not have already spun for this sale
    const { data: existingIntent } = await supabase
      .from('visit_intents')
      .select('id')
      .eq('user_id', userId)
      .eq('sale_id', saleId)
      .single()

    if (existingIntent) {
      throw new AppError(409, 'ALREADY_HAS_INTENT', 'You already have a visit for this sale')
    }

    // Verify inside geofence
    const inside = await verifyInsideFence(saleId, lat, lng)
    if (!inside) {
      throw new AppError(400, 'OUTSIDE_FENCE', 'You are not close enough to the business')
    }

    // Run state machine for influenced transition
    const { newState, billingEvent, confirmedAt } = resolveTransition(
      'spun_away', // starting state doesn't matter for influenced
      'influenced',
      null,
      null,
      sale.ends_at,
      null,
    )

    if (newState !== 'influenced') {
      throw new AppError(410, 'WINDOW_CLOSED', 'The 90-minute influenced visit window has passed')
    }

    // Create the visit intent
    const now = new Date().toISOString()
    const { data: intent, error } = await supabase
      .from('visit_intents')
      .insert({
        user_id: userId,
        sale_id: saleId,
        business_id: sale.business_id,
        state: 'influenced',
        prize_won: null,
        prize_code: null,
        spin_lat: null,
        spin_lng: null,
        spun_at: null,
        entered_fence_at: now,
        confirmed_at: confirmedAt,
        expires_at: null,
      })
      .select()
      .single()

    if (error) throw new AppError(500, 'INTENT_FAILED', 'Failed to record influenced visit')

    if (billingEvent) {
      await createBillingEvent(sale.business_id, intent.id, 'influenced')
    }

    return { ok: true, data: intent }
  })

  // ─── POST /visits/passive — record a passive visit ────────────────────
  app.post('/visits/passive', {
    preHandler: validate(passiveSchema),
  }, async (request) => {
    const { userId } = request as AuthenticatedRequest
    const { saleId, notificationId, lat, lng } = request.body as z.infer<typeof passiveSchema>

    // Fetch the notification to get its timestamp
    const { data: notif } = await supabase
      .from('notifications')
      .select('id, created_at, sale_id')
      .eq('id', notificationId)
      .eq('user_id', userId)
      .single()

    if (!notif) throw new AppError(404, 'NOTIF_NOT_FOUND', 'Notification not found')

    const { data: sale } = await supabase
      .from('flash_sales')
      .select('id, business_id')
      .eq('id', saleId)
      .single()

    if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale not found')

    // No duplicate visit
    const { data: existingIntent } = await supabase
      .from('visit_intents')
      .select('id')
      .eq('user_id', userId)
      .eq('sale_id', saleId)
      .single()

    if (existingIntent) {
      throw new AppError(409, 'ALREADY_HAS_INTENT', 'You already have a visit for this sale')
    }

    // Verify inside geofence
    const inside = await verifyInsideFence(saleId, lat, lng)
    if (!inside) {
      throw new AppError(400, 'OUTSIDE_FENCE', 'You are not close enough to the business')
    }

    // Run state machine
    const { newState, billingEvent, confirmedAt } = resolveTransition(
      'spun_away',
      'passive',
      null,
      null,
      null,
      notif.created_at,
    )

    if (newState !== 'passive') {
      throw new AppError(410, 'WINDOW_CLOSED', 'The 30-minute passive visit window has passed')
    }

    const now = new Date().toISOString()
    const { data: intent, error } = await supabase
      .from('visit_intents')
      .insert({
        user_id: userId,
        sale_id: saleId,
        business_id: sale.business_id,
        state: 'passive',
        prize_won: null,
        prize_code: null,
        spin_lat: null,
        spin_lng: null,
        spun_at: null,
        entered_fence_at: now,
        confirmed_at: confirmedAt,
        expires_at: null,
      })
      .select()
      .single()

    if (error) throw new AppError(500, 'INTENT_FAILED', 'Failed to record passive visit')

    if (billingEvent) {
      await createBillingEvent(sale.business_id, intent.id, 'passive')
    }

    return { ok: true, data: intent }
  })

  // ─── GET /visits/mine — user's visit history ──────────────────────────
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
