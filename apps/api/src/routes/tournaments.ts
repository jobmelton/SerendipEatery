import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validate } from '../lib/validate.js'
import { supabase } from '../lib/supabase.js'
import { AppError } from '../lib/errors.js'
import {
  advanceWinner,
  generateJoinCode,
  startSocialTournament,
} from '../lib/tournament.js'
import { getCurrentAttempt } from '../lib/record-engine.js'
import { sendSms, toE164 } from '../lib/sms.js'

const createSchema = z.object({
  hostId: z.string().min(1),
  hostName: z.string().min(1).max(30).default('Host'),
  name: z.string().min(1).max(80).default('Tonight\'s RPS'),
  format: z.enum(['single_elimination', 'double_elimination']).default('single_elimination'),
  maxPlayers: z.number().int().min(2).max(64).default(8),
  stakes: z.string().max(140).optional(),
  autoStart: z.boolean().optional(),
  recordParticipantId: z.string().uuid().optional(),
  userId: z.string().optional(),
  guestId: z.string().optional(),
})

const joinSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1).max(30).default('Player'),
  recordParticipantId: z.string().uuid().optional(),
  userId: z.string().optional(),
  guestId: z.string().optional(),
})

const inviteSchema = z.object({
  phones: z.array(z.string().min(7).max(20)).min(1).max(32),
  fromName: z.string().min(1).max(30).optional(),
})

async function requireVerifiedRecordPlayer(opts: {
  recordParticipantId?: string
  userId?: string
  guestId?: string
}) {
  const attempt = await getCurrentAttempt()
  if (!attempt) return null

  let query = supabase.from('record_participants').select('id, phone_verified_at, legal_name, participant_name, guest_id, user_id')
    .eq('attempt_id', attempt.id)

  if (opts.recordParticipantId) {
    const { data } = await query.eq('id', opts.recordParticipantId).maybeSingle()
    if (data?.phone_verified_at) return data
  }
  if (opts.userId) {
    const { data } = await supabase.from('record_participants').select('id, phone_verified_at, legal_name, participant_name, guest_id, user_id')
      .eq('attempt_id', attempt.id).eq('user_id', opts.userId).maybeSingle()
    if (data?.phone_verified_at) return data
  }
  if (opts.guestId) {
    const { data } = await supabase.from('record_participants').select('id, phone_verified_at, legal_name, participant_name, guest_id, user_id')
      .eq('attempt_id', attempt.id).eq('guest_id', opts.guestId).maybeSingle()
    if (data?.phone_verified_at) return data
  }

  throw new AppError(403, 'NEED_RECORD_REGISTRATION', 'Register and verify your phone for the Guinness attempt first — then you can play with friends.')
}

const startSchema = z.object({
  hostId: z.string().min(1),
})

const matchCompleteSchema = z.object({
  winnerId: z.string().min(1),
  loserId: z.string().min(1),
})

