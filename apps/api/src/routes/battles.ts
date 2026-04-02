import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validate, validateQuery } from '../lib/validate.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'
import { AppError } from '../lib/errors.js'
import { resolveBattle, spinLootWheel, type Move } from '../lib/battle.js'

const moveEnum = z.enum(['rock', 'paper', 'scissors'])

const challengeSchema = z.object({
  defenderId: z.string().min(1),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

const movesSchema = z.object({
  moves: z.array(moveEnum).min(3).max(6),
})

const lootSchema = z.object({
  lootType: z.enum(['points', 'coupon']),
})

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(0).max(50000).default(500),
})

export async function battleRoutes(app: FastifyInstance) {
  // ─── Challenge a user ─────────────────────────────────────────────
  app.post('/battles/challenge', {
    preHandler: validate(challengeSchema),
  }, async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { defenderId, lat, lng } = request.body as z.infer<typeof challengeSchema>

    if (userId === defenderId) {
      throw new AppError(400, 'SELF_CHALLENGE', 'You cannot challenge yourself')
    }

    // Check defender has battle mode enabled
    const { data: defender } = await supabase
      .from('users')
      .select('battle_mode_enabled, display_name')
      .eq('clerk_id', defenderId)
      .single()

    if (!defender?.battle_mode_enabled) {
      throw new AppError(400, 'BATTLE_DISABLED', 'This user has battle mode disabled')
    }

    // Check no active battle between these two
    const { data: existing } = await supabase
      .from('battles')
      .select('id')
      .or(`and(challenger_id.eq.${userId},defender_id.eq.${defenderId}),and(challenger_id.eq.${defenderId},defender_id.eq.${userId})`)
      .in('status', ['pending', 'active'])
      .limit(1)

    if (existing && existing.length > 0) {
      throw new AppError(400, 'BATTLE_EXISTS', 'You already have an active battle with this user')
    }

    // Update challenger location
    if (lat != null && lng != null) {
      await supabase
        .from('users')
        .update({ last_lat: lat, last_lng: lng, last_location_at: new Date().toISOString() })
        .eq('clerk_id', userId)
    }

    const { data: battle, error } = await supabase
      .from('battles')
      .insert({
        challenger_id: userId,
        defender_id: defenderId,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    // TODO: send push notification to defender via Expo push

    return { ok: true, data: battle }
  })

  // ─── Accept a challenge ───────────────────────────────────────────
  app.post('/battles/:id/accept', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { id } = request.params as { id: string }

    const { data: battle } = await supabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single()

    if (!battle) throw new AppError(404, 'NOT_FOUND', 'Battle not found')
    if (battle.defender_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Only the defender can accept')
    if (battle.status !== 'pending') throw new AppError(400, 'INVALID_STATUS', 'Battle is not pending')

    const { data, error } = await supabase
      .from('battles')
      .update({ status: 'active' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return { ok: true, data }
  })

  // ─── Decline a challenge ──────────────────────────────────────────
  app.post('/battles/:id/decline', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { id } = request.params as { id: string }

    const { data: battle } = await supabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single()

    if (!battle) throw new AppError(404, 'NOT_FOUND', 'Battle not found')
    if (battle.defender_id !== userId && battle.challenger_id !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Not a participant')
    }
    if (battle.status === 'completed') throw new AppError(400, 'INVALID_STATUS', 'Battle already completed')

    const { data, error } = await supabase
      .from('battles')
      .update({ status: 'declined', completed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return { ok: true, data }
  })

  // ─── Submit moves ─────────────────────────────────────────────────
  app.post('/battles/:id/moves', {
    preHandler: validate(movesSchema),
  }, async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { id } = request.params as { id: string }
    const { moves } = request.body as z.infer<typeof movesSchema>

    const { data: battle } = await supabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single()

    if (!battle) throw new AppError(404, 'NOT_FOUND', 'Battle not found')
    if (battle.status !== 'active') throw new AppError(400, 'INVALID_STATUS', 'Battle is not active')

    const isChallenger = battle.challenger_id === userId
    const isDefender = battle.defender_id === userId
    if (!isChallenger && !isDefender) throw new AppError(403, 'FORBIDDEN', 'Not a participant')

    // Check if already submitted
    if (isChallenger && battle.challenger_moves?.length) {
      throw new AppError(400, 'MOVES_LOCKED', 'Moves already submitted')
    }
    if (isDefender && battle.defender_moves?.length) {
      throw new AppError(400, 'MOVES_LOCKED', 'Moves already submitted')
    }

    const update = isChallenger
      ? { challenger_moves: moves }
      : { defender_moves: moves }

    await supabase.from('battles').update(update).eq('id', id)

    // Re-fetch to check if both players have submitted
    const { data: updated } = await supabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single()

    if (updated?.challenger_moves?.length && updated?.defender_moves?.length) {
      // Both submitted — resolve battle
      const result = resolveBattle(
        updated.challenger_moves as Move[],
        updated.defender_moves as Move[],
        updated.challenger_id,
        updated.defender_id,
      )

      // Save rounds
      const roundInserts = result.rounds.map((r) => ({
        battle_id: id,
        round_number: r.round,
        challenger_move: r.challengerMove,
        defender_move: r.defenderMove,
        winner_id: r.winnerId,
      }))
      await supabase.from('battle_rounds').insert(roundInserts)

      // Update battle with result
      await supabase.from('battles').update({
        winner_id: result.winnerId,
        rounds_played: result.rounds.length,
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', id)

      const { data: final } = await supabase
        .from('battles')
        .select('*')
        .eq('id', id)
        .single()

      return {
        ok: true,
        data: {
          battle: final,
          result: {
            winnerId: result.winnerId,
            rounds: result.rounds,
            challengerWins: result.challengerWins,
            defenderWins: result.defenderWins,
          },
        },
      }
    }

    return {
      ok: true,
      data: { battle: updated, waiting: true },
    }
  })

  // ─── Get battle state ─────────────────────────────────────────────
  app.get('/battles/:id', async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { id } = request.params as { id: string }

    const { data: battle } = await supabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single()

    if (!battle) throw new AppError(404, 'NOT_FOUND', 'Battle not found')
    if (battle.challenger_id !== userId && battle.defender_id !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Not a participant')
    }

    // Only reveal opponent moves if battle is completed
    const isChallenger = battle.challenger_id === userId
    if (battle.status !== 'completed') {
      if (isChallenger) battle.defender_moves = null
      else battle.challenger_moves = null
    }

    let rounds: any[] = []
    if (battle.status === 'completed') {
      const { data } = await supabase
        .from('battle_rounds')
        .select('*')
        .eq('battle_id', id)
        .order('round_number')
      rounds = data ?? []
    }

    return { ok: true, data: { battle, rounds } }
  })

  // ─── Claim loot ───────────────────────────────────────────────────
  app.post('/battles/:id/loot', {
    preHandler: validate(lootSchema),
  }, async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { id } = request.params as { id: string }
    const { lootType } = request.body as z.infer<typeof lootSchema>

    const { data: battle } = await supabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single()

    if (!battle) throw new AppError(404, 'NOT_FOUND', 'Battle not found')
    if (battle.status !== 'completed') throw new AppError(400, 'INVALID_STATUS', 'Battle not completed')
    if (battle.winner_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Only the winner can claim loot')
    if (battle.loot_type) throw new AppError(400, 'ALREADY_CLAIMED', 'Loot already claimed')

    if (lootType === 'points') {
      const points = spinLootWheel()
      await supabase.from('battles').update({
        loot_type: 'points',
        loot_amount: points,
      }).eq('id', id)

      // Add points to winner
      await supabase.rpc('increment_consumer_points', {
        p_clerk_id: userId,
        p_amount: points,
      }).catch(() => {
        // If RPC doesn't exist, update directly
        return supabase
          .from('users')
          .update({ consumer_points: supabase.rpc('consumer_points + ' + points) as any })
          .eq('clerk_id', userId)
      })

      return { ok: true, data: { lootType: 'points', amount: points } }
    }

    // Loot type: coupon — steal a random lootable coupon from loser
    const loserId = battle.challenger_id === userId ? battle.defender_id : battle.challenger_id
    const { data: loserCoupons } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', loserId)
      .eq('is_lootable', true)
      .gt('expires_at', new Date().toISOString())
      .limit(10)

    if (!loserCoupons?.length) {
      // No coupons to steal — fall back to points
      const points = spinLootWheel()
      await supabase.from('battles').update({
        loot_type: 'points',
        loot_amount: points,
      }).eq('id', id)

      return { ok: true, data: { lootType: 'points', amount: points, fallback: true } }
    }

    // Pick a random coupon
    const stolen = loserCoupons[Math.floor(Math.random() * loserCoupons.length)]

    // Transfer ownership
    await supabase.from('wallets').update({ user_id: userId }).eq('id', stolen.id)

    await supabase.from('battles').update({
      loot_type: 'coupon',
      loot_coupon_id: stolen.id,
    }).eq('id', id)

    return {
      ok: true,
      data: {
        lootType: 'coupon',
        coupon: {
          id: stolen.id,
          prizeName: stolen.prize_name,
          businessName: stolen.business_name,
          expiresAt: stolen.expires_at,
        },
      },
    }
  })

  // ─── Nearby battle-enabled users ──────────────────────────────────
  app.get('/battles/nearby', {
    preHandler: validateQuery(nearbySchema),
  }, async (request) => {
    const { userId } = (request as AuthenticatedRequest).auth
    const { lat, lng, radius } = request.query as z.infer<typeof nearbySchema>

    // Update caller's location
    await supabase
      .from('users')
      .update({ last_lat: lat, last_lng: lng, last_location_at: new Date().toISOString() })
      .eq('clerk_id', userId)

    // Find nearby users with battle mode on, updated within last 30 minutes
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

    const { data: nearbyUsers, error } = await supabase
      .from('users')
      .select('clerk_id, display_name, consumer_tier, last_lat, last_lng')
      .eq('battle_mode_enabled', true)
      .neq('clerk_id', userId)
      .gte('last_location_at', thirtyMinAgo)
      .not('last_lat', 'is', null)
      .not('last_lng', 'is', null)

    if (error) throw error

    // Filter by distance (Haversine approximation)
    const radiusM = radius
    const results = (nearbyUsers ?? [])
      .map((u) => {
        const dLat = ((u.last_lat! - lat) * Math.PI) / 180
        const dLng = ((u.last_lng! - lng) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat * Math.PI) / 180) *
          Math.cos((u.last_lat! * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2
        const distanceM = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return { ...u, distanceM: Math.round(distanceM) }
      })
      .filter((u) => u.distanceM <= radiusM)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 20)

    return { ok: true, data: results }
  })

  // ─── Demo battle (no auth) ──────────────────────────────────────
  app.post('/battles/demo', async (request) => {
    const body = request.body as { moves?: string[] }
    if (!body.moves || body.moves.length !== 3) {
      throw new AppError(400, 'INVALID_INPUT', 'Provide exactly 3 moves')
    }
    const validMoves = ['rock', 'paper', 'scissors']
    if (!body.moves.every((m: string) => validMoves.includes(m))) {
      throw new AppError(400, 'INVALID_MOVES', 'Moves must be rock, paper, or scissors')
    }

    const playerMoves = body.moves as Move[]

    // House wins ~45%, player wins ~45%, draw ~10%
    const houseMoves: Move[] = playerMoves.map((pm) => {
      const roll = Math.random()
      if (roll < 0.45) {
        // Let player win
        const beats: Record<string, Move> = { rock: 'scissors', paper: 'rock', scissors: 'paper' }
        return beats[pm]
      } else if (roll < 0.90) {
        // House wins
        const loses: Record<string, Move> = { rock: 'paper', paper: 'scissors', scissors: 'rock' }
        return loses[pm]
      } else {
        return pm // draw
      }
    })

    const result = resolveBattle(playerMoves, houseMoves, 'player', 'house')

    return {
      ok: true,
      data: {
        winner: result.winnerId ?? 'draw',
        rounds: result.rounds,
        playerMoves,
        houseMoves,
        challengerWins: result.challengerWins,
        defenderWins: result.defenderWins,
      },
    }
  })

  // ─── Business Battle Station: get config ──────────────────────────
  app.get('/battles/business-station/:businessId', async (request) => {
    const { businessId } = request.params as { businessId: string }

    const { data: station } = await supabase
      .from('business_battle_stations')
      .select('*')
      .eq('business_id', businessId)
      .single()

    if (!station || !station.is_enabled) {
      throw new AppError(404, 'STATION_NOT_FOUND', 'Battle station not found or disabled')
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('name, slug')
      .eq('id', businessId)
      .single()

    // Get prize info if configured
    let prize = null
    if (station.prize_id) {
      const { data: p } = await supabase
        .from('prizes')
        .select('id, label, emoji')
        .eq('id', station.prize_id)
        .single()
      prize = p
    }

    return {
      ok: true,
      data: {
        businessId,
        businessName: business?.name ?? 'Unknown',
        isEnabled: station.is_enabled,
        prize,
        stats: {
          totalScans: station.total_scans,
          totalPlays: station.total_plays,
          totalWins: station.total_wins,
        },
      },
    }
  })

  // ─── Business Battle Station: play a round ────────────────────────
  app.post('/battles/business-station/:businessId', async (request) => {
    const { businessId } = request.params as { businessId: string }
    const body = request.body as { moves: string[]; sessionId: string }

    if (!body.moves || body.moves.length !== 3 || !body.sessionId) {
      throw new AppError(400, 'INVALID_INPUT', 'Provide 3 moves and a sessionId')
    }

    const validMoves = ['rock', 'paper', 'scissors']
    if (!body.moves.every((m: string) => validMoves.includes(m))) {
      throw new AppError(400, 'INVALID_MOVES', 'Moves must be rock, paper, or scissors')
    }

    // Get station config
    const { data: station } = await supabase
      .from('business_battle_stations')
      .select('*')
      .eq('business_id', businessId)
      .single()

    if (!station || !station.is_enabled) {
      throw new AppError(404, 'STATION_NOT_FOUND', 'Battle station not found or disabled')
    }

    // Generate house moves — biased to let player win ~60% of time
    const winProb = (station.win_probability ?? 60) / 100
    const playerMoves = body.moves as Move[]
    const houseMoves: Move[] = playerMoves.map((pm) => {
      const roll = Math.random()
      if (roll < winProb) {
        // Let player win this round — pick the move that loses to player
        const beats: Record<string, Move> = { rock: 'scissors', paper: 'rock', scissors: 'paper' }
        return beats[pm]
      } else {
        // House wins or draws — pick randomly from winning/drawing moves
        const loses: Record<string, Move> = { rock: 'paper', paper: 'scissors', scissors: 'rock' }
        return Math.random() < 0.7 ? loses[pm] : pm // 70% win, 30% draw
      }
    })

    // Resolve
    const result = resolveBattle(playerMoves, houseMoves, 'player', 'house')
    const winner = result.winnerId === 'player' ? 'player' as const
      : result.winnerId === 'house' ? 'house' as const
      : 'draw' as const

    // Generate prize code if player wins
    let prizeCode: string | null = null
    if (winner === 'player') {
      prizeCode = `WIN-${businessId.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    }

    // Save to guest_battles
    await supabase.from('guest_battles').insert({
      business_id: businessId,
      session_id: body.sessionId,
      player_moves: playerMoves,
      house_moves: houseMoves,
      winner,
      prize_code: prizeCode,
    })

    // Update station stats
    await supabase.from('business_battle_stations').update({
      total_plays: (station.total_plays ?? 0) + 1,
      total_wins: (station.total_wins ?? 0) + (winner === 'player' ? 1 : 0),
    }).eq('business_id', businessId)

    return {
      ok: true,
      data: {
        winner,
        rounds: result.rounds,
        playerMoves,
        houseMoves,
        prizeCode,
      },
    }
  })
}
