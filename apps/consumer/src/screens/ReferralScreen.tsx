import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Share, Alert,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useApi } from '../lib/api'
import { colors } from '../lib/theme'

export function ReferralScreen() {
  const api = useApi()
  const [codes, setCodes] = useState<{ userCode: string | null; bizCode: string | null }>({ userCode: null, bizCode: null })
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [codeData, statsData] = await Promise.all([
        api.myReferralCodes(),
        api.referralStats(),
      ])
      setCodes({ userCode: codeData.userCode, bizCode: codeData.bizCode })
      setStats(statsData)
    } catch { /* */ }
  }, [api])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const onCopy = useCallback(async (code: string) => {
    await Clipboard.setStringAsync(code)
    Alert.alert('Copied!', `${code} copied to clipboard`)
  }, [])

  const onShare = useCallback(async (code: string) => {
    try {
      await Share.share({
        message: `Join me on SerendipEatery! Use my code ${code} to get bonus points.\n\nhttps://serendip.app/join/${code}`,
      })
    } catch { /* cancelled */ }
  }, [])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Refer Friends</Text>
      <Text style={styles.subtitle}>Share your code and earn rewards together</Text>

      {/* User Referral Code */}
      {codes.userCode && (
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Friend Code</Text>
          <Text style={styles.code}>{codes.userCode}</Text>
          <Text style={styles.codeHint}>You get +100 pts, they get +50 pts</Text>
          <View style={styles.btnRow}>
            <Pressable style={styles.copyBtn} onPress={() => onCopy(codes.userCode!)}>
              <Text style={styles.copyBtnText}>Copy</Text>
            </Pressable>
            <Pressable style={styles.shareBtn} onPress={() => onShare(codes.userCode!)}>
              <Text style={styles.shareBtnText}>Share</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Business Referral Code */}
      {codes.bizCode && (
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Business Referral</Text>
          <Text style={styles.code}>{codes.bizCode}</Text>
          <Text style={styles.codeHint}>You get +500 pts, they get 30-day trial extension</Text>
          <View style={styles.btnRow}>
            <Pressable style={styles.copyBtn} onPress={() => onCopy(codes.bizCode!)}>
              <Text style={styles.copyBtnText}>Copy</Text>
            </Pressable>
            <Pressable style={styles.shareBtn} onPress={() => onShare(codes.bizCode!)}>
              <Text style={styles.shareBtnText}>Share</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Stats */}
      {stats && (
        <>
          <Text style={styles.sectionTitle}>Your Referral Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalReferrals}</Text>
              <Text style={styles.statLabel}>Total Sent</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.rewardedReferrals}</Text>
              <Text style={styles.statLabel}>Redeemed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.pointsEarned}</Text>
              <Text style={styles.statLabel}>Pts Earned</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.conversionRate}%</Text>
              <Text style={styles.statLabel}>Conversion</Text>
            </View>
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night, padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: colors.night, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  codeCard: { backgroundColor: colors.surfaceDim, borderRadius: 16, padding: 20, marginBottom: 12, alignItems: 'center' },
  codeLabel: { fontSize: 13, color: colors.textSecondary },
  code: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: 3, marginTop: 6 },
  codeHint: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14, width: '100%' },
  copyBtn: { flex: 1, borderWidth: 1, borderColor: colors.primary, padding: 12, borderRadius: 12, alignItems: 'center' },
  copyBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  shareBtn: { flex: 1, backgroundColor: colors.primary, padding: 12, borderRadius: 12, alignItems: 'center' },
  shareBtnText: { color: colors.night, fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 16, marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { backgroundColor: colors.surfaceDim, borderRadius: 14, padding: 14, width: '48%', flexGrow: 1 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
})
