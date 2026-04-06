import { supabase } from './supabase.js'

// ─── Get current badge holder ───────────────────────────────────────────

export async function getCurrentBadgeHolder(badgeId: string) {
  const { data } = await supabase
    .from('badge_holders')
    .select('*')
    .eq('badge_id', badgeId)
    .eq('is_current', true)
    .limit(1)
    .single()

  return data
}

// ─── Transfer a traveling badge ─────────────────────────────────────────

export async function transferTravelingBadge(
  badgeId: string,
  newHolderId: string,
  triggerRef: string | null,
  context: Record<string, any>
): Promise<void> {
  // Get current holders
  const { data: current } = await supabase
    .from('badge_holders')
    .select('*')
    .eq('badge_id', badgeId)
    .eq('is_current', true)

  // Close out previous holders
  for (const holder of current ?? []) {
    await supabase.from('badge_holders').update({
      is_current: false,
      held_until: new Date().toISOString(),
      superseded_by: newHolderId,
    }).eq('id', holder.id)
  }

  // Get user name
  const userName = await getUserName(newHolderId)

  // Award to new holder
  await supabase.from('badge_holders').insert({
    badge_id: badgeId,
    user_id: newHolderId,
    user_name: userName,
    held_from: new Date().toISOString(),
    is_current: true,
    trigger_context: { ...context, trigger_ref: triggerRef },
  })
}

// ─── Draw streak detection ──────────────────────────────────────────────

export async function checkDrawStreak(
  battleId: string,
  challengerId: string,
  defenderId: string,
  roundResult: string
): Promise<{ newRecord: boolean; streakCount: number } | null> {
  const [p1, p2] = [challengerId, defenderId].sort()

  if (roundResult !== 'draw') {
    // End any active draw streak for these players
    await endDrawStreak(p1, p2)
    return null
  }

  // Find active draw streak between these players
  const { data: existing } = await supabase
    .from('draw_streaks')
    .select('*')
    .eq('player1_id', p1)
    .eq('player2_id', p2)
    .eq('is_active', true)
    .single()

  if (existing) {
    const newCount = existing.streak_count + 1
    await supabase.from('draw_streaks')
      .update({ streak_count: newCount })
      .eq('id', existing.id)

    const isRecord = await checkDrawStreakRecord(p1, p2, battleId, newCount)
    return { newRecord: isRecord, streakCount: newCount }
  } else {
    // Start new streak
    await supabase.from('draw_streaks').insert({
      player1_id: p1,
      player2_id: p2,
      battle_id: battleId,
      streak_count: 1,
    })
    const isRecord = await checkDrawStreakRecord(p1, p2, battleId, 1)
    return { newRecord: isRecord, streakCount: 1 }
  }
}

async function endDrawStreak(p1: string, p2: string): Promise<void> {
  await supabase.from('draw_streaks')
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq('player1_id', p1)
    .eq('player2_id', p2)
    .eq('is_active', true)
}

async function checkDrawStreakRecord(
  p1Id: string,
  p2Id: string,
  battleId: string,
  streakCount: number
): Promise<boolean> {
  const currentRecord = await getCurrentBadgeHolder('longest_draw_streak')

  if (!currentRecord || streakCount > (currentRecord.trigger_context?.streak_count ?? 0)) {
    // New record — award to BOTH players
    await transferTravelingBadge('longest_draw_streak', p1Id, battleId, {
      streak_count: streakCount,
      co_holder: p2Id,
    })
    await transferTravelingBadge('longest_draw_streak', p2Id, battleId, {
      streak_count: streakCount,
      co_holder: p1Id,
    })

    // Notify previous holder
    if (currentRecord && currentRecord.user_id !== p1Id && currentRecord.user_id !== p2Id) {
      try {
        const { sendPushToGuest } = await import('./pushNotifications.js')
        await sendPushToGuest(currentRecord.user_id, {
          title: 'Your draw streak record was broken',
          body: `Someone just drew ${streakCount} consecutive times. Can you beat it?`,
          url: '/badges/longest_draw_streak',
        })
      } catch {}
    }

    return true
  }

  return false
}

// ─── Check battle win record ────────────────────────────────────────────