export async function tournamentRoutes(app: FastifyInstance) {
  // ─── Create Tournament ───────────────────────────────────────────────
  app.post('/tournaments/create', {
    preHandler: validate(createSchema),
  }, async (request) => {
    const { hostId, hostName, name, format, maxPlayers, stakes, autoStart, recordParticipantId, userId, guestId } = request.body as z.infer<typeof createSchema>

    await requireVerifiedRecordPlayer({ recordParticipantId, userId, guestId: guestId || hostId })

    const joinCode = await generateJoinCode()

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        host_id: hostId,
        host_name: hostName,
        name,
        stakes: stakes?.trim() || null,
        kind: 'social',
        auto_start: autoStart !== false,
        requires_record: true,
        join_code: joinCode,
        format,
        max_players: maxPlayers,
        status: 'lobby',
      })
      .select()
      .single()

    if (error) throw error

    // Auto-add host as first player
    await supabase.from('tournament_players').insert({
      tournament_id: tournament.id,
      player_id: hostId,
      player_name: hostName,
      seed: 1,
    })

    return { ok: true, data: tournament }
  })

  // ─── Get Tournament State ────────────────────────────────────────────
  app.get('/tournaments/:id', async (request) => {
    const { id } = request.params as { id: string }

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single()

    if (!tournament) throw new AppError(404, 'NOT_FOUND', 'Tournament not found')

    const { data: players } = await supabase
      .from('tournament_players')
      .select('*')
      .eq('tournament_id', id)
      .order('seed')

    const { data: matches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', id)
      .order('round')
      .order('match_index')

    return { ok: true, data: { tournament, players: players ?? [], matches: matches ?? [] } }
  })

  // ─── Lookup by Join Code ─────────────────────────────────────────────
  app.get('/tournaments/code/:code', async (request) => {
    const { code } = request.params as { code: string }

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('join_code', code.toUpperCase())
      .single()

    if (!tournament) throw new AppError(404, 'NOT_FOUND', 'Tournament not found')

    const { data: players } = await supabase
      .from('tournament_players')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('seed')

    return { ok: true, data: { tournament, players: players ?? [] } }
  })

  // ─── Join Tournament ─────────────────────────────────────────────────
  app.post('/tournaments/:id/join', {
    preHandler: validate(joinSchema),
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { playerId, playerName, recordParticipantId, userId, guestId } = request.body as z.infer<typeof joinSchema>
    await requireVerifiedRecordPlayer({ recordParticipantId, userId, guestId: guestId || playerId })

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('status, max_players, auto_start')
      .eq('id', id)
      .single()

    if (!tournament) throw new AppError(404, 'NOT_FOUND', 'Tournament not found')
    if (tournament.status !== 'lobby') throw new AppError(400, 'NOT_LOBBY', 'Tournament already started')

    // Check player count
    const { count } = await supabase
      .from('tournament_players')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', id)

    if ((count ?? 0) >= tournament.max_players) {
      throw new AppError(400, 'FULL', 'Tournament is full')
    }

    // Check not already joined
    const { data: existing } = await supabase
      .from('tournament_players')
      .select('id')
      .eq('tournament_id', id)
      .eq('player_id', playerId)
      .single()

    if (existing) {
      throw new AppError(400, 'ALREADY_JOINED', 'Already in this tournament')
    }

    const seed = (count ?? 0) + 1

    const { data: player, error } = await supabase
      .from('tournament_players')
      .insert({
        tournament_id: id,
        player_id: playerId,
        player_name: playerName,
        seed,
      })
      .select()
      .single()

    if (error) throw error

    // Broadcast player joined
    await supabase.channel(`tournament:${id}`).send({
      type: 'broadcast',
      event: 'player_joined',
      payload: { player },
    })

    const filled = (count ?? 0) + 1
    if (tournament.auto_start !== false && filled >= tournament.max_players) {
      try {
        await startSocialTournament(id)
      } catch (err) {
        console.error('[tournament] auto-start failed', err)
      }
    }

    return { ok: true, data: player, autoStarted: filled >= (tournament.max_players ?? 99) }
  })

  // ─── Leave Tournament (lobby only) ───────────────────────────────────
  app.post('/tournaments/:id/leave', async (request) => {
    const { id } = request.params as { id: string }
    const body = request.body as { playerId: string }

    if (!body.playerId) throw new AppError(400, 'MISSING', 'playerId required')

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('status, host_id')
      .eq('id', id)
      .single()

    if (!tournament) throw new AppError(404, 'NOT_FOUND', 'Tournament not found')
    if (tournament.status !== 'lobby') throw new AppError(400, 'STARTED', 'Cannot leave after tournament starts')

    if (body.playerId === tournament.host_id) {
      // Host leaves = cancel tournament
      await supabase.from('tournaments').update({ status: 'cancelled' }).eq('id', id)
      return { ok: true, cancelled: true }
    }

    await supabase.from('tournament_players')
      .delete()
      .eq('tournament_id', id)
      .eq('player_id', body.playerId)

    return { ok: true }
  })

  // ─── Start Tournament (host only) ────────────────────────────────────
  app.post('/tournaments/:id/start', {
    preHandler: validate(startSchema),
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { hostId } = request.body as z.infer<typeof startSchema>

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single()

    if (!tournament) throw new AppError(404, 'NOT_FOUND', 'Tournament not found')
    if (tournament.host_id !== hostId) throw new AppError(403, 'NOT_HOST', 'Only the host can start')
    if (tournament.status !== 'lobby') throw new AppError(400, 'NOT_LOBBY', 'Tournament already started')

    try {
      const result = await startSocialTournament(id)
      return { ok: true, data: result }
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_ENOUGH') {
        throw new AppError(400, 'NOT_ENOUGH', 'Need at least 2 players')
      }
      throw err
    }
  })

  // ─── SMS invites ─────────────────────────────────────────────────────
  app.post('/tournaments/:id/invite', {
    preHandler: validate(inviteSchema),
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { phones, fromName } = request.body as z.infer<typeof inviteSchema>

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, join_code, stakes, status')
      .eq('id', id)
      .single()
    if (!tournament) throw new AppError(404, 'NOT_FOUND', 'Tournament not found')
    if (tournament.status !== 'lobby') throw new AppError(400, 'NOT_LOBBY', 'Tournament already started')

    const web = process.env.CLERK_WEB_URL || 'https://serendip.app'
    const joinUrl = `${web}/tournament/join/${tournament.join_code}`
    const recordUrl = `${web}/record`
    const who = fromName || 'A friend'
    const stakes = tournament.stakes ? ` Winner decides: ${tournament.stakes}.` : ''

    let sent = 0
    for (const raw of phones) {
      const to = toE164(raw)
      if (!to) continue
      const body = `${who} invited you to ${tournament.name} (code ${tournament.join_code}).${stakes} Join: ${joinUrl} — Register for the 50,000-player Guinness RPS attempt first: ${recordUrl}`
      await sendSms({ to, body, template: 'social_invite' })
      sent++
    }

    return { ok: true, data: { sent } }
  })

  // ─── Start a Match (creates battle) ──────────────────────────────────
  app.post('/tournaments/matches/:matchId/start', async (request) => {
    const { matchId } = request.params as { matchId: string }
    const body = request.body as { playerId: string }

    if (!body.playerId) throw new AppError(400, 'MISSING', 'playerId required')

    const { data: match } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (!match) throw new AppError(404, 'NOT_FOUND', 'Match not found')
    if (match.status !== 'ready') throw new AppError(400, 'NOT_READY', 'Match is not ready')
    if (body.playerId !== match.player1_id && body.playerId !== match.player2_id) {
      throw new AppError(403, 'NOT_PARTICIPANT', 'Not a participant in this match')
    }

    // If battle already created, return it
    if (match.battle_id) {
      return { ok: true, data: { battleId: match.battle_id, alreadyStarted: true } }
    }

    // Create a real RPS battle
    const isP1 = body.playerId === match.player1_id
    const challengerId = match.player1_id
    const challengerName = match.player1_name || 'Player 1'

    const { data: battle, error } = await supabase
      .from('battles')
      .insert({
        challenger_id: challengerId,
        challenger_name: challengerName,
        defender_id: match.player2_id,
        defender_name: match.player2_name || 'Player 2',
        status: 'active',
        current_round: 1,
        round_results: [],
        challenger_message: `Tournament Match — Round ${match.round}`,
      })
      .select()
      .single()

    if (error) throw error

    // Link battle to match
    await supabase.from('tournament_matches').update({
      battle_id: battle.id,
      status: 'active',
      started_at: new Date().toISOString(),
    }).eq('id', matchId)

    // Broadcast match started
    await supabase.channel(`tournament:${match.tournament_id}`).send({
      type: 'broadcast',
      event: 'match_started',
      payload: { matchId, player1: match.player1_id, player2: match.player2_id, battleId: battle.id },
    })

    return { ok: true, data: { battleId: battle.id } }
  })

  // ─── Report Match Result (called after battle completes) ─────────────
  app.post('/tournaments/matches/:matchId/complete', {
    preHandler: validate(matchCompleteSchema),
  }, async (request) => {
    const { matchId } = request.params as { matchId: string }
    const { winnerId, loserId } = request.body as z.infer<typeof matchCompleteSchema>

    const { data: match } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (!match) throw new AppError(404, 'NOT_FOUND', 'Match not found')
    if (match.status === 'completed') throw new AppError(400, 'DONE', 'Match already completed')

    // Verify winner is a participant
    if (winnerId !== match.player1_id && winnerId !== match.player2_id) {
      throw new AppError(400, 'INVALID_WINNER', 'Winner must be a match participant')
    }

    // Update match
    await supabase.from('tournament_matches').update({
      winner_id: winnerId,
      loser_id: loserId,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', matchId)

    // Update player stats
    await supabase.from('tournament_players')
      .update({ wins: supabase.rpc as any }) // We'll just increment directly
    await supabase.rpc('increment_tournament_wins', { p_tournament_id: match.tournament_id, p_player_id: winnerId }).catch(() => {
      // If RPC doesn't exist, update directly
      supabase.from('tournament_players')
        .select('wins')
        .eq('tournament_id', match.tournament_id)
        .eq('player_id', winnerId)
        .single()
        .then(({ data }) => {
          if (data) {
            supabase.from('tournament_players')
              .update({ wins: (data.wins ?? 0) + 1 })
              .eq('tournament_id', match.tournament_id)
              .eq('player_id', winnerId)
          }
        })
    })

    await supabase.from('tournament_players')
      .select('losses')
      .eq('tournament_id', match.tournament_id)
      .eq('player_id', loserId)
      .single()
      .then(({ data }) => {
        if (data) {
          supabase.from('tournament_players')
            .update({ losses: (data.losses ?? 0) + 1 })
            .eq('tournament_id', match.tournament_id)
            .eq('player_id', loserId)
        }
      })

    // Advance winner in bracket
    await advanceWinner(match.tournament_id, {
      round: match.round,
      matchIndex: match.match_index,
      bracketType: match.bracket_type,
      winnerId,
      loserId,
    })

    // Check if tournament is now complete
    const { data: updatedTournament } = await supabase
      .from('tournaments')
      .select('status, winner_id, winner_name')
      .eq('id', match.tournament_id)
      .single()

    // Broadcast
    const { data: allMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', match.tournament_id)
      .order('round')

    await supabase.channel(`tournament:${match.tournament_id}`).send({
      type: 'broadcast',
      event: 'match_completed',
      payload: { matchId, winnerId, bracket: allMatches },
    })

    if (updatedTournament?.status === 'completed') {
      await supabase.channel(`tournament:${match.tournament_id}`).send({
        type: 'broadcast',
        event: 'tournament_completed',
        payload: { winnerId: updatedTournament.winner_id, winnerName: updatedTournament.winner_name },
      })
    }

    // For single elimination, mark loser as eliminated
    const { data: tourney } = await supabase
      .from('tournaments')
      .select('format')
      .eq('id', match.tournament_id)
      .single()

    if (tourney?.format === 'single_elimination' && match.bracket_type === 'winners') {
      await supabase.from('tournament_players')
        .update({ is_eliminated: true })
        .eq('tournament_id', match.tournament_id)
        .eq('player_id', loserId)

      await supabase.channel(`tournament:${match.tournament_id}`).send({
        type: 'broadcast',
        event: 'player_eliminated',
        payload: { playerId: loserId },
      })
    }

    return {
      ok: true,
      data: {
        tournamentComplete: updatedTournament?.status === 'completed',
        tournamentWinner: updatedTournament?.winner_id,
      },
    }
  })

  // ─── Get my current match in a tournament ────────────────────────────
  app.get('/tournaments/:id/my-match', async (request) => {
    const { id } = request.params as { id: string }
    const query = request.query as { playerId?: string }

    if (!query.playerId) throw new AppError(400, 'MISSING', 'playerId required')

    const { data: matches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', id)
      .in('status', ['ready', 'active'])
      .or(`player1_id.eq.${query.playerId},player2_id.eq.${query.playerId}`)
      .order('round')
      .limit(1)

    if (!matches?.length) {
      return { ok: true, data: null }
    }

    return { ok: true, data: matches[0] }
  })
}
