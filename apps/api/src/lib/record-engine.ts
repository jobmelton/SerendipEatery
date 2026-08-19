import { createHash, randomBytes, randomInt } from 'node:crypto'
import { supabase } from './supabase.js'
import { generateSingleBracket } from './tournament.js'
import { sendSms, toE164 } from './sms.js'
import { AppError } from './errors.js'

const BATCH = 200
const RULES_VERSION = 'rps-async-v1'

export type AttemptRow = {
  id: string
  status: string
  match_deadline_hours: number
  min_age: number
  target_participants: number
  freeze_seed: string | null
  current_round: number
  rules_version: string
  registration_opens_at: string | null
  registration_closes_at: string | null
  auto_start_enabled?: boolean
  auto_start_threshold?: number
  auto_started_at?: string | null
}

export type ParticipantRow = {
  id: string
  attempt_id: string
  user_id: string | null
  participant_name: string
  legal_name: string | null
  email: string | null
  phone: string | null
  phone_e164: string | null
  phone_verified_at: string | null
  status: string
  seed: number | null
  current_match_id: string | null
  app_unlocked: boolean
  unlocked_at: string | null
  unlock_cta_seen_at: string | null
  official_participant: boolean
  sms_consent: boolean
}

export type MatchRow = {
  id: string
  attempt_id: string
  round: number
  match_index: number
  player1_id: string | null
  player2_id: string | null
  player1_name: string | null
  player2_name: string | null
  battle_id: string | null
  status: string
  winner_id: string | null
  loser_id: string | null
  deadline_at: string | null
  player1_notified_at: string | null
  player2_notified_at: string | null
  reminder_24h_sent_at: string | null
  reminder_1h_sent_at: string | null
  player1_locked_at: string | null
  player2_locked_at: string | null
}

/**
 * Open registration if still upcoming, then freeze + generate the official
 * bracket once verified signups reach the threshold (default 50,000).
 */
export async function maybeAutoStartOfficial(): Promise<{ started: boolean; reason: string; count?: number; threshold?: number }> {
  const attempt = await getCurrentAttempt()
  if (!attempt) return { started: false, reason: 'no_attempt' }
  if (attempt.auto_start_enabled === false) return { started: false, reason: 'disabled' }

  if (attempt.status === 'upcoming') {
    await supabase.from('record_attempts').update({
      status: 'registration',
      registration_opens_at: new Date().toISOString(),
    }).eq('id', attempt.id)
    await appendEvent(attempt.id, 'registration_opened', { source: 'auto' })
  }

  const live = await getCurrentAttempt()
  if (!live || !['upcoming', 'registration'].includes(live.status)) {
    return { started: false, reason: live?.status ?? 'moved' }
  }

  const { count } = await supabase
    .from('record_participants')
    .select('id', { count: 'exact', head: true })
    .eq('attempt_id', live.id)
    .not('phone_verified_at', 'is', null)

  const threshold = live.auto_start_threshold ?? live.target_participants ?? 50000
  const n = count ?? 0
  if (n < threshold) return { started: false, reason: 'waiting', count: n, threshold }

  const { data: locked } = await supabase
    .from('record_attempts')
    .update({
      status: 'frozen',
      registration_closes_at: new Date().toISOString(),
      auto_started_at: new Date().toISOString(),
    })
    .eq('id', live.id)
    .in('status', ['upcoming', 'registration'])
    .select('id')
    .maybeSingle()

  if (!locked) return { started: false, reason: 'already_starting', count: n, threshold }

  await appendEvent(live.id, 'auto_start_threshold_hit', { count: n, threshold })
  const result = await generateRecordBracket(live.id)
  return { started: true, reason: 'threshold_met', count: n, threshold, ...result } as any
}

