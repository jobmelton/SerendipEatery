import { supabase } from './supabase.js'

export const BOT_USER_ID = 'bot_house'
const BOT_NAME = 'The House'
const CHALLENGE_TIMEOUT_MS = 60000 // 60 seconds
const MOVES = ['rock', 'paper', 'scissors'] as const

// ─── Watch for unanswered challenges ─────────────────────────────────────

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function watchForUnansweredChallenges(): void {
  console.log('[bot] House Bot watcher started')

  // Poll every 10 seconds for waiting battles (more reliable than Realtime for a worker)
  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - CHALLENGE_TIMEOUT_MS).toISOString()

      const { data: stale } = await supabase
        .from('battles')
        .select('id, created_at')
        .eq('status', 'waiting')
        .lt('created_at', cutoff)

      for (const battle of stale ?? []) {
        if (!pendingTimers.has(battle.id)) {
          pendingTimers.set(battle.id, setTimeout(() => {}, 0)) // mark as handled
          await botAcceptChallenge(battle.id)
        }
      }
    } catch (err) {
      console.error('[bot] Poll error:', err)
    }
  }, 10000)

  // Also use Realtime for faster response
  supabase
    .channel('bot-watcher')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'battles',
      filter: 'status=eq.waiting',
    }, (payload: any) => {
      const battleId = payload.new?.id
      if (!battleId || pendingTimers.has(battleId)) return

      // Start countdown — if no human accepts in 60s, bot steps in
      const timer = setTimeout(async () => {
        const { data: battle } = await supabase
          .from('battles')
          .select('status')
          .eq('id', battleId)
          .single()

        if (battle?.status === 'waiting') {
          await botAcceptChallenge(battleId)
        }
        pendingTimers.delete(battleId)
      }, CHALLENGE_TIMEOUT_MS)

      pendingTimers.set(battleId, timer)
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'battles',
    }, (payload: any) => {
      // If battle moves out of waiting, cancel the timer
      const battleId = payload.new?.id
      if (battleId && payload.new?.status !== 'waiting' && pendingTimers.has(battleId)) {
        clearTimeout(pendingTimers.get(battleId)!)
        pendingTimers.delete(battleId)
      }
    })
    .subscribe()
}

// ─── Bot accepts a challenge ─────────────────────────────────────────────

async function botAcceptChallenge(battleId: string): Promise<void> {
  const { data: battle } = await supabase
    .from('battles')
    .select('status, challenger_id')
    .eq('id', battleId)
    .single()

  if (!battle || battle.status !== 'waiting') return
  if (battle.challenger_id === BOT_USER_ID) return // don't accept own challenges

  const { error } = await supabase
    .from('battles')
    .update({
      defender_id: BOT_USER_ID,
      defender_name: BOT_NAME,
      status: 'active',
      current_round: 1,
      is_bot_battle: true,
      player_win_probability: 0.75,
    })
    .eq('id', battleId)
    .eq('status', 'waiting')

  if (error) {
    console.error('[bot] Failed to accept challenge:', error.message)
    return
  }

  console.log(`[bot] The House accepted battle ${battleId}`)

  // Start watching for player moves to respond
  watchBattleMoves(battleId)
}

// ─── Watch battle moves and respond ──────────────────────────────────────

