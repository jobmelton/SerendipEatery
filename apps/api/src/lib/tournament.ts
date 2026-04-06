import { supabase } from './supabase.js'

// ─── Bracket Generation ──────────────────────────────────────────────────

interface BracketMatch {
  round: number
  matchIndex: number
  bracketType: 'winners' | 'losers' | 'grand_final'
  player1Id: string | null
  player1Name: string | null
  player2Id: string | null
  player2Name: string | null
  winnerId: string | null
  status: 'pending' | 'ready' | 'active' | 'completed' | 'bye'
}

interface PlayerSeed {
  playerId: string
  playerName: string
  seed: number
}

/**
 * Generate a single-elimination bracket.
 * Supports non-power-of-2 player counts via byes.
 */
export function generateSingleBracket(players: PlayerSeed[]): BracketMatch[] {
  const n = players.length
  if (n < 2) return []

  // Next power of 2
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)))
  const totalRounds = Math.log2(bracketSize)
  const byes = bracketSize - n

  // Seed players into bracket positions
  const seeded = seedPlayers(players, bracketSize)
  const matches: BracketMatch[] = []

  // Round 1
  for (let i = 0; i < bracketSize / 2; i++) {
    const p1 = seeded[i * 2]
    const p2 = seeded[i * 2 + 1]
    const isBye = !p1 || !p2

    matches.push({
      round: 1,
      matchIndex: i,
      bracketType: 'winners',
      player1Id: p1?.playerId ?? null,
      player1Name: p1?.playerName ?? null,
      player2Id: p2?.playerId ?? null,
      player2Name: p2?.playerName ?? null,
      winnerId: isBye ? (p1?.playerId ?? p2?.playerId ?? null) : null,
      status: isBye ? 'bye' : 'ready',
    })
  }

  // Later rounds (empty slots)
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round)
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        round,
        matchIndex: i,
        bracketType: 'winners',
        player1Id: null,
        player1Name: null,
        player2Id: null,
        player2Name: null,
        winnerId: null,
        status: 'pending',
      })
    }
  }

  return matches
}

/**
 * Generate a double-elimination bracket.
 * Winners bracket + losers bracket + grand final.
 */
export function generateDoubleBracket(players: PlayerSeed[]): BracketMatch[] {
  const n = players.length
  if (n < 2) return []

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)))
  const winnersRounds = Math.log2(bracketSize)
  const losersRounds = (winnersRounds - 1) * 2

  // Generate winners bracket (same as single elimination)
  const matches = generateSingleBracket(players)

  // Generate losers bracket rounds (empty — filled as players drop)
  for (let round = 1; round <= losersRounds; round++) {
    // Losers bracket has varying match counts per round
    const isDropRound = round % 2 === 1 // odd rounds receive drops from winners
    const matchCount = Math.max(1, Math.floor(bracketSize / Math.pow(2, Math.ceil(round / 2) + 1)))

    for (let i = 0; i < matchCount; i++) {
      matches.push({
        round,
        matchIndex: i,
        bracketType: 'losers',
        player1Id: null,
        player1Name: null,
        player2Id: null,
        player2Name: null,
        winnerId: null,
        status: 'pending',
      })
    }
  }

  // Grand final
  matches.push({
    round: 1,
    matchIndex: 0,
    bracketType: 'grand_final',
    player1Id: null,
    player1Name: null,
    player2Id: null,
    player2Name: null,
    winnerId: null,
    status: 'pending',
  })

  return matches
}

/**
 * Seed players using standard tournament seeding.
 * Top seeds are placed far apart in the bracket.
 */
function seedPlayers(players: PlayerSeed[], bracketSize: number): (PlayerSeed | null)[] {
  const sorted = [...players].sort((a, b) => a.seed - b.seed)
  const positions: (PlayerSeed | null)[] = new Array(bracketSize).fill(null)

  // Standard seeding: 1v(n), 2v(n-1), etc. with proper bracket placement
  const order = getSeedOrder(bracketSize)
  for (let i = 0; i < sorted.length; i++) {
    positions[order[i]] = sorted[i]
  }

  return positions
}

function getSeedOrder(size: number): number[] {
  if (size === 2) return [0, 1]
  const half = getSeedOrder(size / 2)
  return half.flatMap((pos) => [pos * 2, size - 1 - pos * 2])
}

/**
 * Advance a winner to the next round in the bracket.
 * Returns the updated match if one was created/modified.
 */
