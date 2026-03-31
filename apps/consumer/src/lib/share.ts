import * as Sharing from 'expo-sharing'
import * as Clipboard from 'expo-clipboard'
import * as FileSystem from 'expo-file-system'
import { Linking, Alert, Platform } from 'react-native'
import { createReferralLink } from './branch'

/**
 * Format share text for a win, tailored per platform.
 */
export function formatWinShareText(
  prizeName: string,
  businessName: string,
  referralCode: string,
): string {
  return [
    `I just won ${prizeName} at ${businessName} on SerendipEatery! 🎉🎰`,
    '',
    `Spin your next meal and win prizes at restaurants near you.`,
    '',
    `Use my code ${referralCode} for bonus points!`,
    `https://serendip.app/join/${referralCode}`,
  ].join('\n')
}

/**
 * Share a win with the system share sheet.
 */
export async function shareWin(
  prizeName: string,
  businessName: string,
  referralCode: string,
  imageUrl?: string,
): Promise<void> {
  const text = formatWinShareText(prizeName, businessName, referralCode)

  if (imageUrl && (await Sharing.isAvailableAsync())) {
    try {
      // Download image to local file for sharing
      const localUri = FileSystem.cacheDirectory + 'share-card.png'
      await FileSystem.downloadAsync(imageUrl, localUri)
      await Sharing.shareAsync(localUri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your win!',
      })
      return
    } catch {
      // Fall through to text-only share
    }
  }

  // Text-only fallback
  if (await Sharing.isAvailableAsync()) {
    // On iOS/Android, use Linking to trigger share sheet via a temp file approach
    // or fall back to clipboard
    await copyShareLink(`https://serendip.app/join/${referralCode}`)
    Alert.alert('Link Copied!', 'Share link copied to clipboard. Paste it anywhere!')
  }
}

/**
 * Deep link to Instagram Stories camera with a background image.
 */
export async function shareToInstagramStories(imageUrl: string): Promise<void> {
  // Download image first
  const localUri = FileSystem.cacheDirectory + 'ig-story.png'
  try {
    await FileSystem.downloadAsync(imageUrl, localUri)
  } catch {
    Alert.alert('Error', 'Failed to download share card')
    return
  }

  // Instagram Stories deep link
  // On iOS: instagram-stories://share
  // On Android: Intent-based (simplified here)
  const igUrl = Platform.select({
    ios: 'instagram-stories://share',
    android: 'intent://share#Intent;package=com.instagram.android;scheme=instagram-stories;end',
  })

  if (!igUrl) return

  const canOpen = await Linking.canOpenURL(igUrl)
  if (!canOpen) {
    Alert.alert('Instagram not found', 'Please install Instagram to share to Stories.')
    return
  }

  // On iOS, we pass data via pasteboard (UIPasteboard)
  // This is a simplified version — in production, use react-native-share
  // or react-native-instagram-stories-share for full support
  await Linking.openURL(igUrl)
}

/**
 * Share to Twitter/X with pre-filled text.
 */
export async function shareToTwitter(
  prizeName: string,
  businessName: string,
  referralCode: string,
): Promise<void> {
  const text = encodeURIComponent(
    `I just won ${prizeName} at ${businessName} on @SerendipEatery! 🎉\n\nSpin your next meal: serendip.app/join/${referralCode}`,
  )
  const url = `https://twitter.com/intent/tweet?text=${text}`
  await Linking.openURL(url)
}

/**
 * Copy a share link to clipboard.
 */
export async function copyShareLink(url: string): Promise<void> {
  await Clipboard.setStringAsync(url)
}

/**
 * Generate a Branch.io share link for a referral code.
 */
export async function getShareLink(referralCode: string): Promise<string> {
  return createReferralLink(referralCode)
}
