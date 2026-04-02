import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useApi } from '../lib/api'
import { colors } from '../lib/theme'

interface WalletItem {
  id: string
  prize_name: string
  business_name: string | null
  coupon_code: string | null
  expires_at: string | null
  is_long_term: boolean
  is_lootable: boolean
}

const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
}

export function WalletScreen() {
  const api = useApi()
  const [items, setItems] = useState<WalletItem[]>([])
  const [points, setPoints] = useState(0)
  const [tier, setTier] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadWallet = useCallback(async () => {
    try {
      const stats = await api.myStats()
      setPoints(stats?.consumer_points ?? 0)
      setTier(stats?.consumer_tier ?? null)
    } catch {}
    // Wallet items will come from a dedicated endpoint
    setItems([])
    setLoading(false)
  }, [api])

  useEffect(() => {
    loadWallet()
  }, [loadWallet])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadWallet()
    setRefreshing(false)
  }, [loadWallet])

  const handleUse = (item: WalletItem) => {
    Alert.alert(
      'Use Coupon',
      `Show this code to the cashier:\n\n${item.coupon_code || 'No code'}`,
      [{ text: 'Done', style: 'default' }],
    )
  }

  const formatExpiry = (date: string | null) => {
    if (!date) return 'No expiry'
    const d = new Date(date)
    const now = new Date()
    const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 0) return 'Expired'
    if (daysLeft === 1) return '1 day left'
    if (daysLeft <= 7) return `${daysLeft} days left`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const renderItem = ({ item }: { item: WalletItem }) => {
    const expired = item.expires_at && new Date(item.expires_at) < new Date()
    return (
      <View style={[styles.card, expired && styles.cardExpired]}>
        {/* Business initial */}
        <View style={styles.bizLogo}>
          <Text style={styles.bizLogoText}>
            {(item.business_name || '?')[0].toUpperCase()}
          </Text>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.prizeName}>{item.prize_name}</Text>
          {item.business_name && (
            <Text style={styles.bizName}>{item.business_name}</Text>
          )}
          <View style={styles.metaRow}>
            <Text style={[
              styles.expiry,
              expired ? { color: colors.error } : item.is_long_term ? { color: colors.success } : {},
            ]}>
              {item.is_long_term ? '🛡️ Long-term' : formatExpiry(item.expires_at)}
            </Text>
            {item.is_lootable && (
              <View style={styles.lootableBadge}>
                <Text style={styles.lootableText}>Lootable</Text>
              </View>
            )}
          </View>
        </View>

        <Pressable
          style={[styles.useBtn, expired && styles.useBtnDisabled]}
          onPress={() => handleUse(item)}
          disabled={!!expired}
        >
          <Text style={styles.useText}>{expired ? 'Expired' : 'Use'}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Wallet</Text>
        <View style={styles.statsRow}>
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsValue}>{points}</Text>
            <Text style={styles.pointsLabel}>pts</Text>
          </View>
          {tier && (
            <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[tier] || colors.primary }]}>
              <Text style={styles.tierText}>{tier}</Text>
            </View>
          )}
          <Text style={styles.subtitle}>{items.length} coupon{items.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎒</Text>
              <Text style={styles.emptyText}>No coupons yet</Text>
              <Text style={styles.emptySubtext}>Win deals to fill your wallet</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night },
  header: {
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '900', color: colors.textPrimary },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  pointsBadge: {
    flexDirection: 'row', alignItems: 'baseline', gap: 3,
    backgroundColor: colors.surfaceDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  pointsValue: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  pointsLabel: { color: colors.textMuted, fontSize: 12 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tierText: { fontSize: 10, fontWeight: '800', color: '#000', textTransform: 'uppercase' },
  subtitle: { color: colors.textMuted, fontSize: 14 },
  list: { padding: 12 },
  gridRow: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1, backgroundColor: colors.surfaceDim, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(247,148,29,0.1)',
  },
  cardExpired: { opacity: 0.5 },
  bizLogo: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  bizLogoText: { color: colors.night, fontSize: 16, fontWeight: '900' },
  cardContent: { flex: 1, marginBottom: 10 },
  prizeName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  bizName: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  expiry: { color: colors.textSecondary, fontSize: 11 },
  lootableBadge: {
    backgroundColor: 'rgba(247,148,29,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  lootableText: { color: colors.primary, fontSize: 9, fontWeight: '700' },
  useBtn: {
    backgroundColor: colors.primary, paddingVertical: 8, borderRadius: 12, alignItems: 'center',
  },
  useBtnDisabled: { backgroundColor: colors.textMuted },
  useText: { color: colors.night, fontSize: 14, fontWeight: '800' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
})
