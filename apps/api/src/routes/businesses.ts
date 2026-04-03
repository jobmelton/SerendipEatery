import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { validate } from '../lib/validate.js'
import { AppError } from '../lib/errors.js'
import { AuthenticatedRequest } from '../middleware/auth.js'

// Stripe Identity removed — using self-attestation verification

const createBusinessSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['truck', 'restaurant', 'popup', 'market']),
  cuisine: z.string().min(1).max(100),
  addressLine: z.string().min(1).max(500),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const updateBusinessSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  cuisine: z.string().min(1).max(100).optional(),
  addressLine: z.string().min(1).max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

export async function businessRoutes(app: FastifyInstance) {
  // GET /businesses/mine — get businesses owned by current user
  app.get('/businesses/mine', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth

    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new AppError(500, 'FETCH_FAILED', 'Failed to fetch businesses')
    return { ok: true, data: data ?? [] }
  })

  // GET /businesses/:id — get a single business
  app.get('/businesses/:id', async (request) => {
    const { id } = request.params as { id: string }

    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) throw new AppError(404, 'BIZ_NOT_FOUND', 'Business not found')
    return { ok: true, data }
  })

  // POST /businesses — register a new business
  app.post('/businesses', {
    preHandler: validate(createBusinessSchema),
  }, async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const body = request.body as z.infer<typeof createBusinessSchema>

    const referralCode = `BIZ-${userId.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    const { data, error } = await supabase
      .from('businesses')
      .insert({
        owner_id: userId,
        name: body.name,
        type: body.type,
        cuisine: body.cuisine,
        address_line: body.addressLine,
        lat: body.lat,
        lng: body.lng,
        plan: 'trial',
        biz_points: 0,
        biz_tier: 'operator',
        referral_code: referralCode,
        trial_evidence_score: 0,
      })
      .select()
      .single()

    if (error) throw new AppError(500, 'BIZ_CREATE_FAILED', 'Failed to create business')

    // Link business to user
    await supabase
      .from('users')
      .update({ linked_business_id: data.id })
      .eq('id', userId)

    return { ok: true, data }
  })

  // PATCH /businesses/:id — update business details
  app.patch('/businesses/:id', {
    preHandler: validate(updateBusinessSchema),
  }, async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { id } = request.params as { id: string }
    const body = request.body as z.infer<typeof updateBusinessSchema>

    // Verify ownership
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', id)
      .eq('owner_id', userId)
      .single()

    if (!biz) throw new AppError(403, 'NOT_OWNER', 'You do not own this business')

    const updates: Record<string, unknown> = {}
    if (body.name) updates.name = body.name
    if (body.cuisine) updates.cuisine = body.cuisine
    if (body.addressLine) updates.address_line = body.addressLine
    if (body.lat !== undefined) updates.lat = body.lat
    if (body.lng !== undefined) updates.lng = body.lng

    const { data, error } = await supabase
      .from('businesses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new AppError(500, 'BIZ_UPDATE_FAILED', 'Failed to update business')
    return { ok: true, data }
  })

  // GET /businesses/:id/sales — get all sales for a business
  app.get('/businesses/:id/sales', async (request) => {
    const { id } = request.params as { id: string }

    const { data, error } = await supabase
      .from('flash_sales')
      .select('*, prizes(*)')
      .eq('business_id', id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw new AppError(500, 'FETCH_FAILED', 'Failed to fetch sales')
    return { ok: true, data: data ?? [] }
  })

  // ─── Self-attestation verification: submit ─────────────────────────
  app.post('/businesses/verify/submit', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const body = request.body as {
      businessId: string
      idDocumentUrl: string
      selfieUrl: string
      ipAddress?: string
    }

    if (!body.businessId || !body.idDocumentUrl || !body.selfieUrl) {
      throw new AppError(400, 'MISSING_FIELDS', 'businessId, idDocumentUrl, and selfieUrl required')
    }

    const { data: biz } = await supabase
      .from('businesses')
      .select('id, verification_status')
      .eq('id', body.businessId)
      .eq('owner_id', userId)
      .single()

    if (!biz) throw new AppError(403, 'NOT_OWNER', 'You do not own this business')
    if (biz.verification_status === 'verified') {
      throw new AppError(400, 'ALREADY_VERIFIED', 'Business is already verified')
    }

    // TODO: For now auto-approve. Add manual admin review via /admin portal later.
    await supabase.from('businesses').update({
      id_document_url: body.idDocumentUrl,
      selfie_url: body.selfieUrl,
      agreement_accepted_at: new Date().toISOString(),
      agreement_ip: body.ipAddress ?? (request.headers['x-forwarded-for'] as string)?.split(',')[0] ?? 'unknown',
      verification_submitted_at: new Date().toISOString(),
      verification_status: 'verified', // Auto-approve for now
      verified_at: new Date().toISOString(),
    }).eq('id', body.businessId)

    return {
      ok: true,
      data: {
        status: 'verified',
        message: 'Verification approved! You can now go live.',
      },
    }
  })

  // ─── Cancel subscription with ETF ──────────────────────────────────
  app.patch('/businesses/me/cancel-subscription', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const body = request.body as { confirmEtf?: number }

    const { data: biz } = await supabase
      .from('businesses')
      .select('id, billing_plan, plan, commitment_start_date, commitment_months, stripe_subscription_id')
      .eq('owner_id', userId)
      .single()

    if (!biz) throw new AppError(404, 'BIZ_NOT_FOUND', 'No business found')

    const plan = biz.billing_plan || biz.plan || 'trial'
    if (plan === 'trial') throw new AppError(400, 'NO_SUB', 'No active subscription to cancel')

    // Calculate ETF
    let etf = 0
    if (biz.commitment_start_date && biz.commitment_months > 0) {
      const start = new Date(biz.commitment_start_date)
      const monthsElapsed = Math.max(0, Math.floor((Date.now() - start.getTime()) / (30.44 * 24 * 60 * 60 * 1000)))
      const monthsRemaining = Math.max(0, biz.commitment_months - monthsElapsed)
      const rate = plan === 'pro' ? 99 : plan === 'growth' ? 79 : 0
      etf = monthsRemaining * rate
    }

    // Require confirmation if ETF applies
    if (etf > 0 && body.confirmEtf !== etf) {
      return {
        ok: false,
        error: 'ETF_CONFIRMATION_REQUIRED',
        data: {
          etf,
          message: `Cancelling requires an early termination fee of $${etf}. Send confirmEtf: ${etf} to proceed.`,
        },
      }
    }

    // Process cancellation
    await supabase.from('businesses').update({
      plan: 'trial',
      billing_plan: 'trial',
      shadow_mode: false,
      shadow_mode_reason: null,
      early_termination_fee: etf > 0 ? etf : null,
      commitment_months: 0,
    }).eq('id', biz.id)

    return {
      ok: true,
      data: {
        cancelled: true,
        etf,
        message: etf > 0 ? `Subscription cancelled. Early termination fee: $${etf}` : 'Subscription cancelled.',
      },
    }
  })

  // ─── Get verification status ──────────────────────────────────────
  app.get('/businesses/verify/status', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { businessId } = request.query as { businessId: string }

    if (!businessId) throw new AppError(400, 'MISSING_ID', 'businessId query param required')

    const { data: biz } = await supabase
      .from('businesses')
      .select('verification_status, verified_at, rejection_reason')
      .eq('id', businessId)
      .eq('owner_id', userId)
      .single()

    if (!biz) throw new AppError(403, 'NOT_OWNER', 'You do not own this business')

    return { ok: true, data: biz }
  })
}
