import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useApi } from '../lib/api'
import { colors } from '../lib/theme'
import type { MainStackParamList } from '../navigation/RootNavigator'

type RouteProps = NativeStackScreenProps<MainStackParamList, 'SaleDetail'>['route']

export function SaleDetailScreen() {
  const route = useRoute<RouteProps>()
  const navigation = useNavigation<any>()
  const api = useApi()
  const { saleId } = route.params

  const [sale, setSale] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setSale(await api.getSale(saleId))
    } catch { /* */ }
  }, [api, saleId])

  useEffect(() => {
    load().finally(() => setLoading(false))
    // Poll every 10s for live updates
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const onUpdateStatus = useCallback((status: string) => {
    const label = status === 'live' ? 'Go Live' : status === 'ended' ? 'End Sale' : 'Cancel Sale'
    Alert.alert(`${label}?`, `Are you sure you want to ${label.toLowerCase()}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label,
        style: status === 'cancelled' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            const updated = await api.updateSaleStatus(saleId, status)
            setSale((prev: any) => ({ ...prev, ...updated }))
          } catch (err: any) {
            Alert.alert('Failed', err.message)
          }
        },
      },
    ])
  }, [api, saleId])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
  }
  if (!sale) {
    return <View style={styles.center}><Text style={styles.errorText}>Sale not found</Text></View>
  }

  const spinsRemaining = sale.max_spins_total - sale.spins_used
  const utilPct = sale.max_spins_total > 0 ? Math.round((sale.spins_used / sale.max_spins_total) * 100) : 0

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <Text style={styles.title}>Sale Details</Text>
        <View style={[styles.statusBadge, { backgroundColor: sale.status === 'live' ? colors.success : colors.textMuted }]}>
          <Text style={styles.statusText}>{sale.status}</Text>
        </View>
      </View>

      <Text style={styles.timeRange}>
        {new Date(sale.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {' - '}
        {new Date(sale.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{sale.spins_used}</Text>
          <Text style={styles.statLabel}>Used</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{spinsRemaining}</Text>
          <Text style={styles.statLabel}>Remaining</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{utilPct}%</Text>
          <Text style={styles.statLabel}>Utilization</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${utilPct}%` }]} />
      </View>

      <Text style={styles.sectionTitle}>Prizes</Text>
      {sale.prizes?.map((prize: any) => {
        const remaining = prize.max_spins - prize.spins_used
        const pct = prize.max_spins > 0 ? (prize.spins_used / prize.max_spins) * 100 : 0
        const exhausted = remaining <= 0
        return (
          <View key={prize.id} style={styles.prizeCard}>
            <View style={styles.prizeHeader}>
              <Text style={[styles.prizeName, exhausted && { opacity: 0.4 }]}>{prize.name}</Text>
              <Text style={[styles.prizeCount, exhausted && { color: colors.error }]}>
                {exhausted ? 'Exhausted' : `${remaining} left`}
              </Text>
            </View>
            <View style={styles.prizeBar}>
              <View style={[styles.prizeFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.prizeDetail}>{prize.spins_used}/{prize.max_spins} claimed</Text>
          </View>
        )
      })}

      {sale.status === 'scheduled' && (
        <Pressable style={styles.actionBtn} onPress={() => onUpdateStatus('live')}>
          <Text style={styles.actionBtnText}>Go Live Now</Text>
        </Pressable>
      )}
      {sale.status === 'live' && (
        <View style={styles.actionsCol}>
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.error }]} onPress={() => onUpdateStatus('ended')}>
            <Text style={styles.actionBtnText}>End Sale</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.textMuted }]} onPress={() => onUpdateStatus('cancelled')}>
            <Text style={styles.actionBtnText}>Cancel Sale</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.night, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.error, fontSize: 16 },
  backBtn: { marginBottom: 12 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  timeRange: { fontSize: 15, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  prizeCard: { backgroundColor: colors.surfaceDim, borderRadius: 12, padding: 14, marginBottom: 8 },
  prizeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prizeName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  prizeCount: { fontSize: 13, fontWeight: '600', color: colors.success },
  prizeBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  prizeFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  prizeDetail: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  actionsCol: { gap: 10, marginTop: 20 },
  actionBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