export async function getCurrentAttempt(): Promise<AttemptRow | null> {
  const { data } = await supabase
    .from('record_attempts')
    .select('*')
    .in('status', ['upcoming', 'registration', 'frozen', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as AttemptRow | null) ?? null
}

export async function appendEvent(
  attemptId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { data: last } = await supabase
    .from('record_event_log')
    .select('seq, hash')
    .eq('attempt_id', attemptId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle()

  const seq = (last?.seq ?? 0) + 1
  const prevHash = last?.hash ?? 'GENESIS'
  const createdAt = new Date().toISOString()
  const material = `${seq}|${prevHash}|${eventType}|${JSON.stringify(payload)}|${createdAt}`
  const hash = createHash('sha256').update(material).digest('hex')

  const { error } = await supabase.from('record_event_log').insert({
    attempt_id: attemptId,
    seq,
    event_type: eventType,
    payload,
    prev_hash: prevHash,
    hash,
    created_at: createdAt,
  })
  if (error) console.error('[record] appendEvent failed', error.message)
}

export function hashRows(label: string, rows: unknown[]): string {
  return createHash('sha256')
    .update(label + JSON.stringify(rows))
    .digest('hex')
}

async function snapshot(attemptId: string, evidenceType: string, data: unknown) {
  await supabase.from('record_evidence').insert({
    attempt_id: attemptId,
    evidence_type: evidenceType,
    data,
  })
}

function displayName(p: ParticipantRow): string {
  return p.legal_name || p.participant_name || 'Player'
}

export async function generateRecordBracket(attemptId: string): Promise<{
  players: number
  matches: number
  byes: number
  freezeSeed: string
}> {
  const { data: attempt, error: attemptErr } = await supabase
    .from('record_attempts')
    .select('*')
    .eq('id', attemptId)
    .single()
  if (attemptErr || !attempt) throw new AppError(404, 'NO_ATTEMPT', 'Record attempt not found')
  if (!['upcoming', 'registration', 'frozen'].includes(attempt.status)) {
    throw new AppError(400, 'BAD_STATUS', 'Bracket can only be generated before play starts')
  }

  const { data: existing } = await supabase
    .from('record_matches')
    .select('id')
    .eq('attempt_id', attemptId)
    .limit(1)
    .maybeSingle()
  if (existing) throw new AppError(400, 'BRACKET_EXISTS', 'Bracket already generated')

  const { data: verified } = await supabase
    .from('record_participants')
    .select('*')
    .eq('attempt_id', attemptId)
    .not('phone_verified_at', 'is', null)
    .in('status', ['registered', 'verified'])

  const players = (verified ?? []) as ParticipantRow[]
  if (players.length < 2) {
    throw new AppError(400, 'NOT_ENOUGH', 'Need at least 2 phone-verified players')
  }

  const freezeSeed = attempt.freeze_seed || randomBytes(16).toString('hex')
  const shuffled = [...players]
  // Deterministic shuffle from freeze seed
  let n = parseInt(createHash('sha256').update(freezeSeed).digest('hex').slice(0, 8), 16)
  for (let i = shuffled.length - 1; i > 0; i--) {
    n = (n * 1664525 + 1013904223) >>> 0
    const j = n % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const seeded = shuffled.map((p, i) => ({
    playerId: p.id,
    playerName: displayName(p),
    seed: i + 1,
    row: p,
  }))

  for (let i = 0; i < seeded.length; i += BATCH) {
    const chunk = seeded.slice(i, i + BATCH)
    await Promise.all(chunk.map((p) =>
      supabase.from('record_participants').update({
        seed: p.seed,
        status: 'active',
        official_participant: false,
      }).eq('id', p.playerId),
    ))
  }

  const bracket = generateSingleBracket(seeded)
  const deadlineHours: number = attempt.match_deadline_hours ?? 48
  const deadline = new Date(Date.now() + deadlineHours * 3600 * 1000).toISOString()

  const rows = bracket.map((m) => ({
    attempt_id: attemptId,
    round: m.round,
    match_index: m.matchIndex,
    player1_id: m.player1Id,
    player2_id: m.player2Id,
    player1_name: m.player1Name,
    player2_name: m.player2Name,
    winner_id: m.status === 'bye' ? m.winnerId : null,
    status: m.status,
    deadline_at: m.status === 'ready' || m.status === 'bye' ? deadline : null,
    completed_at: m.status === 'bye' ? new Date().toISOString() : null,
  }))

  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from('record_matches').insert(rows.slice(i, i + BATCH))
    if (error) throw new AppError(500, 'BRACKET_INSERT', error.message)
  }

  const rosterHash = hashRows('roster', seeded.map((p) => ({ id: p.playerId, seed: p.seed, name: p.playerName })))
  const bracketHash = hashRows('bracket', rows.map((r) => ({
    r: r.round, i: r.match_index, p1: r.player1_id, p2: r.player2_id, s: r.status,
  })))

  await supabase.from('record_attempts').update({
    status: 'active',
    freeze_seed: freezeSeed,
    roster_hash: rosterHash,
    bracket_hash: bracketHash,
    bracket_generated_at: new Date().toISOString(),
    current_round: 1,
    verified_count: players.length,
  }).eq('id', attemptId)

  // Byes count as official participation and advance immediately
  const byeMatches = bracket.filter((m) => m.status === 'bye' && m.winnerId)
  for (const bye of byeMatches) {
    await supabase.from('record_participants').update({
      official_participant: true,
    }).eq('id', bye.winnerId)
    await advanceRecordWinner(attemptId, {
      round: bye.round,
      matchIndex: bye.matchIndex,
      winnerId: bye.winnerId!,
      loserId: null,
    })
  }

  await appendEvent(attemptId, 'roster_frozen', {
    freezeSeed, count: players.length, rosterHash, rules: RULES_VERSION,
  })
  await appendEvent(attemptId, 'bracket_generated', {
    matches: rows.length, byes: byeMatches.length, bracketHash,
  })
  await snapshot(attemptId, 'roster_freeze', {
    freezeSeed, rosterHash, bracketHash, count: players.length,
  })

  // Point each live player at their round-1 match
  const { data: round1 } = await supabase
    .from('record_matches')
    .select('id, player1_id, player2_id, status')
    .eq('attempt_id', attemptId)
    .eq('round', 1)

  for (const m of round1 ?? []) {
    if (m.status !== 'ready') continue
    if (m.player1_id) {
      await supabase.from('record_participants').update({ current_match_id: m.id }).eq('id', m.player1_id)
    }
    if (m.player2_id) {
      await supabase.from('record_participants').update({ current_match_id: m.id }).eq('id', m.player2_id)
    }
  }

  return {
    players: players.length,
    matches: rows.length,
    byes: byeMatches.length,
    freezeSeed,
  }
}

export async function advanceRecordWinner(
  attemptId: string,
  completed: { round: number; matchIndex: number; winnerId: string; loserId: string | null },
): Promise<void> {
  const { data: winner } = await supabase
    .from('record_participants')
    .select('id, legal_name, participant_name')
    .eq('id', completed.winnerId)
    .single()
  const winnerName = winner?.legal_name || winner?.participant_name || 'Player'

  const nextRound = completed.round + 1
  const nextMatchIndex = Math.floor(completed.matchIndex / 2)
  const isPlayer1 = completed.matchIndex % 2 === 0

  const { data: nextMatch } = await supabase
    .from('record_matches')
    .select('*')
    .eq('attempt_id', attemptId)
    .eq('round', nextRound)
    .eq('match_index', nextMatchIndex)
    .maybeSingle()

  if (!nextMatch) {
    await supabase.from('record_participants').update({
      status: 'champion',
      app_unlocked: true,
      unlocked_at: new Date().toISOString(),
      current_match_id: null,
      official_participant: true,
    }).eq('id', completed.winnerId)

    const { count } = await supabase
      .from('record_participants')
      .select('id', { count: 'exact', head: true })
      .eq('attempt_id', attemptId)
      .eq('official_participant', true)

    await supabase.from('record_attempts').update({
      status: 'pending_verification',
      winner_participant_id: completed.winnerId,
      official_count: count ?? 0,
    }).eq('id', attemptId)

    await appendEvent(attemptId, 'champion_crowned', {
      winnerId: completed.winnerId, winnerName, officialCount: count ?? 0,
    })
    return
  }

  const { data: attempt } = await supabase
    .from('record_attempts')
    .select('match_deadline_hours')
    .eq('id', attemptId)
    .single()

  const update: Record<string, unknown> = isPlayer1
    ? { player1_id: completed.winnerId, player1_name: winnerName }
    : { player2_id: completed.winnerId, player2_name: winnerName }

  const otherFilled = isPlayer1 ? nextMatch.player2_id : nextMatch.player1_id
  if (otherFilled) {
    const hours = attempt?.match_deadline_hours ?? 48
    update.status = 'ready'
    update.deadline_at = new Date(Date.now() + hours * 3600 * 1000).toISOString()
  }

  await supabase.from('record_matches').update(update).eq('id', nextMatch.id)

  await supabase.from('record_participants').update({
    current_match_id: nextMatch.id,
    status: 'active',
  }).eq('id', completed.winnerId)

  if (otherFilled && update.status === 'ready') {
    await appendEvent(attemptId, 'match_ready', {
      matchId: nextMatch.id, round: nextRound, matchIndex: nextMatchIndex,
    })
  }
}

export async function eliminatePlayer(
  participantId: string,
  round: number,
  reason: 'eliminated' | 'forfeited' | 'no_show',
): Promise<void> {
  await supabase.from('record_participants').update({
    status: reason === 'eliminated' ? 'eliminated' : reason,
    eliminated_at: new Date().toISOString(),
    eliminated_round: round,
    current_match_id: null,
    app_unlocked: true,
    unlocked_at: new Date().toISOString(),
  }).eq('id', participantId)
}

export async function completeRecordMatch(
  match: MatchRow,
  winnerId: string,
  loserId: string | null,
  reason: 'played' | 'forfeit' | 'no_show_flip' = 'played',
): Promise<void> {
  if (match.status === 'completed' || match.status === 'bye') return

  await supabase.from('record_matches').update({
    status: reason === 'played' ? 'completed' : 'forfeit',
    winner_id: winnerId,
    loser_id: loserId,
    forfeit_reason: reason === 'played' ? null : reason,
    completed_at: new Date().toISOString(),
  }).eq('id', match.id)

  await supabase.from('record_participants').update({
    official_participant: true,
  }).eq('id', winnerId)

  if (reason === 'played' && loserId) {
    await supabase.from('record_participants').update({
      official_participant: true,
    }).eq('id', loserId)
  }

  if (loserId && reason !== 'no_show_flip') {
    await eliminatePlayer(loserId, match.round, reason === 'played' ? 'eliminated' : 'forfeited')
    await appendEvent(match.attempt_id, 'player_eliminated', {
      participantId: loserId, round: match.round, matchId: match.id, reason,
    })
  } else if (loserId && reason === 'no_show_flip') {
    await eliminatePlayer(loserId, match.round, 'no_show')
  }

  await appendEvent(match.attempt_id, reason === 'played' ? 'match_completed' : 'match_forfeit', {
    matchId: match.id, winnerId, loserId, reason, round: match.round,
  })

  await advanceRecordWinner(match.attempt_id, {
    round: match.round,
    matchIndex: match.match_index,
    winnerId,
    loserId,
  })
}

export async function syncRecordMatch(matchId: string): Promise<{ completed: boolean }> {
  const { data: match } = await supabase
    .from('record_matches')
    .select('*')
    .eq('id', matchId)
    .single()
  if (!match || !match.battle_id) return { completed: false }
  if (match.status === 'completed' || match.status === 'forfeit' || match.status === 'bye') {
    return { completed: true }
  }

  const { data: battle } = await supabase
    .from('battles')
    .select('status, winner_id, challenger_id')
    .eq('id', match.battle_id)
    .maybeSingle()

  if (battle?.status === 'completed' && battle.winner_id) {
    const winnerIsP1 = battle.winner_id === battle.challenger_id
    const winnerId = winnerIsP1 ? match.player1_id : match.player2_id
    const loserId = winnerIsP1 ? match.player2_id : match.player1_id
    if (winnerId) {
      await completeRecordMatch(match as MatchRow, winnerId, loserId, 'played')
      return { completed: true }
    }
  }
  return { completed: false }
}

export async function startRecordMatch(matchId: string, participantId: string): Promise<{ battleId: string }> {
  const { data: match } = await supabase
    .from('record_matches')
    .select('*')
    .eq('id', matchId)
    .single()
  if (!match) throw new AppError(404, 'NOT_FOUND', 'Match not found')
  if (match.status !== 'ready' && match.status !== 'active') {
    throw new AppError(400, 'NOT_READY', 'Match is not live')
  }
  if (participantId !== match.player1_id && participantId !== match.player2_id) {
    throw new AppError(403, 'NOT_PARTICIPANT', 'Not in this match')
  }
  if (match.deadline_at && new Date(match.deadline_at).getTime() < Date.now()) {
    throw new AppError(400, 'EXPIRED', 'Deadline has passed')
  }

  if (match.battle_id) return { battleId: match.battle_id }

  const { data: p1 } = await supabase
    .from('record_participants')
    .select('user_id, legal_name, participant_name')
    .eq('id', match.player1_id)
    .maybeSingle()
  const { data: p2 } = await supabase
    .from('record_participants')
    .select('user_id, legal_name, participant_name')
    .eq('id', match.player2_id)
    .maybeSingle()

  if (!p1?.user_id || !p2?.user_id) {
    throw new AppError(400, 'NO_ACCOUNT', 'Both players must be signed in to the app')
  }

  const { data: battle, error } = await supabase
    .from('battles')
    .insert({
      challenger_id: p1.user_id,
      challenger_name: p1.legal_name || p1.participant_name || match.player1_name || 'Player 1',
      defender_id: p2.user_id,
      defender_name: p2.legal_name || p2.participant_name || match.player2_name || 'Player 2',
      status: 'active',
      current_round: 1,
      round_results: [],
      challenger_message: `World Record — Round ${match.round}`,
    })
    .select()
    .single()
  if (error || !battle) throw new AppError(500, 'BATTLE', error?.message ?? 'Could not start match')

  await supabase.from('record_matches').update({
    battle_id: battle.id,
    status: 'active',
    started_at: new Date().toISOString(),
  }).eq('id', matchId)

  await appendEvent(match.attempt_id, 'match_started', { matchId, battleId: battle.id })
  return { battleId: battle.id }
}

function coinFlipAdvance(match: MatchRow): string {
  const material = `${match.id}|${match.attempt_id}|${match.round}|${match.match_index}`
  const n = parseInt(createHash('sha256').update(material).digest('hex').slice(0, 8), 16)
  return n % 2 === 0 ? match.player1_id! : match.player2_id!
}

async function playerLocked(match: MatchRow, role: 'player1' | 'player2'): Promise<boolean> {
  if (role === 'player1' && match.player1_locked_at) return true
  if (role === 'player2' && match.player2_locked_at) return true
  if (!match.battle_id) return false

  const { data: battle } = await supabase
    .from('battles')
    .select('challenger_moves, defender_moves, status, winner_id')
    .eq('id', match.battle_id)
    .maybeSingle()

  if (!battle) return false
  if (role === 'player1') return Array.isArray(battle.challenger_moves) && battle.challenger_moves.length > 0
  return Array.isArray(battle.defender_moves) && battle.defender_moves.length > 0
}

async function notifyPlayer(match: MatchRow, participantId: string | null, template: string, body: string) {
  if (!participantId) return
  const { data: p } = await supabase
    .from('record_participants')
    .select('id, phone_e164, sms_consent, phone_verified_at')
    .eq('id', participantId)
    .maybeSingle()
  if (!p?.phone_e164 || !p.sms_consent || !p.phone_verified_at) return
  await sendSms({
    to: p.phone_e164,
    body,
    template,
    attemptId: match.attempt_id,
    participantId: p.id,
  })
}

function fmtDeadline(iso: string | null): string {
  if (!iso) return 'the deadline'
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

export async function tickRecordMatches(): Promise<{ notified: number; reminders: number; forfeits: number; completed: number }> {
  const attempt = await getCurrentAttempt()
  if (!attempt || attempt.status !== 'active') {
    return { notified: 0, reminders: 0, forfeits: 0, completed: 0 }
  }

  const now = Date.now()
  let notified = 0
  let reminders = 0
  let forfeits = 0
  let completed = 0

  const { data: live } = await supabase
    .from('record_matches')
    .select('*')
    .eq('attempt_id', attempt.id)
    .in('status', ['ready', 'active'])
    .limit(500)

  for (const raw of live ?? []) {
    const match = raw as MatchRow

    // Promote finished battles
    if (match.battle_id) {
      const { data: battle } = await supabase
        .from('battles')
        .select('status, winner_id, challenger_id, defender_id, challenger_moves, defender_moves')
        .eq('id', match.battle_id)
        .maybeSingle()

      if (battle?.status === 'completed' && battle.winner_id) {
        const winnerIsP1 = battle.winner_id === battle.challenger_id
        const winnerId = winnerIsP1 ? match.player1_id : match.player2_id
        const loserId = winnerIsP1 ? match.player2_id : match.player1_id
        if (winnerId) {
          await completeRecordMatch(match, winnerId, loserId, 'played')
          completed++
          continue
        }
      }
    }

    const p1Locked = await playerLocked(match, 'player1')
    const p2Locked = await playerLocked(match, 'player2')
    if (p1Locked && !match.player1_locked_at && match.player1_id) {
      await supabase.from('record_matches').update({ player1_locked_at: new Date().toISOString() }).eq('id', match.id)
      await supabase.from('record_participants').update({
        first_throw_at: new Date().toISOString(),
        official_participant: true,
      }).eq('id', match.player1_id).is('first_throw_at', null)
      await appendEvent(match.attempt_id, 'throws_locked', { matchId: match.id, participantId: match.player1_id })
    }
    if (p2Locked && !match.player2_locked_at && match.player2_id) {
      await supabase.from('record_matches').update({ player2_locked_at: new Date().toISOString() }).eq('id', match.id)
      await supabase.from('record_participants').update({
        first_throw_at: new Date().toISOString(),
        official_participant: true,
      }).eq('id', match.player2_id).is('first_throw_at', null)
      await appendEvent(match.attempt_id, 'throws_locked', { matchId: match.id, participantId: match.player2_id })
    }

    // Initial SMS
    if (!match.player1_notified_at && match.player1_id) {
      await notifyPlayer(
        match,
        match.player1_id,
        'youre_up',
        `SerendipEatery: You're up vs ${match.player2_name ?? 'your opponent'} in the world-record RPS tournament. First to 2. Lock your throws before ${fmtDeadline(match.deadline_at)}.`,
      )
      await supabase.from('record_matches').update({ player1_notified_at: new Date().toISOString() }).eq('id', match.id)
      notified++
    }
    if (!match.player2_notified_at && match.player2_id) {
      await notifyPlayer(
        match,
        match.player2_id,
        'youre_up',
        `SerendipEatery: You're up vs ${match.player1_name ?? 'your opponent'} in the world-record RPS tournament. First to 2. Lock your throws before ${fmtDeadline(match.deadline_at)}.`,
      )
      await supabase.from('record_matches').update({ player2_notified_at: new Date().toISOString() }).eq('id', match.id)
      notified++
    }

    if (match.deadline_at) {
      const remaining = new Date(match.deadline_at).getTime() - now
      if (remaining <= 24 * 3600 * 1000 && remaining > 3600 * 1000 && !match.reminder_24h_sent_at) {
        await notifyPlayer(match, match.player1_id, 'reminder_24h', `24 hours left to throw vs ${match.player2_name ?? 'your opponent'}. Open SerendipEatery.`)
        await notifyPlayer(match, match.player2_id, 'reminder_24h', `24 hours left to throw vs ${match.player1_name ?? 'your opponent'}. Open SerendipEatery.`)
        await supabase.from('record_matches').update({ reminder_24h_sent_at: new Date().toISOString() }).eq('id', match.id)
        reminders++
      }
      if (remaining <= 3600 * 1000 && remaining > 0 && !match.reminder_1h_sent_at) {
        await notifyPlayer(match, match.player1_id, 'reminder_1h', `1 hour left vs ${match.player2_name ?? 'your opponent'}. Lock your throws now.`)
        await notifyPlayer(match, match.player2_id, 'reminder_1h', `1 hour left vs ${match.player1_name ?? 'your opponent'}. Lock your throws now.`)
        await supabase.from('record_matches').update({ reminder_1h_sent_at: new Date().toISOString() }).eq('id', match.id)
        reminders++
      }

      if (remaining <= 0) {
        const p1 = await playerLocked(match, 'player1')
        const p2 = await playerLocked(match, 'player2')
        if (p1 && !p2 && match.player1_id) {
          await completeRecordMatch(match, match.player1_id, match.player2_id, 'forfeit')
          if (match.player1_id) {
            await notifyPlayer(match, match.player1_id, 'forfeit_win', 'Your opponent did not throw. You advance.')
          }
          if (match.player2_id) {
            await notifyPlayer(match, match.player2_id, 'eliminated', `You're out — but you counted. Open SerendipEatery: you fought. Now eat.`)
          }
          forfeits++
        } else if (p2 && !p1 && match.player2_id) {
          await completeRecordMatch(match, match.player2_id, match.player1_id, 'forfeit')
          if (match.player2_id) {
            await notifyPlayer(match, match.player2_id, 'forfeit_win', 'Your opponent did not throw. You advance.')
          }
          if (match.player1_id) {
            await notifyPlayer(match, match.player1_id, 'eliminated', `You're out — but you counted. Open SerendipEatery: you fought. Now eat.`)
          }
          forfeits++
        } else if (!p1 && !p2 && match.player1_id && match.player2_id) {
          const winnerId = coinFlipAdvance(match)
          const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id
          await completeRecordMatch(match, winnerId, loserId, 'no_show_flip')
          forfeits++
        }
      }
    }
  }

  return { notified, reminders, forfeits, completed }
}

export async function sendOtp(attemptId: string, phone: string): Promise<{ expiresAt: string }> {
  const e164 = toE164(phone)
  if (!e164) throw new AppError(400, 'BAD_PHONE', 'Enter a valid mobile number')

  const { data: recent } = await supabase
    .from('record_otp_codes')
    .select('created_at')
    .eq('attempt_id', attemptId)
    .eq('phone_e164', e164)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recent && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
    throw new AppError(429, 'OTP_WAIT', 'Wait 60 seconds before requesting another code')
  }

  const code = String(randomInt(100000, 1000000))
  const codeHash = createHash('sha256').update(`${attemptId}:${e164}:${code}`).digest('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await supabase.from('record_otp_codes').insert({
    attempt_id: attemptId,
    phone_e164: e164,
    code_hash: codeHash,
    expires_at: expiresAt,
  })

  await sendSms({
    to: e164,
    body: `SerendipEatery code: ${code}. Expires in 10 minutes. If you didn't request this, ignore it.`,
    template: 'otp',
    attemptId,
  })

  return { expiresAt }
}

export async function verifyOtp(attemptId: string, phone: string, code: string, userId?: string): Promise<ParticipantRow> {
  const e164 = toE164(phone)
  if (!e164) throw new AppError(400, 'BAD_PHONE', 'Enter a valid mobile number')

  const { data: otp } = await supabase
    .from('record_otp_codes')
    .select('*')
    .eq('attempt_id', attemptId)
    .eq('phone_e164', e164)
    .is('verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!otp) throw new AppError(400, 'NO_OTP', 'Request a code first')
  if (new Date(otp.expires_at).getTime() < Date.now()) throw new AppError(400, 'OTP_EXPIRED', 'Code expired')
  if (otp.attempts >= 5) throw new AppError(400, 'OTP_LOCKED', 'Too many attempts. Request a new code.')

  const expected = createHash('sha256').update(`${attemptId}:${e164}:${code.trim()}`).digest('hex')
  if (expected !== otp.code_hash) {
    await supabase.from('record_otp_codes').update({ attempts: otp.attempts + 1 }).eq('id', otp.id)
    throw new AppError(400, 'OTP_BAD', 'That code is incorrect')
  }

  await supabase.from('record_otp_codes').update({
    verified_at: new Date().toISOString(),
  }).eq('id', otp.id)

  if (userId) {
    // prefer the signed-in row if present
    const { data: byUser } = await supabase
      .from('record_participants')
      .select('*')
      .eq('attempt_id', attemptId)
      .eq('user_id', userId)
      .maybeSingle()
    if (byUser) {
      await supabase.from('record_participants').update({
        phone_e164: e164,
        phone: e164,
        phone_verified_at: new Date().toISOString(),
        status: 'verified',
      }).eq('id', byUser.id)
      await appendEvent(attemptId, 'phone_verified', { participantId: byUser.id, phone: e164 })
      return { ...byUser, phone_e164: e164, phone_verified_at: new Date().toISOString(), status: 'verified' } as ParticipantRow
    }
  }

  const { data: participant } = await supabase
    .from('record_participants')
    .select('*')
    .eq('attempt_id', attemptId)
    .eq('phone_e164', e164)
    .maybeSingle()
  if (!participant) throw new AppError(404, 'NOT_REGISTERED', 'Register before verifying your phone')

  await supabase.from('record_participants').update({
    phone_verified_at: new Date().toISOString(),
    status: 'verified',
  }).eq('id', participant.id)

  await appendEvent(attemptId, 'phone_verified', { participantId: participant.id, phone: e164 })
  return { ...participant, phone_verified_at: new Date().toISOString(), status: 'verified' } as ParticipantRow
}

export async function verifyChain(attemptId: string): Promise<{ ok: boolean; rows: number; brokenAt: number | null }> {
  const { data: rows } = await supabase
    .from('record_event_log')
    .select('seq, event_type, payload, prev_hash, hash, created_at')
    .eq('attempt_id', attemptId)
    .order('seq')

  let prev = 'GENESIS'
  for (const row of rows ?? []) {
    const material = `${row.seq}|${row.prev_hash}|${row.event_type}|${JSON.stringify(row.payload)}|${row.created_at}`
    const hash = createHash('sha256').update(material).digest('hex')
    if (row.prev_hash !== prev || row.hash !== hash) {
      return { ok: false, rows: rows?.length ?? 0, brokenAt: row.seq }
    }
    prev = row.hash
  }
  return { ok: true, rows: rows?.length ?? 0, brokenAt: null }
}
