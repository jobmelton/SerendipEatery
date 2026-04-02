import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, Pressable, Switch, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useApi } from '../lib/api'
import { getCurrentLocation, type Coords } from '../lib/location'
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

export function BattleScreen() {
  const api = useApi()
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const [battleMode, setBattleMode] = useState(true)
  const [users, setUsers] = useState<NearbyUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [challenging, setChallenging] = useState<string | null>(null)
  const [location, setLocation] = useState<Coords | null>(null)

  const loadNearby = useCallback(async (coords: Coords) => {
    try {
      const data = await api.battlesNearby(coords.lat, coords.lng)
      setUsers(data)
    } catch {
      setUsers([])
    }
  }, [api])

  useEffect(() => {
    ;(async () => {
      const coords = await getCurrentLocation()
      if (coords) {
        setLocation(coords)
        await loadNearby(coords)
      }
      setLoading(false)
    })()
  }, [loadNearby])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    const coords = await getCurrentLocation()
    if (coords) {
      setLocation(coords)
      await loadNearby(coords)
    }
    setRefreshing(false)
  }, [loadNearby])

  const handleChallenge = async (defenderId: string) => {
    setChallenging(defenderId)
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
        <Text style={styles.title}>Battle</Text>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '900', color: colors.textPrimary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
