import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack'
import { useApi } from '../lib/api'
import { getCurrentLocation, distanceKm } from '../lib/location'
import { colors } from '../lib/theme'
import type { MainStackParamList } from '../navigation/RootNavigator'

type RouteProps = NativeStackScreenProps<MainStackParamList, 'SaleDetail'>['route']

export function SaleDetailScreen() {
  const route = useRoute<RouteProps>()
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const api = useApi()
  const { saleId } = route.params

  const [sale, setSale] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [insideFence, setInsideFence] = useState(false)
  const [spinning, setSpinning] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await api.getSale(saleId)
        setSale(data)

        // Check if user is inside geofence (within ~10m)
        const coords = await getCurrentLocation()
        if (coords && data.lat && data.lng) {
          const dist = distanceKm(coords, { lat: data.lat, lng: data.lng })
          setInsideFence(dist < 0.015) // ~15m threshold for UI hint
        }
      } catch {
        // handle error
      }
      setLoading(false)
    })()
  }, [api, saleId])

  const onSpin = async () => {
    setSpinning(true)
    try {
      const coords = await getCurrentLocation()
      if (!coords) return

      const result = await api.spin(saleId, coords.lat, coords.lng)
      navigation.navigate('Spin', {
        spinResult: result,
        prizes: sale.prizes,
      })
    } catch (err: any) {
      // Navigate to spin screen even on error for UX, or show alert
      const { Alert } = require('react-native')
      Alert.alert('Spin failed', err.message ?? 'Something went wrong')
    } finally {
      setSpinning(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!sale) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Sale not found</Text>
      </View>
    )
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const spinsRemaining = sale.max_spins_total - sale.spins_used

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.bizName}>{sale.businesses?.name ?? 'Restaurant'}</Text>
      <Text style={styles.cuisine}>{sale.businesses?.cuisine ?? ''}</Text>

      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>
          {formatTime(sale.starts_at)} - {formatTime(sale.ends_at)}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: sale.status === 'live' ? colors.success : colors.textMuted }]}>
          <Text style={styles.statusText}>{sale.status}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{spinsRemaining}</Text>
          <Text style={styles.statLabel}>Spins Left</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{sale.prizes?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Prizes</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{sale.radius_m}m</Text>
          <Text style={styles.statLabel}>Radius</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Prizes</Text>
      {sale.prizes?.map((prize: any) => {
        const remaining = prize.max_spins - prize.spins_used
        const exhausted = remaining <= 0
        return (
          <View key={prize.id} style={[styles.prizeCard, exhausted && styles.prizeExhausted]}>
            <View style={styles.prizeInfo}>
              <Text style={[styles.prizeName, exhausted && styles.prizeNameDim]}>
                {prize.name}
              </Text>
              <Text style={styles.prizeType}>
                {prize.type === 'percent' ? `${prize.value}% off` :
                 prize.type === 'amount' ? `$${prize.value} off` :
                 prize.type === 'free' ? 'Free item' :
                 `Free with purchase`}
              </Text>
            </View>
            <View style={styles.prizeCount}>
              <Text style={[styles.prizeRemaining, exhausted && styles.prizeNameDim]}>
                {exhausted ? 'Gone' : `${remaining} left`}
              </Text>
            </View>
          </View>
        )
      })}

      <Pressable
        style={[
          styles.spinButton,
          (!insideFence || sale.status !== 'live' || spinning) && styles.spinButtonDisabled,
        ]}
        onPress={onSpin}
        disabled={sale.status !== 'live' || spinning}
      >
        <Text style={styles.spinButtonText}>
          {spinning ? 'Spinning...' :
           sale.status !== 'live' ? 'Sale Not Live' :
           !insideFence ? 'Get Closer to Spin' :
           'Spin Now!'}
        </Text>
      </Pressable>

      {!insideFence && sale.status === 'live' && (
        <Text style={styles.fenceHint}>
          You can spin from anywhere, but you'll need to arrive within 60 minutes!
        </Text>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.night, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: colors.error, fontSize: 16 },
  backBtn: { marginBottom: 16 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  bizName: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
  cuisine: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  timeLabel: { fontSize: 15, color: colors.textSecondary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, marginBottom: 24 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  prizeCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceDim,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
  },
  prizeExhausted: { opacity: 0.4 },
  prizeInfo: { flex: 1 },
  prizeName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  prizeNameDim: { color: colors.textMuted },
  prizeType: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  prizeCount: { marginLeft: 12 },
  prizeRemaining: { fontSize: 14, fontWeight: '600', color: colors.success },
  spinButton: {
    backgroundColor: colors.primary,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  spinButtonDisabled: { opacity: 0.5 },
  spinButtonText: { color: colors.night, fontSize: 18, fontWeight: '800' },
  fenceHint: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 10 },
})
