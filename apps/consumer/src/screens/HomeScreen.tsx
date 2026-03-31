import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useApi } from '../lib/api'
import { requestLocation, getCurrentLocation, distanceKm, type Coords } from '../lib/location'
import { colors } from '../lib/theme'
import type { MainStackParamList } from '../navigation/RootNavigator'

export function HomeScreen() {
  const api = useApi()
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const [sales, setSales] = useState<any[]>([])
  const [location, setLocation] = useState<Coords | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadSales = useCallback(async (coords: Coords) => {
    try {
      const data = await api.salesNearby(coords.lat, coords.lng)
      setSales(data)
    } catch {
      // silently fail — show empty state
    }
  }, [api])

  useEffect(() => {
    ;(async () => {
      const coords = await requestLocation()
      if (coords) {
        setLocation(coords)
        await loadSales(coords)
      }
      setLoading(false)
    })()
  }, [loadSales])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    const coords = await getCurrentLocation()
    if (coords) {
      setLocation(coords)
      await loadSales(coords)
    }
    setRefreshing(false)
  }, [loadSales])

  const formatDistance = (sale: any) => {
    if (!location) return ''
    const km = distanceKm(location, { lat: sale.lat, lng: sale.lng })
    return km < 1 ? `${Math.round(km * 1000)}m away` : `${km.toFixed(1)}km away`
  }

  const formatTimeRemaining = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - Date.now()
    if (diff <= 0) return 'Ended'
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m left`
    const hrs = Math.floor(mins / 60)
    return `${hrs}h ${mins % 60}m left`
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Finding sales near you...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Sales</Text>
        <Text style={styles.subtitle}>
          {sales.length} active {sales.length === 1 ? 'sale' : 'sales'} near you
        </Text>
      </View>

      <FlatList
        data={sales}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No sales nearby</Text>
            <Text style={styles.emptyText}>Pull down to refresh or check back later!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('SaleDetail', { saleId: item.id })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.bizName}>{item.business_name ?? 'Restaurant'}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.business_type ?? 'restaurant'}</Text>
              </View>
            </View>

            <Text style={styles.cuisine}>{item.cuisine ?? ''}</Text>

            {item.prizes && item.prizes.length > 0 && (
              <Text style={styles.prizePreview}>
                Win up to {item.prizes[0].name}
              </Text>
            )}

            <View style={styles.cardFooter}>
              <Text style={styles.distance}>{formatDistance(item)}</Text>
              <Text style={styles.timeLeft}>{formatTimeRemaining(item.ends_at)}</Text>
            </View>

            <View style={styles.spinsRow}>
              <View style={styles.spinsBar}>
                <View
                  style={[
                    styles.spinsFill,
                    { width: `${Math.max(5, ((item.max_spins_total - item.spins_used) / item.max_spins_total) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.spinsText}>
                {item.max_spins_total - item.spins_used} spins left
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, backgroundColor: colors.night, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textSecondary, marginTop: 12, fontSize: 16 },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surfaceDim,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bizName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  badge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  cuisine: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  prizePreview: { fontSize: 15, color: colors.primary, fontWeight: '600', marginTop: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  distance: { fontSize: 13, color: colors.textSecondary },
  timeLeft: { fontSize: 13, color: colors.success, fontWeight: '600' },
  spinsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  spinsBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  spinsFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  spinsText: { fontSize: 12, color: colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: 8 },
})
