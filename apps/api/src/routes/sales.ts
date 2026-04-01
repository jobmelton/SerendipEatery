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
      .select('id')
      .eq('id', body.businessId)
      .eq('owner_id', userId)
      .single()

    if (!biz) throw new AppError(403, 'NOT_OWNER', 'You do not own this business')

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
}
