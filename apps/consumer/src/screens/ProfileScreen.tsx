import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { useApi } from '../lib/api'
import { colors } from '../lib/theme'
import { CONSUMER_TIER_THRESHOLDS, type ConsumerTier } from '@serendipeatery/shared'

const TIER_ORDER: ConsumerTier[] = [
  'explorer', 'regular', 'local_legend', 'foodie_royale',
  'tastemaker', 'influencer', 'food_legend', 'icon',
]

const TIER_LABELS: Record<ConsumerTier, string> = {
  explorer: 'Explorer',
  regular: 'Regular',
  local_legend: 'Local Legend',
  foodie_royale: 'Foodie Royale',
  tastemaker: 'Tastemaker',
  influencer: 'Influencer',
  food_legend: 'Food Legend',
  icon: 'Icon',
}

export function ProfileScreen() {
  const { signOut } = useAuth()
  const { user: clerkUser } = useUser()
  const api = useApi()

  const [stats, setStats] = useState<any>(null)
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([api.myStats(), api.myVisits()])
      setStats(s)
      setVisits(v)
    } catch {
      // silently fail
    }
  }, [api])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const tier = (stats?.consumer_tier ?? 'explorer') as ConsumerTier
  const points = stats?.points ?? 0
  const tierIdx = TIER_ORDER.indexOf(tier)
  const nextTier = tierIdx < TIER_ORDER.length - 1 ? TIER_ORDER[tierIdx + 1] : null
  const nextThreshold = nextTier ? CONSUMER_TIER_THRESHOLDS[nextTier] : points
  const currentThreshold = CONSUMER_TIER_THRESHOLDS[tier]
  const progress = nextTier
    ? (points - currentThreshold) / (nextThreshold - currentThreshold)
    : 1

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={visits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            {/* Profile Header */}
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(clerkUser?.firstName?.[0] ?? 'S').toUpperCase()}
                </Text>
              </View>
              <Text style={styles.name}>
                {clerkUser?.firstName ?? 'Explorer'} {clerkUser?.lastName ?? ''}
              </Text>
              <Text style={styles.email}>{clerkUser?.emailAddresses?.[0]?.emailAddress ?? ''}</Text>
            </View>

            {/* Tier Card */}
            <View style={styles.tierCard}>
              <View style={styles.tierRow}>
                <Text style={styles.tierLabel}>{TIER_LABELS[tier]}</Text>
                {nextTier && (
                  <Text style={styles.nextTier}>Next: {TIER_LABELS[nextTier]}</Text>
                )}
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
              </View>
              <Text style={styles.pointsText}>
                {points.toLocaleString()} pts
                {nextTier ? ` / ${nextThreshold.toLocaleString()} pts` : ' — Max tier!'}
              </Text>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{stats?.totalVisits ?? 0}</Text>
                <Text style={styles.statLabel}>Visits</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{stats?.uniqueBusinesses ?? 0}</Text>
                <Text style={styles.statLabel}>Places</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{stats?.streak_days ?? 0}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Recent Visits</Text>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No visits yet. Spin a sale to get started!</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.visitCard}>
            <View style={styles.visitInfo}>
              <Text style={styles.visitBiz}>
                {item.flash_sales?.businesses?.name ?? 'Restaurant'}
              </Text>
              <Text style={styles.visitPrize}>{item.prize_won ?? 'No prize'}</Text>
            </View>
            <View style={styles.visitMeta}>
              <View style={[
                styles.stateBadge,
                { backgroundColor: item.state === 'confirmed' ? colors.success : colors.textMuted },
              ]}>
                <Text style={styles.stateText}>{item.state}</Text>
              </View>
              <Text style={styles.visitDate}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          <Pressable style={styles.signOutBtn} onPress={() => signOut()}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, backgroundColor: colors.night, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 100 },
  profileHeader: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: colors.night },
  name: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginTop: 10 },
  email: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  tierCard: {
    backgroundColor: colors.surfaceDim,
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierLabel: { fontSize: 18, fontWeight: '700', color: colors.primary },
  nextTier: { fontSize: 13, color: colors.textMuted },
  progressBar: {
    height: 8, backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4, marginTop: 10, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  pointsText: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: colors.surfaceDim, borderRadius: 16,
    padding: 16, marginBottom: 20,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingTop: 20 },
  visitCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surfaceDim, borderRadius: 12, padding: 14, marginBottom: 8,
  },
  visitInfo: { flex: 1 },
  visitBiz: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  visitPrize: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  visitMeta: { alignItems: 'flex-end' },
  stateBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  stateText: { color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  visitDate: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  signOutBtn: {
    borderWidth: 1, borderColor: colors.error,
    padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 24,
  },
  signOutText: { color: colors.error, fontSize: 16, fontWeight: '600' },
})
