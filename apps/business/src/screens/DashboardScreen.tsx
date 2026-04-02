import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useUser } from '@clerk/clerk-expo'
import { useApi } from '../lib/api'
import { colors } from '../lib/theme'
import type { MainStackParamList } from '../navigation/RootNavigator'

export function DashboardScreen() {
  const { user } = useUser()
  const api = useApi()
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()

  const [business, setBusiness] = useState<any>(null)
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const businessName =
    (user?.unsafeMetadata as { businessName?: string })?.businessName ?? 'Your Business'

  const load = useCallback(async () => {
    try {
      const businesses = await api.myBusinesses()
      if (businesses.length > 0) {
        setBusiness(businesses[0])
        const s = await api.businessSales(businesses[0].id)
        setSales(s)
      }
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

  const activeSales = sales.filter((s) => s.status === 'live')
  const todaySales = sales.filter((s) => new Date(s.created_at).toDateString() === new Date().toDateString())
  const totalVisitsToday = todaySales.reduce((sum: number, s: any) => sum + (s.spins_used ?? 0), 0)
  const revenueToday = totalVisitsToday * 0.50

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={styles.bizName}>{business?.name ?? businessName}</Text>
        <Text style={styles.greeting}>Welcome back, {user?.firstName ?? 'Owner'}</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activeSales.length}</Text>
          <Text style={styles.statLabel}>Active Sales</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalVisitsToday}</Text>
          <Text style={styles.statLabel}>Visits Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>${revenueToday.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Revenue Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{business?.biz_tier ?? 'operator'}</Text>
          <Text style={styles.statLabel}>Tier</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => navigation.navigate('CreateSale', { businessId: business?.id })}
        >
          <Text style={styles.actionIcon}>+</Text>
          <Text style={styles.actionText}>New Sale</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: colors.accent }]}
          onPress={() => navigation.navigate('Analytics', { businessId: business?.id })}
        >
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionText}>Analytics</Text>
        </Pressable>
      </View>

      {activeSales.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Live Sales</Text>
          {activeSales.map((sale) => (
            <Pressable
              key={sale.id}
              style={styles.saleCard}
              onPress={() => navigation.navigate('SaleDetail', { saleId: sale.id })}
            >
              <View style={styles.saleRow}>
                <View style={styles.liveDot} />
                <Text style={styles.saleTime}>
                  {new Date(sale.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' - '}
                  {new Date(sale.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={styles.saleStats}>
                <Text style={styles.saleStat}>{sale.spins_used}/{sale.max_spins_total} spins</Text>
                <Text style={styles.saleStat}>{sale.prizes?.length ?? 0} prizes</Text>
              </View>
            </Pressable>
          ))}
        </>
      )}

      {/* Battle Station */}
      {business && (
        <>
          <Text style={styles.sectionTitle}>Battle Station</Text>
          <View style={styles.battleStationCard}>
            <View style={styles.battleStationHeader}>
              <Text style={styles.battleStationIcon}>⚔️</Text>
              <View>
                <Text style={styles.battleStationTitle}>Customer Battle QR</Text>
                <Text style={styles.battleStationSub}>Customers scan and play RPS for prizes</Text>
              </View>
            </View>
            <View style={styles.battleStatsRow}>
              <View style={styles.battleStat}>
                <Text style={styles.battleStatValue}>{business.battle_station_plays ?? 0}</Text>
                <Text style={styles.battleStatLabel}>Plays</Text>
              </View>
              <View style={styles.battleStat}>
                <Text style={styles.battleStatValue}>{business.battle_station_wins ?? 0}</Text>
                <Text style={styles.battleStatLabel}>Wins</Text>
              </View>
              <View style={styles.battleStat}>
                <Text style={[styles.battleStatValue, { color: colors.success }]}>
                  {business.battle_station_plays > 0
                    ? `${Math.round((business.battle_station_wins / business.battle_station_plays) * 100)}%`
                    : '—'}
                </Text>
                <Text style={styles.battleStatLabel}>Win Rate</Text>
              </View>
            </View>
            <Text style={styles.battleStationUrl}>
              serendipeatery.com/battle/business/{business.id?.slice(0, 8)}...
            </Text>
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>Recent Sales</Text>
      {sales.length === 0 ? (
        <Text style={styles.emptyText}>No sales yet. Create your first flash sale!</Text>
      ) : (
        sales.slice(0, 5).map((sale) => (
          <Pressable
            key={sale.id}
            style={styles.recentCard}
            onPress={() => navigation.navigate('SaleDetail', { saleId: sale.id })}
          >
            <View>
              <Text style={styles.recentDate}>
                {new Date(sale.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
              <Text style={styles.recentSpins}>{sale.spins_used} spins used</Text>
            </View>
            <View style={[
              styles.statusBadge,
              { backgroundColor: sale.status === 'live' ? colors.success : sale.status === 'ended' ? colors.textMuted : colors.accent },
            ]}>
              <Text style={styles.statusText}>{sale.status}</Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night },
  content: { padding: 20, paddingTop: 60, paddingBottom: 100 },
  center: { flex: 1, backgroundColor: colors.night, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 20 },
  bizName: { fontSize: 26, fontWeight: '800', color: colors.primary },
  greeting: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { backgroundColor: colors.surfaceDim, borderRadius: 14, padding: 14, width: '48%', flexGrow: 1 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 10, marginTop: 8 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  actionBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
  actionIcon: { fontSize: 24, color: colors.night },
  actionText: { fontSize: 14, fontWeight: '700', color: colors.night, marginTop: 4 },
  saleCard: { backgroundColor: colors.surfaceDim, borderRadius: 14, padding: 14, marginBottom: 8 },
  saleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  saleTime: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  saleStats: { flexDirection: 'row', gap: 16, marginTop: 6 },
  saleStat: { fontSize: 13, color: colors.textSecondary },
  recentCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceDim, borderRadius: 12, padding: 14, marginBottom: 8 },
  recentDate: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  recentSpins: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingTop: 20 },
  battleStationCard: { backgroundColor: colors.surfaceDim, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(247,148,29,0.15)' },
  battleStationHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  battleStationIcon: { fontSize: 28 },
  battleStationTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  battleStationSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  battleStatsRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  battleStat: { flex: 1, backgroundColor: colors.night, borderRadius: 10, padding: 10, alignItems: 'center' },
  battleStatValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  battleStatLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  battleStationUrl: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
})
