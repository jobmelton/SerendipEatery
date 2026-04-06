import { FastifyInstance } from 'fastify'
import { supabase } from '../lib/supabase.js'
import { AppError } from '../lib/errors.js'

export async function badgeRoutes(app: FastifyInstance) {
  // ─── Get all badge definitions ────────────────────────────────────
  app.get('/badges', async () => {
    const { data: badges } = await supabase
      .from('badge_definitions')
      .select('*')
      .order('badge_category')

    // Get current holders for each badge
    const { data: holders } = await supabase
      .from('badge_holders')
      .select('*')
      .eq('is_current', true)

    const result = (badges ?? []).map(badge => ({
      ...badge,
      currentHolders: (holders ?? []).filter(h => h.badge_id === badge.id),
    }))

    return { ok: true, data: result }
  })

  // ─── Get badge lineage ────────────────────────────────────────────
  app.get('/badges/:badgeId', async (request) => {
    const { badgeId } = request.params as { badgeId: string }

    const { data: badge } = await supabase
      .from('badge_definitions')
      .select('*')
      .eq('id', badgeId)
      .single()

    if (!badge) throw new AppError(404, 'NOT_FOUND', 'Badge not found')

    // Get all holders (current and historical)
    const { data: holders } = await supabase
      .from('badge_holders')
      .select('*')
      .eq('badge_id', badgeId)
      .order('held_from', { ascending: false })

    // Compute stats
    const allHolders = holders ?? []
    const currentHolders = allHolders.filter(h => h.is_current)
    const formerHolders = allHolders.filter(h => !h.is_current)

    // Unique holder periods (group co-holders for draw streak)
    let totalTransfers = 0
    let longestReignDays = 0
    let longestReignHolder = ''
    let totalDays = 0

    for (const h of allHolders) {
      const from = new Date(h.held_from)
      const until = h.held_until ? new Date(h.held_until) : new Date()
      const days = Math.max(1, Math.round((until.getTime() - from.getTime()) / 86400000))

      if (days > longestReignDays) {
        longestReignDays = days
        longestReignHolder = h.user_name
      }
      totalDays += days
    }

    // Count unique transfers (not co-holders)
    const transferDates = new Set(formerHolders.map(h => h.held_until?.slice(0, 10)))
    totalTransfers = transferDates.size

    const mostRecentTransfer = formerHolders.length > 0
      ? Math.round((Date.now() - new Date(formerHolders[0].held_until ?? formerHolders[0].held_from).getTime()) / 86400000)
      : null

    const uniqueHolders = new Set(allHolders.map(h => h.user_id)).size
    const avgReign = uniqueHolders > 0 ? Math.round(totalDays / uniqueHolders) : 0

    return {
      ok: true,
      data: {
        badge,
        currentHolders,
        history: allHolders,
        stats: {
          totalTransfers,
          longestReignDays,
          longestReignHolder,
          mostRecentTransferDaysAgo: mostRecentTransfer,
          averageReignDays: avgReign,
        },
      },
    }
  })

  // ─── Get badges for a user ────────────────────────────────────────
  app.get('/badges/user/:userId', async (request) => {
    const { userId } = request.params as { userId: string }

    const { data: allHoldings } = await supabase
      .from('badge_holders')
      .select('*, badge_definitions(*)')
      .eq('user_id', userId)
      .order('held_from', { ascending: false })

    const current = (allHoldings ?? []).filter(h => h.is_current)
    const former = (allHoldings ?? []).filter(h => !h.is_current)

    return { ok: true, data: { current, former } }
  })

  // ─── Get traveling badges leaderboard ─────────────────────────────
  app.get('/badges/traveling/leaderboard', async () => {
    const { data: badges } = await supabase
      .from('badge_definitions')
      .select('*')
      .eq('traveling', true)

    const { data: currentHolders } = await supabase
      .from('badge_holders')
      .select('*')
      .eq('is_current', true)

    const result = (badges ?? []).map(badge => {
      const holders = (currentHolders ?? []).filter(h => h.badge_id === badge.id)
      const holder = holders[0]
      const daysHeld = holder
        ? Math.max(1, Math.round((Date.now() - new Date(holder.held_from).getTime()) / 86400000))
        : 0

      return {
        ...badge,
        currentHolder: holder,
        daysHeld,
      }
    })

    return { ok: true, data: result }
  })
}
