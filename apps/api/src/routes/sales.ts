import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase, activeSalesNear } from '../lib/supabase.js'
import { validate, validateQuery } from '../lib/validate.js'
import { AppError } from '../lib/errors.js'
import { AuthenticatedRequest } from '../middleware/auth.js'

const createSaleSchema = z.object({
  businessId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  radiusM: z.number().min(50).max(10000),
  maxSpinsTotal: z.number().min(1).max(10000),
  prizes: z.array(z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['percent', 'amount', 'free', 'free_with']),
    value: z.number().min(0),
    maxSpins: z.number().min(1),
  })).min(1),
})

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().min(0.1).max(50).optional().default(5),
})

export async function salesRoutes(app: FastifyInstance) {
  // GET /sales/nearby — public endpoint for discovering active sales
  app.get('/sales/nearby', {
    preHandler: validateQuery(nearbyQuerySchema),
  }, async (request) => {
    const { lat, lng, radius_km } = request.query as z.infer<typeof nearbyQuerySchema>
    const sales = await activeSalesNear(lat, lng, radius_km)
    return { ok: true, data: sales }
  })

  // GET /sales/:id — get a single sale by ID
  app.get('/sales/:id', async (request) => {
    const { id } = request.params as { id: string }
    const { data, error } = await supabase
      .from('flash_sales')
      .select('*, prizes(*)')
      .eq('id', id)
      .single()

    if (error || !data) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale not found')
    return { ok: true, data }
  })

  // POST /sales — create a new flash sale (authenticated, business owner)
  app.post('/sales', {
    preHandler: validate(createSaleSchema),
  }, async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const body = request.body as z.infer<typeof createSaleSchema>

    // Verify the user owns this business
    const { data: biz } = await supabase
      .from('businesses')
      .select('id, verification_status')
      .eq('id', body.businessId)
      .eq('owner_id', userId)
      .single()

    if (!biz) throw new AppError(403, 'NOT_OWNER', 'You do not own this business')

    // Business must be verified to go live
    if (biz.verification_status !== 'verified') {
      throw new AppError(403, 'VERIFICATION_REQUIRED', 'Business verification required before launching sales')
    }

    const { prizes, ...saleData } = body

    const { data: sale, error: saleErr } = await supabase
      .from('flash_sales')
      .insert({
        business_id: saleData.businessId,
        status: 'scheduled',
        starts_at: saleData.startsAt,
        ends_at: saleData.endsAt,
        radius_m: saleData.radiusM,
        max_spins_total: saleData.maxSpinsTotal,
        spins_used: 0,
      })
      .select()
      .single()

    if (saleErr || !sale) throw new AppError(500, 'SALE_CREATE_FAILED', 'Failed to create sale')

    // Insert prizes
    const prizeRows = prizes.map((p) => ({
      sale_id: sale.id,
      name: p.name,
      type: p.type,
      value: p.value,
      max_spins: p.maxSpins,
      spins_used: 0,
      arrival_rate: 0,
    }))

    const { error: prizeErr } = await supabase.from('prizes').insert(prizeRows)
    if (prizeErr) throw new AppError(500, 'PRIZE_CREATE_FAILED', 'Failed to create prizes')

    const { data: fullSale } = await supabase
      .from('flash_sales')
      .select('*, prizes(*)')
      .eq('id', sale.id)
      .single()

    return { ok: true, data: fullSale }
  })

  // PATCH /sales/:id/status — update sale status
  app.patch('/sales/:id/status', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: string }

    const validStatuses = ['live', 'ended', 'cancelled']
    if (!validStatuses.includes(status)) {
      throw new AppError(400, 'INVALID_STATUS', `Status must be one of: ${validStatuses.join(', ')}`)
    }

    // Verify ownership through the sale's business
    const { data: sale } = await supabase
      .from('flash_sales')
      .select('id, business_id, businesses!inner(owner_id)')
      .eq('id', id)
      .single()

    if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale not found')
    if ((sale as any).businesses?.owner_id !== userId) {
      throw new AppError(403, 'NOT_OWNER', 'You do not own this business')
    }

    const { data: updated, error } = await supabase
      .from('flash_sales')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new AppError(500, 'STATUS_UPDATE_FAILED', 'Failed to update status')
    return { ok: true, data: updated }
  })

  // GET /sales/mine — all sales for authenticated business owner
  app.get('/sales/mine', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { status } = request.query as { status?: string }

    // Get all businesses owned by this user
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)

    if (!businesses?.length) return { ok: true, data: [] }

    const bizIds = businesses.map((b) => b.id)

    let query = supabase
      .from('flash_sales')
      .select('*, prizes(*)')
      .in('business_id', bizIds)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query.limit(100)
    if (error) throw new AppError(500, 'FETCH_FAILED', 'Failed to fetch sales')

    return { ok: true, data: data ?? [] }
  })

  // PATCH /sales/:id — edit sale details
  app.patch('/sales/:id', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { id } = request.params as { id: string }
    const body = request.body as Record<string, any>

    // Verify ownership
    const { data: sale } = await supabase
      .from('flash_sales')
      .select('id, status, business_id, businesses!inner(owner_id)')
      .eq('id', id)
      .single()

    if (!sale) throw new AppError(404, 'SALE_NOT_FOUND', 'Sale not found')
    if ((sale as any).businesses?.owner_id !== userId) {
      throw new AppError(403, 'NOT_OWNER', 'You do not own this business')
    }

    // Only allow editing scheduled or draft sales
    if (!['scheduled', 'draft'].includes(sale.status)) {
      throw new AppError(400, 'CANNOT_EDIT', 'Only scheduled or draft sales can be edited')
    }

    const allowed = ['starts_at', 'ends_at', 'radius_m', 'max_spins_total', 'status']
    const updates: Record<string, any> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }

    const { data: updated, error } = await supabase
      .from('flash_sales')
      .update(updates)
      .eq('id', id)
      .select('*, prizes(*)')
      .single()

    if (error) throw new AppError(500, 'UPDATE_FAILED', 'Failed to update sale')
    return { ok: true, data: updated }
  })

  // POST /sales/:id/duplicate — clone a sale as new draft
  app.post('/sales/:id/duplicate', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { id } = request.params as { id: string }

    const { data: original } = await supabase
      .from('flash_sales')
      .select('*, prizes(*), businesses!inner(owner_id)')
      .eq('id', id)
      .single()

    if (!original) throw new AppError(404, 'NOT_FOUND', 'Sale not found')
    if ((original as any).businesses?.owner_id !== userId) throw new AppError(403, 'NOT_OWNER', 'Not your sale')

    const { data: newSale, error } = await supabase
      .from('flash_sales')
      .insert({
        business_id: original.business_id,
        title: `${original.title || 'Sale'} (copy)`,
        status: 'draft',
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 3600000).toISOString(),
        radius_m: original.radius_m,
        max_spins_total: original.max_spins_total,
        spins_used: 0,
      })
      .select()
      .single()

    if (error || !newSale) throw new AppError(500, 'DUP_FAILED', 'Failed to duplicate')

    // Copy prizes
    if (original.prizes?.length) {
      await supabase.from('prizes').insert(
        original.prizes.map((p: any) => ({
          sale_id: newSale.id,
          name: p.name,
          label: p.label,
          type: p.type,
          value: p.value,
          max_spins: p.max_spins,
          spins_used: 0,
          weight: p.weight,
          base_weight: p.base_weight,
        }))
      )
    }

    return { ok: true, data: newSale }
  })

  // DELETE /sales/:id — delete draft sale
  app.delete('/sales/:id', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { id } = request.params as { id: string }

    const { data: sale } = await supabase
      .from('flash_sales')
      .select('id, status, businesses!inner(owner_id)')
      .eq('id', id)
      .single()

    if (!sale) throw new AppError(404, 'NOT_FOUND', 'Sale not found')
    if ((sale as any).businesses?.owner_id !== userId) throw new AppError(403, 'NOT_OWNER', 'Not your sale')
    if (sale.status !== 'draft') throw new AppError(400, 'NOT_DRAFT', 'Only draft sales can be deleted')

    await supabase.from('prizes').delete().eq('sale_id', id)
    await supabase.from('flash_sales').delete().eq('id', id)

    return { ok: true, data: { deleted: true } }
  })

  // GET /sales/:id/report — full analytics report
  app.get('/sales/:id/report', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { id } = request.params as { id: string }

    const { data: sale } = await supabase
      .from('flash_sales')
      .select('*, prizes(*), businesses!inner(owner_id, name)')
      .eq('id', id)
      .single()

    if (!sale) throw new AppError(404, 'NOT_FOUND', 'Sale not found')
    if ((sale as any).businesses?.owner_id !== userId) throw new AppError(403, 'NOT_OWNER', 'Not your sale')

    const { data: visits } = await supabase
      .from('visit_intents')
      .select('id, state, created_at, points_earned')
      .eq('flash_sale_id', id)
      .order('created_at')

    const { data: billing } = await supabase
      .from('billing_events')
      .select('type, amount_cents, created_at')
      .eq('flash_sale_id', id)

    return {
      ok: true,
      data: {
        sale,
        visits: visits ?? [],
        billing: billing ?? [],
        summary: {
          totalSpins: sale.spins_used ?? 0,
          confirmedVisits: (visits ?? []).filter((v: any) => v.state === 'confirmed').length,
          totalRevenue: (billing ?? []).reduce((s: number, b: any) => s + (b.amount_cents ?? 0), 0) / 100,
        },
      },
    }
  })
}
