import { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase.js'
import { AppError } from '../lib/errors.js'
import { AuthenticatedRequest } from '../middleware/auth.js'

export async function userRoutes(app: FastifyInstance) {
  // GET /users/me — get current user's profile
  app.get('/users/me', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !data) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')
    return { ok: true, data }
  })

  // GET /users/me/stats — get user's loyalty stats
  app.get('/users/me/stats', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth

    const { data: user } = await supabase
      .from('users')
      .select('points, consumer_tier, streak_days, last_visit_at')
      .eq('id', userId)
      .single()

    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')

    const { count: totalVisits } = await supabase
      .from('visit_intents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('state', 'confirmed')

    const { count: uniqueBusinesses } = await supabase
      .from('visit_intents')
      .select('business_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('state', 'confirmed')

    return {
      ok: true,
      data: {
        ...user,
        totalVisits: totalVisits ?? 0,
        uniqueBusinesses: uniqueBusinesses ?? 0,
      },
    }
  })

  // PATCH /users/me — update display name or avatar
  app.patch('/users/me', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { displayName, avatarUrl } = request.body as {
      displayName?: string
      avatarUrl?: string
    }

    const updates: Record<string, unknown> = {}
    if (displayName) updates.display_name = displayName
    if (avatarUrl) updates.avatar_url = avatarUrl

    if (Object.keys(updates).length === 0) {
      throw new AppError(400, 'NO_UPDATES', 'No fields to update')
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) throw new AppError(500, 'UPDATE_FAILED', 'Failed to update user')
    return { ok: true, data }
  })

  // DELETE /users/me — soft delete account
  app.delete('/users/me', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth

    // Soft-delete user
    await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('clerk_id', userId)

    // Cancel active flash sales
    await supabase
      .from('flash_sales')
      .update({ status: 'cancelled' })
      .eq('status', 'active')
      .in('business_id', supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', userId)
      )

    // Cancel Stripe subscriptions if business exists
    try {
      const { data: biz } = await supabase
        .from('businesses')
        .select('stripe_customer_id')
        .eq('owner_id', userId)
        .single()

      if (biz?.stripe_customer_id) {
        const Stripe = (await import('stripe')).default
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2025-02-24.acacia' as any })
        const subs = await stripe.subscriptions.list({ customer: biz.stripe_customer_id, status: 'active' })
        for (const sub of subs.data) {
          await stripe.subscriptions.cancel(sub.id)
        }
      }
    } catch {
      // Non-fatal — subscription cancel is best-effort
    }

    return { ok: true, data: { deleted: true } }
  })
}