export async function advanceWinner(
  tournamentId: string,
  completedMatch: { round: number; matchIndex: number; bracketType: string; winnerId: string; loserId: string }
): Promise<void> {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('format, bracket, losers_bracket')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return

  const { round, matchIndex, bracketType, winnerId, loserId } = completedMatch

  // Get winner/loser names
  const { data: winnerPlayer } = await supabase
    .from('tournament_players')
    .select('player_name')
    .eq('tournament_id', tournamentId)
    .eq('player_id', winnerId)
    .single()

  const winnerName = winnerPlayer?.player_name ?? 'Unknown'

  if (bracketType === 'winners' || bracketType === 'grand_final') {
    // Advance winner in winners bracket
    const nextRound = round + 1
    const nextMatchIndex = Math.floor(matchIndex / 2)
    const isPlayer1 = matchIndex % 2 === 0

    // Check if there's a next round match
    const { data: nextMatch } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', nextRound)
      .eq('match_index', nextMatchIndex)
      .eq('bracket_type', 'winners')
      .single()

    if (nextMatch) {
      const update: any = isPlayer1
        ? { player1_id: winnerId, player1_name: winnerName }
        : { player2_id: winnerId, player2_name: winnerName }

      // If both players now filled, mark as ready
      const otherFilled = isPlayer1 ? nextMatch.player2_id : nextMatch.player1_id
      if (otherFilled) update.status = 'ready'

      await supabase.from('tournament_matches')
        .update(update)
        .eq('id', nextMatch.id)
    } else {
      // No next round — this was the final. Tournament complete!
      await supabase.from('tournaments').update({
        status: 'completed',
        winner_id: winnerId,
        winner_name: winnerName,
        completed_at: new Date().toISOString(),
      }).eq('id', tournamentId)
      return
    }

    // Double elimination: drop loser to losers bracket
    if (tournament.format === 'double_elimination' && loserId) {
      await dropToLosersBracket(tournamentId, loserId, round, matchIndex)
    }
  }

  if (bracketType === 'losers') {
    // Advance in losers bracket
    const nextRound = round + 1
    const nextMatchIndex = Math.floor(matchIndex / 2)

    const { data: nextMatch } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', nextRound)
      .eq('bracket_type', 'losers')
      .single()

    if (nextMatch) {
      const isPlayer1 = matchIndex % 2 === 0
      const update: any = isPlayer1
        ? { player1_id: winnerId, player1_name: winnerName }
        : { player2_id: winnerId, player2_name: winnerName }

      const otherFilled = isPlayer1 ? nextMatch.player2_id : nextMatch.player1_id
      if (otherFilled) update.status = 'ready'

      await supabase.from('tournament_matches')
        .update(update)
        .eq('id', nextMatch.id)
    } else {
      // Losers bracket champion — advance to grand final
      const { data: grandFinal } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('bracket_type', 'grand_final')
        .single()

      if (grandFinal) {
        await supabase.from('tournament_matches')
          .update({ player2_id: winnerId, player2_name: winnerName, status: grandFinal.player1_id ? 'ready' : 'pending' })
          .eq('id', grandFinal.id)
      }
    }

    // Mark loser as eliminated in double elim losers bracket
    if (loserId) {
      await supabase.from('tournament_players')
        .update({ is_eliminated: true })
        .eq('tournament_id', tournamentId)
        .eq('player_id', loserId)
    }
  }
}

async function dropToLosersBracket(tournamentId: string, loserId: string, fromRound: number, fromMatchIndex: number): Promise<void> {
  // Mark player as in losers bracket
  await supabase.from('tournament_players')
    .update({ is_in_losers: true })
    .eq('tournament_id', tournamentId)
    .eq('player_id', loserId)

  const { data: loserPlayer } = await supabase
    .from('tournament_players')
    .select('player_name')
    .eq('tournament_id', tournamentId)
    .eq('player_id', loserId)
    .single()

  const loserName = loserPlayer?.player_name ?? 'Unknown'

  // Find the first available losers bracket match
  const losersRound = fromRound * 2 - 1 // winners round 1 → losers round 1, winners round 2 → losers round 3
  const losersMatchIndex = Math.floor(fromMatchIndex / 2)

  const { data: losersMatch } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('round', losersRound)
    .eq('bracket_type', 'losers')
    .limit(1)

  if (losersMatch && losersMatch[0]) {
    const match = losersMatch[0]
    const update: any = !match.player1_id
      ? { player1_id: loserId, player1_name: loserName }
      : { player2_id: loserId, player2_name: loserName }

    const otherFilled = !match.player1_id ? match.player2_id : match.player1_id
    if (otherFilled) update.status = 'ready'

    await supabase.from('tournament_matches')
      .update(update)
      .eq('id', match.id)
  }
}

/**
 * Generate a unique 6-char join code.
 */
export async function generateJoinCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = 'FATE'
    for (let i = 0; i < 2; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }

    const { data: existing } = await supabase
      .from('tournaments')
      .select('id')
      .eq('join_code', code)
      .single()

    if (!existing) return code
  }

  // Fallback: longer code
  let code = 'FATE'
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
