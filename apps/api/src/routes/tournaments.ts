import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { validate } from '../lib/validate.js'
import { supabase } from '../lib/supabase.js'
import { AppError } from '../lib/errors.js'
import {
  generateSingleBracket,
  generateDoubleBracket,
  advanceWinner,
  generateJoinCode,
} from '../lib/tournament.js'

const createSchema = z.object({
  hostId: z.string().min(1),
  hostName: z.string().min(1).max(30).default('Host'),
  name: z.string().min(1).max(50).default('RPS Tournament'),
  format: z.enum(['single_elimination', 'double_elimination']).default('single_elimination'),
  maxPlayers: z.number().int().min(2).max(64).default(16),
})

const joinSchema = z.object({
  playerId: z.string().min(1),
  playerName: z.string().min(1).max(30).default('Player'),
})

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
    const { hostId, hostName, name, format, maxPlayers } = request.body as z.infer<typeof createSchema>

    const joinCode = await generateJoinCode()

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        host_id: hostId,
        host_name: hostName,
        name,
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
    const { playerId, playerName } = request.body as z.infer<typeof joinSchema>

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('status, max_players')
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

    return { ok: true, data: player }
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

    const { data: players } = await supabase
      .from('tournament_players')
      .select('player_id, player_name, seed')
      .eq('tournament_id', id)
      .order('seed')

    if (!players || players.length < 2) {
      throw new AppError(400, 'NOT_ENOUGH', 'Need at least 2 players')
    }

    // Shuffle seeds for fairness
    const shuffled = players.map((p, i) => ({
      playerId: p.player_id,
      playerName: p.player_name,
      seed: i + 1,
    }))

    // Randomize seed order
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tempSeed = shuffled[i].seed
      shuffled[i].seed = shuffled[j].seed
      shuffled[j].seed = tempSeed
    }

    // Update seeds
    for (const p of shuffled) {
      await supabase.from('tournament_players')
        .update({ seed: p.seed })
        .eq('tournament_id', id)
        .eq('player_id', p.playerId)
    }

    // Generate bracket
    const bracket = tournament.format === 'double_elimination'
      ? generateDoubleBracket(shuffled)
      : generateSingleBracket(shuffled)

    // Insert matches
    for (const match of bracket) {
      await supabase.from('tournament_matches').insert({
        tournament_id: id,
        round: match.round,
        match_index: match.matchIndex,
        bracket_type: match.bracketType,
        player1_id: match.player1Id,
        player1_name: match.player1Name,
        player2_id: match.player2Id,
        player2_name: match.player2Name,
        winner_id: match.winnerId,
        status: match.status,
      })
    }

    // Process byes — advance winners from bye matches
    const byeMatches = bracket.filter(m => m.status === 'bye' && m.winnerId)
    for (const bye of byeMatches) {
      await advanceWinner(id, {
        round: bye.round,
        matchIndex: bye.matchIndex,
        bracketType: bye.bracketType,
        winnerId: bye.winnerId!,
        loserId: '',
      })
    }

    // Update tournament status
    await supabase.from('tournaments').update({
      status: 'active',
      current_round: 1,
      started_at: new Date().toISOString(),
    }).eq('id', id)

    // Fetch final state
    const { data: matches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', id)
      .order('round')
      .order('match_index')

    // Broadcast tournament started
    await supabase.channel(`tournament:${id}`).send({
      type: 'broadcast',
      event: 'tournament_started',
      payload: { bracket: matches },
    })

    return { ok: true, data: { matches: matches ?? [] } }
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
