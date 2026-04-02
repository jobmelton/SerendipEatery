import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, FlatList, Pressable, Switch, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useApi } from '../lib/api'
import { getCurrentLocation, type Coords } from '../lib/location'
import {
  startScanning, stopScanning, onScanStateChange, touchActivity,
  type ScanState, type NearbyPlayer,
} from '../lib/bluetooth'
import { colors } from '../lib/theme'
import type { MainStackParamList } from '../navigation/RootNavigator'

interface NearbyUser {
  clerk_id: string
  display_name: string
  consumer_tier: string
  distanceM: number
}

const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
}

const GPS_REFRESH_MS = 60_000

export function BattleScreen() {
  const api = useApi()
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const [battleMode, setBattleMode] = useState(true)
  const [users, setUsers] = useState<NearbyUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [challenging, setChallenging] = useState<string | null>(null)
  const [location, setLocation] = useState<Coords | null>(null)
  const [scanState, setScanState] = useState<ScanState>('off')
  const gpsTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── GPS fallback: coarse location, 60s interval ─────────────────
  const loadNearbyGPS = useCallback(async (coords: Coords) => {
    try {
      const data = await api.battlesNearby(coords.lat, coords.lng)
      setUsers(data)
    } catch {
      setUsers([])
    }
  }, [api])

  const refreshGPS = useCallback(async () => {
    const coords = await getCurrentLocation() // uses Accuracy.Balanced via location.ts
    if (coords) {
      setLocation(coords)
      await loadNearbyGPS(coords)
    }
  }, [loadNearbyGPS])

  // ─── Battle mode toggle ───────────────────────────────────────────
  useEffect(() => {
    if (!battleMode) {
      stopScanning()
      if (gpsTimer.current) { clearInterval(gpsTimer.current); gpsTimer.current = null }
      setUsers([])
      setLoading(false)
      return
    }

    // Start BLE duty-cycle scanning
    startScanning((_blePlayers: NearbyPlayer[]) => {
      // BLE results are supplementary — primary discovery is GPS API
      // We merge BLE-detected players with GPS results in a future iteration
      touchActivity()
    })

    // GPS fallback: load immediately, then every 60s
    setLoading(true)
    refreshGPS().finally(() => setLoading(false))
    gpsTimer.current = setInterval(refreshGPS, GPS_REFRESH_MS)

    return () => {
      stopScanning()
      if (gpsTimer.current) { clearInterval(gpsTimer.current); gpsTimer.current = null }
    }
  }, [battleMode, refreshGPS])

  // ─── Scan state indicator ─────────────────────────────────────────
  useEffect(() => {
    const unsub = onScanStateChange(setScanState)
    return unsub
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    touchActivity()
    await refreshGPS()
    setRefreshing(false)
  }, [refreshGPS])

  const handleChallenge = async (defenderId: string) => {
    setChallenging(defenderId)
    touchActivity()
    try {
      const battle = await api.challengeUser(defenderId, location?.lat, location?.lng)
      navigation.navigate('BattleArena', { battleId: battle.id })
    } catch {
      // TODO: show error toast
    }
    setChallenging(null)
  }

  const formatDistance = (m: number) => {
    if (m < 1000) return `${m}m away`
    return `${(m / 1000).toFixed(1)}km away`
  }

  const renderUser = ({ item }: { item: NearbyUser }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.display_name || '?')[0].toUpperCase()}
          </Text>
        </View>
        <View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.display_name || 'Anonymous'}</Text>
            {item.consumer_tier && (
              <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[item.consumer_tier] || colors.primary }]}>
                <Text style={styles.tierText}>{item.consumer_tier}</Text>
              </View>
            )}
          </View>
          <Text style={styles.distance}>{formatDistance(item.distanceM)}</Text>
        </View>
      </View>
      <Pressable
        style={[styles.challengeBtn, challenging === item.clerk_id && styles.challengeBtnDisabled]}
        onPress={() => handleChallenge(item.clerk_id)}
        disabled={challenging === item.clerk_id}
      >
        <Text style={styles.challengeText}>
          {challenging === item.clerk_id ? '...' : 'Challenge'}
        </Text>
      </Pressable>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Battle</Text>
          {/* Scanning indicator */}
          {battleMode && scanState !== 'off' && (
            <View style={styles.scanIndicator}>
              <View style={[styles.scanDot, scanState === 'scanning' && styles.scanDotActive]} />
              <Text style={styles.scanLabel}>
                {scanState === 'scanning' ? 'Scanning...' : 'Listening'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Battle Mode</Text>
          <Switch
            value={battleMode}
            onValueChange={setBattleMode}
            trackColor={{ false: '#333', true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {!battleMode ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🛡️</Text>
          <Text style={styles.emptyText}>Battle mode is off</Text>
          <Text style={styles.emptySubtext}>Turn it on to find nearby challengers</Text>
        </View>
      ) : loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptySubtext}>Scanning for players...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.clerk_id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👀</Text>
              <Text style={styles.emptyText}>No players nearby</Text>
              <Text style={styles.emptySubtext}>Pull to refresh or try a different spot</Text>
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
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '900', color: colors.textPrimary },
  scanIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  scanDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted,
  },
  scanDotActive: { backgroundColor: colors.success },
  scanLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  toggleLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  list: { padding: 16 },
  card: {
    backgroundColor: colors.surfaceDim, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.night, fontSize: 18, fontWeight: '900' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  tierBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  tierText: { fontSize: 10, fontWeight: '800', color: '#000', textTransform: 'uppercase' },
  distance: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  challengeBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  challengeBtnDisabled: { opacity: 0.5 },
  challengeText: { color: colors.night, fontSize: 14, fontWeight: '800' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
})
