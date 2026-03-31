import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useApi } from '../lib/api'
import { colors } from '../lib/theme'

export function AnalyticsScreen() {
  const api = useApi()
  const [business, setBusiness] = useState<any>(null)
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const businesses = await api.myBusinesses()
      if (businesses.length > 0) {
        setBusiness(businesses[0])
        setSales(await api.businessSales(businesses[0].id))
      }
    } catch { /* */ }
  }, [api])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  const totalSpins = sales.reduce((s, x) => s + (x.spins_used ?? 0), 0)
  const totalMax = sales.reduce((s, x) => s + (x.max_spins_total ?? 0), 0)
  const conversionRate = totalMax > 0 ? Math.round((totalSpins / totalMax) * 100) : 0
  const estRevenue = totalSpins * 0.50

  const liveSales = sales.filter((s) => s.status === 'live').length
  const endedSales = sales.filter((s) => s.status === 'ended').length

  // Last 7 days chart data
  const last7: Array<{ label: string; spins: number }> = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const dayStr = d.toDateString()
    const label = d.toLocaleDateString(undefined, { weekday: 'short' })
    const spins = sales.filter((s) => new Date(s.created_at).toDateString() === dayStr).reduce((sum, s) => sum + (s.spins_used ?? 0), 0)
    last7.push({ label, spins })
  }
  const maxDay = Math.max(...last7.map((d) => d.spins), 1)

  // Top prizes
  const allPrizes: any[] = sales.flatMap((s) => s.prizes ?? [])
  const topPrizes = [...allPrizes].sort((a, b) => b.spins_used - a.spins_used).slice(0, 5)

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>Analytics</Text>
      <Text style={styles.bizName}>{business?.name ?? 'Your Business'}</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}><Text style={styles.statValue}>{totalSpins}</Text><Text style={styles.statLabel}>Total Visits</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{conversionRate}%</Text><Text style={styles.statLabel}>Conversion</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>${estRevenue.toFixed(2)}</Text><Text style={styles.statLabel}>Est. Revenue</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{sales.length}</Text><Text style={styles.statLabel}>Total Sales</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Sales Breakdown</Text>
      <View style={styles.breakdownRow}>
        <View style={[styles.breakdownItem, { backgroundColor: colors.success }]}>
          <Text style={styles.bdValue}>{liveSales}</Text><Text style={styles.bdLabel}>Live</Text>
        </View>
        <View style={[styles.breakdownItem, { backgroundColor: colors.accent }]}>
          <Text style={styles.bdValue}>{endedSales}</Text><Text style={styles.bdLabel}>Ended</Text>
        </View>
        <View style={[styles.breakdownItem, { backgroundColor: colors.textMuted }]}>
          <Text style={styles.bdValue}>{sales.length - liveSales - endedSales}</Text><Text style={styles.bdLabel}>Other</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Visits (Last 7 Days)</Text>
      <View style={styles.chart}>
        {last7.map((day, i) => (
          <View key={i} style={styles.chartCol}>
            <View style={styles.barWrap}>
              <View style={[styles.bar, { height: `${Math.max((day.spins / maxDay) * 100, 4)}%` }]} />
            </View>
            <Text style={styles.chartLbl}>{day.label}</Text>
            <Text style={styles.chartVal}>{day.spins}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Top Prizes</Text>
      {topPrizes.length === 0 ? (
        <Text style={styles.emptyText}>No prize data yet</Text>
      ) : topPrizes.map((p, i) => (
        <View key={p.id ?? i} style={styles.prizeRow}>
          <Text style={styles.prizeRank}>#{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.prizeName}>{p.name}</Text>
            <Text style={styles.prizeDetail}>{p.spins_used}/{p.max_spins} claimed</Text>
          </View>
          <Text style={styles.prizeRate}>{p.max_spins > 0 ? Math.round((p.spins_used / p.max_spins) * 100) : 0}%</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Business Tier</Text>
      <View style={styles.tierCard}>
        <Text style={styles.tierName}>{business?.biz_tier ?? 'operator'}</Text>
        <Text style={styles.tierPts}>{business?.biz_points ?? 0} biz points</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night },
  content: { padding: 20, paddingTop: 60, paddingBottom: 100 },
  center: { flex: 1, backgroundColor: colors.night, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  bizName: { fontSize: 14, color: colors.textSecondary, marginTop: 2, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { backgroundColor: colors.surfaceDim, borderRadius: 14, padding: 14, width: '48%', flexGrow: 1 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 10, marginTop: 8 },
  breakdownRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  breakdownItem: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  bdValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  bdLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, height: 140 },
  chartCol: { flex: 1, alignItems: 'center' },
  barWrap: { flex: 1, width: 24, justifyContent: 'flex-end' },
  bar: { backgroundColor: colors.primary, borderRadius: 4, width: '100%', minHeight: 4 },
  chartLbl: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  chartVal: { fontSize: 10, color: colors.textSecondary },
  prizeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceDim, borderRadius: 12, padding: 14, marginBottom: 8 },
  prizeRank: { fontSize: 16, fontWeight: '800', color: colors.primary, width: 32 },
  prizeName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  prizeDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  prizeRate: { fontSize: 16, fontWeight: '700', color: colors.success },
  tierCard: { backgroundColor: colors.surfaceDim, borderRadius: 14, padding: 16, marginBottom: 20 },
  tierName: { fontSize: 20, fontWeight: '700', color: colors.primary, textTransform: 'capitalize' },
  tierPts: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingTop: 12 },
})
