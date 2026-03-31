import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, Image, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useApi } from '../lib/api'
import { colors } from '../lib/theme'
import {
  shareWin,
  shareToInstagramStories,
  shareToTwitter,
  copyShareLink,
  getShareLink,
} from '../lib/share'
import type { MainStackParamList } from '../navigation/RootNavigator'

type RouteProps = NativeStackScreenProps<MainStackParamList, 'Share'>['route']

export function ShareScreen() {
  const route = useRoute<RouteProps>()
  const navigation = useNavigation<any>()
  const api = useApi()
  const { visitIntentId, prizeName, businessName } = route.params

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const [cardResult, codeResult] = await Promise.all([
          api.getShareCard(visitIntentId),
          api.myReferralCodes(),
        ])
        setImageUrl(cardResult.imageUrl)
        setReferralCode(codeResult.userCode ?? '')
      } catch {
        // card generation may fail — still show share options
      }
      setLoading(false)
    })()
  }, [api, visitIntentId])

  const onShareGeneric = useCallback(async () => {
    await shareWin(prizeName, businessName, referralCode, imageUrl ?? undefined)
  }, [prizeName, businessName, referralCode, imageUrl])

  const onInstagram = useCallback(async () => {
    if (!imageUrl) {
      Alert.alert('No image', 'Share card is still generating')
      return
    }
    await shareToInstagramStories(imageUrl)
  }, [imageUrl])

  const onTwitter = useCallback(async () => {
    await shareToTwitter(prizeName, businessName, referralCode)
  }, [prizeName, businessName, referralCode])

  const onCopyLink = useCallback(async () => {
    const link = await getShareLink(referralCode)
    await copyShareLink(link)
    Alert.alert('Copied!', 'Share link copied to clipboard')
  }, [referralCode])

  return (
    <View style={styles.container}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>Done</Text>
      </Pressable>

      <Text style={styles.title}>Share Your Win!</Text>
      <Text style={styles.subtitle}>Show off your prize and earn referral points</Text>

      {/* Share Card Preview */}
      <View style={styles.cardContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="contain" />
        ) : (
          <View style={styles.cardPlaceholder}>
            <Text style={styles.placeholderEmoji}>🎉</Text>
            <Text style={styles.placeholderText}>Won {prizeName}</Text>
            <Text style={styles.placeholderBiz}>at {businessName}</Text>
          </View>
        )}
      </View>

      {/* Share Buttons */}
      <View style={styles.shareButtons}>
        <Pressable style={styles.shareBtn} onPress={onShareGeneric}>
          <Text style={styles.shareBtnIcon}>📤</Text>
          <Text style={styles.shareBtnText}>Share</Text>
        </Pressable>

        <Pressable style={[styles.shareBtn, { backgroundColor: '#E1306C' }]} onPress={onInstagram}>
          <Text style={styles.shareBtnIcon}>📸</Text>
          <Text style={styles.shareBtnText}>Stories</Text>
        </Pressable>

        <Pressable style={[styles.shareBtn, { backgroundColor: '#1DA1F2' }]} onPress={onTwitter}>
          <Text style={styles.shareBtnIcon}>🐦</Text>
          <Text style={styles.shareBtnText}>Tweet</Text>
        </Pressable>

        <Pressable style={[styles.shareBtn, { backgroundColor: colors.accent }]} onPress={onCopyLink}>
          <Text style={styles.shareBtnIcon}>🔗</Text>
          <Text style={styles.shareBtnText}>Copy</Text>
        </Pressable>
      </View>

      {referralCode && (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Your referral code is included:</Text>
          <Text style={styles.codeValue}>{referralCode}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night, padding: 20, paddingTop: 60 },
  backBtn: { marginBottom: 12 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  cardContainer: {
    backgroundColor: colors.surfaceDim, borderRadius: 20,
    height: 340, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 20,
  },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { alignItems: 'center' },
  placeholderEmoji: { fontSize: 48 },
  placeholderText: { fontSize: 22, fontWeight: '700', color: colors.primary, marginTop: 8 },
  placeholderBiz: { fontSize: 16, color: colors.textSecondary, marginTop: 4 },
  shareButtons: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  shareBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 14,
    padding: 14, alignItems: 'center',
  },
  shareBtnIcon: { fontSize: 22 },
  shareBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 },
  codeBox: { backgroundColor: colors.surfaceDim, borderRadius: 14, padding: 16, alignItems: 'center' },
  codeLabel: { fontSize: 13, color: colors.textSecondary },
  codeValue: { fontSize: 20, fontWeight: '800', color: colors.primary, letterSpacing: 2, marginTop: 4 },
})
