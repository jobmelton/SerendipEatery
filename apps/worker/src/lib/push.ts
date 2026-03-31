import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'

const expo = new Expo()

const BATCH_SIZE = 100

export interface PushPayload {
  token: string
  title: string
  body: string
  data?: Record<string, string>
  sound?: 'default' | null
  badge?: number
  channelId?: string
}

/**
 * Send push notifications via Expo Push API.
 * Automatically handles FCM (Android) and APNs (iOS).
 * Batches up to 100 notifications per request.
 */
export async function sendPushNotifications(
  payloads: PushPayload[],
): Promise<{ sent: number; failed: number; tickets: ExpoPushTicket[] }> {
  // Filter to valid Expo push tokens
  const valid = payloads.filter((p) => Expo.isExpoPushToken(p.token))
  if (valid.length === 0) return { sent: 0, failed: payloads.length, tickets: [] }

  const messages: ExpoPushMessage[] = valid.map((p) => ({
    to: p.token,
    title: p.title,
    body: p.body,
    data: p.data,
    sound: p.sound ?? 'default',
    badge: p.badge,
    channelId: p.channelId ?? 'default',
  }))

  // Chunk into batches of BATCH_SIZE
  const chunks = expo.chunkPushNotifications(messages)
  const allTickets: ExpoPushTicket[] = []
  let failed = payloads.length - valid.length

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk)
      allTickets.push(...tickets)

      // Count failures
      for (const ticket of tickets) {
        if (ticket.status === 'error') failed++
      }
    } catch (err) {
      console.error('Push batch failed:', err)
      failed += chunk.length
    }
  }

  const sent = valid.length - (failed - (payloads.length - valid.length))
  return { sent: Math.max(sent, 0), failed, tickets: allTickets }
}

/**
 * Send a single push notification.
 */
export async function sendPush(payload: PushPayload): Promise<boolean> {
  const { sent } = await sendPushNotifications([payload])
  return sent > 0
}
