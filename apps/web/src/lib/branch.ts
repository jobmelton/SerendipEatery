/**
 * Branch.io deep link generation for web.
 * Creates links that open the app if installed, fall back to web otherwise.
 */

const BRANCH_KEY = process.env.NEXT_PUBLIC_BRANCH_KEY || ''
const LINK_DOMAIN = 'serendip.app.link'
const WEB_DOMAIN = 'serendipeatery.com'

interface BattleLinkParams {
  battleId: string
  challengerName?: string
  message?: string
}

/**
 * Create a Branch.io deep link for a battle challenge.
 * If Branch key is not configured, falls back to direct web URL.
 */
export async function createBattleLink(params: BattleLinkParams): Promise<string> {
  const webUrl = `https://${WEB_DOMAIN}/battle/${params.battleId}`

  if (!BRANCH_KEY) return webUrl

  try {
    const res = await fetch('https://api2.branch.io/v1/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branch_key: BRANCH_KEY,
        data: {
          // Deep link data for the app
          battle_id: params.battleId,
          challenger_name: params.challengerName,
          message: params.message,
          // Routing
          $desktop_url: webUrl,
          $ios_url: webUrl,
          $android_url: webUrl,
          $fallback_url: webUrl,
          // App scheme
          $deeplink_path: `battle/${params.battleId}`,
          $uri_redirect_mode: 1,
          // OG tags for link preview
          $og_title: 'SerendipEatery Challenge',
          $og_description: params.message || 'Accept the challenge!',
        },
      }),
    })
    const json = await res.json()
    if (json.url) return json.url
  } catch {}

  return webUrl
}

/**
 * Get the web fallback URL for a battle (no Branch).
 */
export function getBattleWebUrl(battleId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/battle/${battleId}`
  }
  return `https://${WEB_DOMAIN}/battle/${battleId}`
}

/**
 * Calculate SMS character count and warn about multi-part messages.
 * Standard SMS is 160 chars (GSM-7) or 70 chars (UCS-2 for emoji).
 * With emoji, limit is effectively 70 chars per segment.
 */
export function smsCharInfo(text: string): { length: number; segments: number; warning: boolean } {
  const hasEmoji = /[\u{1F600}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u270A-\u270D]|✊|✋|✌️/u.test(text)
  const limit = hasEmoji ? 70 : 160
  const segments = Math.ceil(text.length / limit) || 1
  return { length: text.length, segments, warning: segments > 1 }
}
