import webpush from 'web-push'
import { supabase } from './supabase.js'

// Configure VAPID
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:hello@serendipeatery.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId)

  for (const { id, subscription } of subs ?? []) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload))
      await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', id)
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', id)
      }
    }
  }
}

export async function sendPushToProximityCell(cell: string, payload: PushPayload): Promise<void> {
  const nearbyCells = getNearbyCells(cell)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .in('proximity_cell', nearbyCells)

  for (const { id, subscription } of subs ?? []) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload))
      await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', id)
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', id)
      }
    }
  }
}

export async function sendPushToGuest(guestId: string, payload: PushPayload): Promise<void> {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('guest_id', guestId)

  for (const { id, subscription } of subs ?? []) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload))
      await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', id)
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', id)
      }
    }
  }
}

function getNearbyCells(cell: string): string[] {
  const [lat, lng] = cell.split(':').map(Number)
  const cells: string[] = []
  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      cells.push(`${(lat + dlat * 0.001).toFixed(3)}:${(lng + dlng * 0.001).toFixed(3)}`)
    }
  }
  return cells
}