export async function checkBattleWinRecord(userId: string, totalWins: number): Promise<boolean> {
  const currentRecord = await getCurrentBadgeHolder('most_battles_won')

  if (!currentRecord || totalWins > (currentRecord.trigger_context?.total_wins ?? 0)) {
    await transferTravelingBadge('most_battles_won', userId, null, {
      total_wins: totalWins,
    })

    if (currentRecord && currentRecord.user_id !== userId) {
      try {
        const { sendPushToGuest } = await import('./pushNotifications.js')
        await sendPushToGuest(currentRecord.user_id, {
          title: 'Your Warlord title was taken',
          body: `Someone just surpassed your battle win record with ${totalWins} wins.`,
          url: '/badges/most_battles_won',
        })
      } catch {}
    }

    return true
  }
  return false
}

// ─── Check tournament size record ───────────────────────────────────────

export async function checkTournamentSizeRecord(
  hostId: string,
  tournamentId: string,
  playerCount: number
): Promise<boolean> {
  const currentRecord = await getCurrentBadgeHolder('largest_tournament')

  if (!currentRecord || playerCount > (currentRecord.trigger_context?.player_count ?? 0)) {
    await transferTravelingBadge('largest_tournament', hostId, tournamentId, {
      player_count: playerCount,
      tournament_id: tournamentId,
    })
    return true
  }
  return false
}

// ─── Check perfect tournament win ───────────────────────────────────────

export async function checkPerfectTournamentWin(
  winnerId: string,
  tournamentId: string,
  roundsLost: number
): Promise<boolean> {
  if (roundsLost > 0) return false

  const currentRecord = await getCurrentBadgeHolder('fastest_tournament_win')

  // If no one has it yet, or this is also a perfect win (both get it — first one keeps it)
  if (!currentRecord) {
    await transferTravelingBadge('fastest_tournament_win', winnerId, tournamentId, {
      tournament_id: tournamentId,
      rounds_lost: 0,
    })
    return true
  }

  return false
}

// ─── Check points record ────────────────────────────────────────────────

export async function checkPointsRecord(userId: string, totalPoints: number): Promise<boolean> {
  const currentRecord = await getCurrentBadgeHolder('highest_points')

  if (!currentRecord || totalPoints > (currentRecord.trigger_context?.total_points ?? 0)) {
    await transferTravelingBadge('highest_points', userId, null, {
      total_points: totalPoints,
    })
    return true
  }
  return false
}

// ─── Check proximity to record (80% warning) ───────────────────────────

export async function checkProximityWarning(
  badgeId: string,
  currentValue: number,
  challegerUserId: string
): Promise<void> {
  const currentRecord = await getCurrentBadgeHolder(badgeId)
  if (!currentRecord || currentRecord.user_id === challegerUserId) return

  const recordValue = getRecordValue(currentRecord, badgeId)
  if (recordValue <= 0) return

  const ratio = currentValue / recordValue
  if (ratio >= 0.8 && ratio < 1.0) {
    const remaining = recordValue - currentValue
    try {
      const { sendPushToGuest } = await import('./pushNotifications.js')
      const { data: badge } = await supabase
        .from('badge_definitions')
        .select('name')
        .eq('id', badgeId)
        .single()

      await sendPushToGuest(currentRecord.user_id, {
        title: `Someone is closing in on your ${badge?.name ?? 'record'}`,
        body: `They're ${remaining} away from beating you. Defend your title!`,
        url: `/badges/${badgeId}`,
      })
    } catch {}
  }
}

function getRecordValue(holder: any, badgeId: string): number {
  const ctx = holder.trigger_context ?? {}
  switch (badgeId) {
    case 'longest_draw_streak': return ctx.streak_count ?? 0
    case 'most_battles_won': return ctx.total_wins ?? 0
    case 'largest_tournament': return ctx.player_count ?? 0
    case 'highest_points': return ctx.total_points ?? 0
    default: return 0
  }
}

// ─── Helper ─────────────────────────────────────────────────────────────

async function getUserName(userId: string): Promise<string> {
  // Try users table first
  const { data: user } = await supabase
    .from('users')
    .select('display_name')
    .eq('clerk_id', userId)
    .single()

  if (user?.display_name) return user.display_name

  // Check tournament_players for guest names
  const { data: tp } = await supabase
    .from('tournament_players')
    .select('player_name')
    .eq('player_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .single()

  if (tp?.player_name) return tp.player_name

  // Check battles for guest names
  const { data: b } = await supabase
    .from('battles')
    .select('challenger_name')
    .eq('challenger_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return b?.challenger_name ?? 'Unknown'
}