function watchBattleMoves(battleId: string): void {
  const channel = supabase
    .channel(`bot-battle-${battleId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'battle_moves',
      filter: `battle_id=eq.${battleId}`,
    }, async (payload: any) => {
      const move = payload.new
      if (!move || move.player_role === 'defender') return // ignore bot's own moves

      // Player submitted a move — bot responds after random delay
      const delay = 500 + Math.random() * 1500 // 0.5-2s
      setTimeout(() => botRespondToMove(battleId, move.round, move.move), delay)
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'battles',
      filter: `id=eq.${battleId}`,
    }, (payload: any) => {
      if (payload.new?.status === 'completed' || payload.new?.status === 'forfeit') {
        supabase.removeChannel(channel)
      }
    })
    .subscribe()
}

// ─── Bot submits a move ──────────────────────────────────────────────────

async function botRespondToMove(battleId: string, round: number, playerMove: string): Promise<void> {
  const winProb = await getBattleWinProbability(battleId)
  const botMove = generateBotMove(playerMove, winProb)

  // Check if bot already submitted for this round
  const { data: existing } = await supabase
    .from('battle_moves')
    .select('id')
    .eq('battle_id', battleId)
    .eq('round', round)
    .eq('player_role', 'defender')
    .single()

  if (existing) return // already submitted

  await supabase.from('battle_moves').insert({
    battle_id: battleId,
    round,
    player_role: 'defender',
    move: botMove,
  })

  // Check if both moves are in and resolve
  const { data: roundMoves } = await supabase
    .from('battle_moves')
    .select('*')
    .eq('battle_id', battleId)
    .eq('round', round)

  if (roundMoves && roundMoves.length === 2) {
    await resolveRoundServerSide(battleId, round, roundMoves)
  }
}

// ─── Bot move generation ─────────────────────────────────────────────────
// playerWinProbability controls how often bot throws a losing move
// 0.75 = bot throws losing move 75% of the time (player advantage)
// 0.50 = pure random

function generateBotMove(playerMove: string, playerWinProbability = 0.5): string {
  const losesTo: Record<string, string> = { rock: 'scissors', paper: 'rock', scissors: 'paper' }

  const roll = Math.random()
  if (roll < playerWinProbability) {
    // Bot throws move that LOSES to player's move
    return losesTo[playerMove] ?? MOVES[Math.floor(Math.random() * 3)]
  } else {
    // Bot throws random move
    return MOVES[Math.floor(Math.random() * 3)]
  }
}

// Get win probability for a battle (based on double-or-nothing count)
async function getBattleWinProbability(battleId: string): Promise<number> {
  const { data } = await supabase
    .from('battles')
    .select('player_win_probability, is_bot_battle')
    .eq('id', battleId)
    .single()

  if (!data?.is_bot_battle) return 0.5
  return data?.player_win_probability ?? 0.5
}

// Calculate probability based on double-or-nothing count
export function getDoubleProbability(count: number): number {
  if (count <= 0) return 0.75 // initial bot battle
  if (count === 1) return 0.60
  return 0.50 // pure fate from count 2+
}

// ─── Server-side round resolution (for bot games) ────────────────────────

const BEATS: Record<string, string> = { rock: 'scissors', scissors: 'paper', paper: 'rock' }

async function resolveRoundServerSide(battleId: string, round: number, moves: any[]): Promise<void> {
  const challengerMove = moves.find((m: any) => m.player_role === 'challenger')?.move
  const defenderMove = moves.find((m: any) => m.player_role === 'defender')?.move
  if (!challengerMove || !defenderMove) return

  let winner: 'challenger' | 'defender' | 'draw' = 'draw'
  if (challengerMove !== defenderMove) {
    winner = BEATS[challengerMove] === defenderMove ? 'challenger' : 'defender'
  }

  const { data: battle } = await supabase
    .from('battles')
    .select('round_results, challenger_id, defender_id')
    .eq('id', battleId)
    .single()

  if (!battle) return

  const roundResult = {
    round,
    challengerMove,
    defenderMove,
    winner,
    winnerId: winner === 'challenger' ? battle.challenger_id
      : winner === 'defender' ? battle.defender_id
      : null,
  }

  const results = [...(battle.round_results || []), roundResult]

  let cs = 0, ds = 0
  for (const r of results) {
    if (r.winner === 'challenger') cs++
    else if (r.winner === 'defender') ds++
  }

  let totalDraws = 0
  for (const r of results) { if (r.winner === 'draw') totalDraws++ }

  const updateData: any = {
    round_results: results,
    current_round: round + 1,
    challenger_round_wins: cs,
    defender_round_wins: ds,
    total_draws: totalDraws,
    total_rounds_played: round,
  }

  if (cs >= 2 || ds >= 2) {
    updateData.status = 'completed'
    updateData.winner_id = cs >= 2 ? battle.challenger_id : battle.defender_id
    updateData.completed_at = new Date().toISOString()
    updateData.rounds_played = round
  }

  await supabase.from('battles').update(updateData).eq('id', battleId)

  // Save to battle_rounds
  try {
    await supabase.from('battle_rounds').insert({
      battle_id: battleId,
      round_number: round,
      challenger_move: challengerMove,
      defender_move: defenderMove,
      winner_id: roundResult.winnerId,
    })
  } catch {}
}

// ─── Bot Lootbox Replenishment ───────────────────────────────────────────

export async function replenishBotLootbox(): Promise<number> {
  // Remove expired items
  await supabase
    .from('bot_lootbox')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .not('expires_at', 'is', null)

  // Count current items
  const { count } = await supabase
    .from('bot_lootbox')
    .select('id', { count: 'exact', head: true })

  const currentCount = count ?? 0
  if (currentCount >= 8) return 0

  const needed = 10 - currentCount // target 10 items

  // Get prizes from active flash sales
  const { data: activeSales } = await supabase
    .from('flash_sales')
    .select('id, business_id, ends_at, businesses(name), prizes(name, label, coupon_type, is_high_value)')
    .eq('status', 'live')
    .limit(20)

  if (!activeSales?.length) return 0

  let added = 0
  const usedBizIds = new Set<string>()

  // First pass: prioritize variety (different businesses)
  for (const sale of activeSales) {
    if (added >= needed) break
    if (usedBizIds.has(sale.business_id)) continue

    const prizes = (sale as any).prizes ?? []
    if (!prizes.length) continue

    const prize = prizes[Math.floor(Math.random() * prizes.length)]
    usedBizIds.add(sale.business_id)

    await supabase.from('bot_lootbox').insert({
      prize_name: prize.label || prize.name,
      business_name: (sale as any).businesses?.name ?? 'Unknown',
      business_id: sale.business_id,
      flash_sale_id: sale.id,
      coupon_type: prize.coupon_type || 'flash',
      expires_at: sale.ends_at,
    })
    added++
  }

  // Second pass: fill remaining from any sale
  for (const sale of activeSales) {
    if (added >= needed) break
    const prizes = (sale as any).prizes ?? []
    if (!prizes.length) continue

    const prize = prizes[Math.floor(Math.random() * prizes.length)]

    await supabase.from('bot_lootbox').insert({
      prize_name: prize.label || prize.name,
      business_name: (sale as any).businesses?.name ?? 'Unknown',
      business_id: sale.business_id,
      flash_sale_id: sale.id,
      coupon_type: prize.coupon_type || 'flash',
      expires_at: sale.ends_at,
    })
    added++
  }

  if (added > 0) console.log(`[bot] Replenished bot lootbox with ${added} items`)
  return added
}

// ─── Get Bot Lootbox Items ───────────────────────────────────────────────

export async function getBotLootbox(): Promise<any[]> {
  const { data } = await supabase
    .from('bot_lootbox')
    .select('*')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('added_at', { ascending: false })
    .limit(12)

  return data ?? []
}

// ─── Transfer Bot Lootbox Item to Player ─────────────────────────────────

export async function transferBotItem(botLootboxId: string, playerId: string): Promise<any> {
  const { data: item } = await supabase
    .from('bot_lootbox')
    .select('*')
    .eq('id', botLootboxId)
    .single()

  if (!item) return null

  // Delete from bot lootbox
  await supabase.from('bot_lootbox').delete().eq('id', botLootboxId)

  // Add to player's real wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .insert({
      user_id: playerId,
      prize_name: item.prize_name,
      business_name: item.business_name,
      business_id: item.business_id,
      coupon_type: item.coupon_type,
      coupon_code: `BOT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      expires_at: item.expires_at,
      auto_delete_at: item.expires_at,
      is_lootable: item.coupon_type !== 'flash',
      is_tradeable: item.coupon_type !== 'flash',
      is_redeemed: false,
      original_owner_id: playerId,
      current_owner_id: playerId,
    })
    .select()
    .single()

  return wallet
}

// ─── Check if a user is the bot ──────────────────────────────────────────

export function isBot(userId: string): boolean {
  return userId === BOT_USER_ID
}
