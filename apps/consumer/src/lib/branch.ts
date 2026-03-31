/**
 * Branch.io deep link handler for referral codes.
 *
 * In production, install react-native-branch and replace these stubs
 * with real Branch SDK calls. This module provides the interface so
 * the rest of the app can depend on it now.
 */

const BRANCH_KEY = process.env.EXPO_PUBLIC_BRANCH_KEY || ''
const LINK_DOMAIN = 'serendip.app.link'

type DeepLinkCallback = (referralCode: string | null) => void

let _onDeepLink: DeepLinkCallback | null = null

/**
 * Initialize Branch SDK on app launch.
 * Call this once in App.tsx or the root navigator.
 */
export function initBranch(onDeepLink: DeepLinkCallback): void {
  _onDeepLink = onDeepLink

  // In production with react-native-branch:
  // branch.subscribe(({ error, params }) => {
  //   if (error) { console.error('Branch error:', error); return }
  //   if (params['+clicked_branch_link']) {
  //     const code = params.referral_code ?? null
  //     onDeepLink(code)
  //   }
  // })

  console.log('[Branch] Initialized (stub mode)')
}

/**
 * Parse incoming deep link URL and extract referral code.
 * Works with both Branch links and direct serendipeatery:// URLs.
 */
export function handleDeepLink(url: string): string | null {
  try {
    // Direct scheme: serendipeatery://join/MAYA-U42
    if (url.startsWith('serendipeatery://')) {
      const path = url.replace('serendipeatery://', '')
      const match = path.match(/^join\/([A-Z0-9-]+)/i)
      if (match) return match[1].toUpperCase()
    }

    // Web URL: https://serendip.app/join/MAYA-U42
    if (url.includes('/join/')) {
      const match = url.match(/\/join\/([A-Z0-9-]+)/i)
      if (match) return match[1].toUpperCase()
    }

    // Branch link with query params
    if (url.includes('referral_code=')) {
      const match = url.match(/referral_code=([A-Z0-9-]+)/i)
      if (match) return match[1].toUpperCase()
    }
  } catch {
    // invalid URL
  }

  return null
}

/**
 * Create a shareable Branch.io link with referral code embedded.
 * Falls back to a direct web link if Branch isn't configured.
 */
export async function createReferralLink(code: string): Promise<string> {
  // In production with react-native-branch:
  // const buo = await branch.createBranchUniversalObject(`referral/${code}`, {
  //   title: 'Join SerendipEatery',
  //   contentDescription: `Use code ${code} for bonus points!`,
  //   contentMetadata: { customMetadata: { referral_code: code } },
  // })
  // const { url } = await buo.generateShortUrl({
  //   feature: 'referral',
  //   channel: 'app',
  //   data: { referral_code: code },
  // })
  // return url

  // Fallback: direct web link
  return `https://serendip.app/join/${code}`
}

/**
 * Auto-redeem a referral code that came in via deep link on first install.
 * Called after the user signs up and is authenticated.
 */
export async function autoRedeemIfPending(
  redeemFn: (code: string) => Promise<void>,
): Promise<void> {
  // In production, check AsyncStorage for a pending referral code
  // that was captured before the user signed up:
  //
  // const pendingCode = await AsyncStorage.getItem('pending_referral')
  // if (pendingCode) {
  //   await redeemFn(pendingCode)
  //   await AsyncStorage.removeItem('pending_referral')
  // }

  console.log('[Branch] autoRedeemIfPending (stub mode)')
}
