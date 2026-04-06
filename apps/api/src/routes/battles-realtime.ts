import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validate } from '../lib/validate.js'
import { supabase } from '../lib/supabase.js'
import { AppError } from '../lib/errors.js'
import { BOT_USER_ID, getBotLootbox, transferBotItem, isBot } from '../lib/houseBot.js'
import { checkDrawStreak } from '../lib/badges.js'

const BEATS: Record<string, string> = { rock: 'scissors', scissors: 'paper', paper: 'rock' }

function resolveRound(a: string, b: string): 'challenger' | 'defender' | 'draw' {
  if (a === b) return 'draw'
  return BEATS[a] === b ? 'challenger' : 'defender'
}

const createSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1).max(30).default('Challenger'),
  message: z.string().max(150).optional(),
})

const joinSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1).max(30).default('Opponent'),
})

const moveSchema = z.object({
  playerId: z.string().min(1),
  round: z.number().int().min(1).max(10),
  move: z.enum(['rock', 'paper', 'scissors']),
})

export async function battleRealtimeRoutes(app: FastifyInstance) {
  // ─── Create a waiting battle ───────────────────────────────────────
  app.post('/battles/create', {
    preHandler: validate(createSchema),
  }, async (request) => {
    const { playerId, playerName, message } = request.body as z.infer<typeof createSchema>

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const { data: battle, error } = await supabase
      .from('battles')
      .insert({
        challenger_id: playerId,
        challenger_name: playerName,
        challenger_message: message || null,
        status: 'waiting',
        expires_at: expiresAt,
        current_round: 1,
        round_results: [],
      })
      .select()
      .single()

    if (error) throw error

    return { ok: true, data: battle }
  })

  // ─── Get battle state (public) ─────────────────────────────────────
  app.get('/battles/:id/state', async (request) => {
    const { id } = request.params as { id: string }

    const { data: battle } = await supabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single()

    if (!battle) throw new AppError(404, 'NOT_FOUND', 'Battle not found')

    // Check if expired
    if (battle.status === 'waiting' && battle.expires_at && new Date(battle.expires_at) < new Date()) {
      await supabase.from('battles').update({ status: 'expired', completed_at: new Date().toISOString() }).eq('id', id)
      battle.status = 'expired'
    }

    // Get moves for completed rounds only (don't reveal pending moves)
    const { data: moves } = await supabase
      .from('battle_moves')
      .select('*')
      .eq('battle_id', id)
      .order('round')
      .order('submitted_at')

    return { ok: true, data: { battle, moves: moves ?? [] } }
  })

  // ─── Join a battle (Player B) ──────────────────────────────────────
  app.post('/battles/:id/join', {
    preHandler: validate(joinSchema),
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { playerId, playerName } = request.body as z.infer<typeof joinSchema>

    const { data: battle } = await supabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single()

    if (!battle) throw new AppError(404, 'NOT_FOUND', 'Battle not found')

    if (battle.status === 'expired' || (battle.expires_at && new Date(battle.expires_at) < new Date())) {
      throw new AppError(400, 'EXPIRED', 'This challenge has expired')
    }
    if (battle.status === 'active') {
      // Someone already accepted — create a bot battle for this player instead
      const { data: botBattle, error: botErr } = await supabase
        .from('battles')
        .insert({
          challenger_id: playerId,
          challenger_name: playerName,
          defender_id: BOT_USER_ID,
          defender_name: 'The House',
          status: 'active',
          current_round: 1,
          is_bot_battle: true,
          player_win_probability: 0.75,
          challenger_message: battle.challenger_message,
        })
        .select()
        .single()

      if (botErr || !botBattle) throw new AppError(500, 'BOT_BATTLE_FAILED', 'Failed to create bot battle')

      return {
        ok: true,
        data: botBattle,
        redirected: true,
        new_battle_id: botBattle.id,
        message: "Someone got there first. The House steps in. Your odds just got better.",
      }
    }
    if (battle.status === 'completed' || battle.status === 'forfeit') {
      throw new AppError(400, 'ALREADY_DONE', 'This challenge has ended')
    }
    if (battle.status !== 'waiting') {
      throw new AppError(400, 'INVALID_STATUS', `Cannot join battle in status: ${battle.status}`)
    }
    if (battle.challenger_id === playerId) {
      throw new AppError(400, 'SELF_JOIN', 'You cannot join your own battle')
    }

    const { data, error } = await supabase
      .from('battles')
      .update({
        defender_id: playerId,
        defender_name: playerName,
        status: 'active',
        current_round: 1,
      })
      .eq('id', id)
      .eq('status', 'waiting')
      .select()
      .single()

    if (error) throw error
    if (!data) throw new AppError(400, 'JOIN_FAILED', 'Battle could not be joined — may have been taken')

    return { ok: true, data }
  })

  // ─── Submit a move for current round ───────────────────────────────
  app.post('/battles/:id/move', {
    preHandler: validate(moveSchema),
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { playerId, round, move } = request.body as z.infer<typeof moveSchema>

    const { data: battle } = await supabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single()

    if (!battle) throw new AppError(404, 'NOT_FOUND', 'Battle not found')
    if (battle.status !== 'active') throw new AppError(400, 'NOT_ACTIVE', 'Battle is not active')

    const isChallenger = battle.challenger_id === playerId
    const isDefender = battle.defender_id === playerId
    if (!isChallenger && !isDefender) throw new AppError(403, 'FORBIDDEN', 'Not a participant')

    const playerRole = isChallenger ? 'challenger' : 'defender'

    // Check if move already submitted for this round
    const { data: existing } = await supabase
      .from('battle_moves')
      .select('id')
      .eq('battle_id', id)
      .eq('round', round)
      .eq('player_role', playerRole)
      .single()

    if (existing) throw new AppError(400, 'ALREADY_SUBMITTED', 'Move already submitted for this round')

    // Insert the move
    const { error: insertErr } = await supabase
      .from('battle_moves')
      .insert({
        battle_id: id,
        round,
        player_role: playerRole,
        move,
      })

    if (insertErr) throw insertErr

    // Check if both players have submitted for this round
    const { data: roundMoves } = await supabase
      .from('battle_moves')
      .select('*')
      .eq('battle_id', id)
      .eq('round', round)

    if (roundMoves && roundMoves.length === 2) {
      // Both submitted — resolve this round
      const challengerMove = roundMoves.find(m => m.player_role === 'challenger')!.move
      const defenderMove = roundMoves.find(m => m.player_role === 'defender')!.move
      const winner = resolveRound(challengerMove, defenderMove)

      const roundResult = {
        round,
        challengerMove,
        defenderMove,
        winner,
        winnerId: winner === 'challenger' ? battle.challenger_id
          : winner === 'defender' ? battle.defender_id
          : null,
      }

      // Add to round_results array
      const existingResults = battle.round_results || []
      const updatedResults = [...existingResults, roundResult]

      // Count wins
      let challengerWins = 0
      let defenderWins = 0
      for (const r of updatedResults) {
        if (r.winner === 'challenger') challengerWins++
        else if (r.winner === 'defender') defenderWins++
      }

      // Check for match end (first to 2 wins)
      let newStatus = 'active'
      let winnerId = null
      let nextRound = round + 1

      // Count total draws
      let totalDraws = 0
      for (const r of updatedResults) {
        if (r.winner === 'draw') totalDraws++
      }

      if (challengerWins >= 2) {
        newStatus = 'completed'
        winnerId = battle.challenger_id
      } else if (defenderWins >= 2) {
        newStatus = 'completed'
        winnerId = battle.defender_id
      }

      // Tournament sudden death: after 10 consecutive draws, next non-draw wins
      let suddenDeath = false
      if (newStatus === 'active') {
        // Count consecutive draws at end of results
        let consecutiveDraws = 0
        for (let i = updatedResults.length - 1; i >= 0; i--) {
          if (updatedResults[i].winner === 'draw') consecutiveDraws++
          else break
        }
        if (consecutiveDraws >= 10 && winner !== 'draw') {
          // This non-draw round after 10+ draws wins the match regardless
          newStatus = 'completed'
          winnerId = winner === 'challenger' ? battle.challenger_id : battle.defender_id
          suddenDeath = true
        }
        if (consecutiveDraws >= 10) suddenDeath = true
      }

      const updateData: any = {
        round_results: updatedResults,
        current_round: newStatus === 'completed' ? round : nextRound,
        challenger_round_wins: challengerWins,
        defender_round_wins: defenderWins,
        total_draws: totalDraws,
        total_rounds_played: round,
      }

      if (newStatus === 'completed') {
        updateData.status = 'completed'
        updateData.winner_id = winnerId
        updateData.completed_at = new Date().toISOString()
        updateData.rounds_played = round
      }

      await supabase.from('battles').update(updateData).eq('id', id)

      // Also save to battle_rounds table for history
      try {
        await supabase.from('battle_rounds').insert({
          battle_id: id,
          round_number: round,
          challenger_move: challengerMove,
          defender_move: defenderMove,
          winner_id: roundResult.winnerId,
        })
      } catch {}

      // Check draw streak for traveling badge
      let drawStreakResult = null
      try {
        drawStreakResult = await checkDrawStreak(id, battle.challenger_id, battle.defender_id, winner)
      } catch {}

      return {
        ok: true,
        data: {
          resolved: true,
          roundResult,
          challengerWins,
          defenderWins,
          matchComplete: newStatus === 'completed',
          winnerId,
          drawStreak: drawStreakResult,
          suddenDeath,
          totalDraws,
        },
      }
    }

    // Only one player submitted so far — waiting
    return {
      ok: true,
      data: { resolved: false, waiting: true },
    }
  })

  // ─── Cancel a waiting battle ───────────────────────────────────────
  app.post('/battles/:id/cancel', async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as { playerId: string }

    if (!body.playerId) throw new AppError(400, 'MISSING_PLAYER', 'playerId required')

    const { data: battle } = await supabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single()

    if (!battle) throw new AppError(404, 'NOT_FOUND', 'Battle not found')
    if (battle.challenger_id !== body.playerId) throw new AppError(403, 'FORBIDDEN', 'Only challenger can cancel')

    if (battle.status === 'waiting') {
      await supabase.from('battles').update({
        status: 'declined',
        completed_at: new Date().toISOString(),
      }).eq('id', id)
      return { ok: true }
    }

    throw new AppError(400, 'CANNOT_CANCEL', 'Can only cancel waiting battles')
  })

  // ─── Forfeit (disconnect) ──────────────────────────────────────────
  app.post('/battles/:id/forfeit', async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as { playerId: string }

    if (!body.playerId) throw new AppError(400, 'MISSING_PLAYER', 'playerId required')

    const { data: battle } = await supabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single()

    if (!battle) throw new AppError(404, 'NOT_FOUND', 'Battle not found')
    if (battle.status !== 'active') throw new AppError(400, 'NOT_ACTIVE', 'Battle is not active')

    const isChallenger = battle.challenger_id === body.playerId
    const isDefender = battle.defender_id === body.playerId
    if (!isChallenger && !isDefender) throw new AppError(403, 'FORBIDDEN', 'Not a participant')

    const winnerId = isChallenger ? battle.defender_id : battle.challenger_id

    await supabase.from('battles').update({
      status: 'forfeit',
      winner_id: winnerId,
      completed_at: new Date().toISOString(),
    }).eq('id', id)

    return { ok: true, data: { winnerId } }
  })

  // ─── Double or Nothing ───────────────���──────────────────────────────
  app.post('/battles/:id/double-or-nothing', async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as { playerId: string }

    if (!body.playerId) throw new AppError(400, 'MISSING_PLAYER', 'playerId required')

    const { data: battle } = await supabase
      .from('battles')
      .select('*')
      .eq('id', id)
      .single()

    if (!battle) throw new AppError(404, 'NOT_FOUND', 'Battle not found')
    if (battle.status !== 'completed') throw new AppError(400, 'NOT_DONE', 'Battle not completed')
    if (battle.winner_id !== body.playerId) throw new AppError(403, 'NOT_WINNER', 'Only the winner can initiate')

    const newCount = (battle.double_or_nothing_count ?? 0) + 1
    const newStake = Math.min(Math.pow(2, newCount), 8)

    if (battle.is_bot_battle) {
      // Bot auto-accepts — create new battle with adjusted probability
      const { getDoubleProbability } = await import('../lib/houseBot.js')
      const newProb = getDoubleProbability(newCount)

      const { data: newBattle, error } = await supabase
        .from('battles')
        .insert({
          challenger_id: body.playerId,
          challenger_name: battle.challenger_name,
          defender_id: BOT_USER_ID,
          defender_name: 'The House',
          status: 'active',
          current_round: 1,
          is_bot_battle: true,
          player_win_probability: newProb,
          double_or_nothing_count: newCount,
          stake_multiplier: newStake,
          parent_battle_id: id,
          challenger_message: battle.challenger_message,
        })
        .select()
        .single()

      if (error || !newBattle) throw new AppError(500, 'FAILED', 'Failed to create double-or-nothing battle')

      return {
        ok: true,
        data: {
          newBattleId: newBattle.id,
          doubleCount: newCount,
          stakeMultiplier: newStake,
          playerWinProbability: newProb,
          message: newProb === 0.5 ? 'The House evens the odds. Pure fate now.' : `Your odds: ${Math.round(newProb * 100)}%`,
        },
      }
    }

    // P2P: broadcast double-or-nothing request via Realtime (update battle)
    await supabase.from('battles').update({
      double_or_nothing_count: newCount,
      stake_multiplier: newStake,
    }).eq('id', id)

    return {
      ok: true,
      data: {
        doubleCount: newCount,
        stakeMultiplier: newStake,
        waitingForResponse: true,
      },
    }
  })

  // ─── Save push subscription (guest-compatible) ─────────────────────
  app.post('/push-subscribe', async (request) => {
    const body = request.body as { subscription: any; guestId?: string; proximityCell?: string }
    if (!body.subscription || !body.guestId) {
      throw new AppError(400, 'MISSING', 'subscription and guestId required')
    }

    await supabase.from('push_subscriptions').delete().eq('guest_id', body.guestId)
    await supabase.from('push_subscriptions').insert({
      guest_id: body.guestId,
      subscription: body.subscription,
      proximity_cell: body.proximityCell ?? null,
    })

    return { ok: true }
  })

  // ─── Get bot lootbox (for loot picking after winning vs bot) ───────
  app.get('/battles/:id/bot-lootbox', async (request) => {
    const { id } = request.params as { id: string }

    const { data: battle } = await supabase
      .from('battles')
      .select('status, winner_id, defender_id, challenger_id')
      .eq('id', id)
      .single()

    if (!battle) throw new AppError(404, 'NOT_FOUND', 'Battle not found')
    if (battle.status !== 'completed') throw new AppError(400, 'NOT_DONE', 'Battle not completed')

    // Only show if opponent was the bot
    const isBotBattle = isBot(battle.defender_id) || isBot(battle.challenger_id)
    if (!isBotBattle) throw new AppError(400, 'NOT_BOT', 'Not a bot battle')

    const items = await getBotLootbox()
    return { ok: true, data: items }
  })

  // ─── Loot item from bot ────────────────────────────────────────────
  app.post('/battles/:id/loot-bot', async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as { playerId: string; botLootboxId: string }

    if (!body.playerId || !body.botLootboxId) {
      throw new AppError(400, 'MISSING_FIELDS', 'playerId and botLootboxId required')
    }

    const { data: battle } = await supabase
      .from('battles')
      .select('status, winner_id, defender_id, challenger_id, loot_type')
      .eq('id', id)
      .single()

    if (!battle) throw new AppError(404, 'NOT_FOUND', 'Battle not found')
    if (battle.status !== 'completed') throw new AppError(400, 'NOT_DONE', 'Battle not completed')
    if (battle.winner_id !== body.playerId) throw new AppError(403, 'NOT_WINNER', 'Only winner can loot')
    if (battle.loot_type) throw new AppError(400, 'ALREADY_LOOTED', 'Already claimed loot')

    const wallet = await transferBotItem(body.botLootboxId, body.playerId)
    if (!wallet) throw new AppError(404, 'ITEM_GONE', 'Item no longer available')

    await supabase.from('battles').update({
      loot_type: 'coupon',
      loot_coupon_id: wallet.id,
    }).eq('id', id)

    return {
      ok: true,
      data: {
        type: 'coupon',
        item: {
          id: wallet.id,
          prizeName: wallet.prize_name,
          businessName: wallet.business_name,
          couponType: wallet.coupon_type,
        },
      },
    }
  })
}
