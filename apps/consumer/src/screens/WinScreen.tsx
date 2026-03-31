import { useEffect, useState, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, Linking, Platform } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { colors } from '../lib/theme'
import type { MainStackParamList } from '../navigation/RootNavigator'

type RouteProps = NativeStackScreenProps<MainStackParamList, 'Win'>['route']

export function WinScreen() {
  const route = useRoute<RouteProps>()
  const navigation = useNavigation<any>()
  const { spinResult } = route.params

  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = new Date(spinResult.expiresAt).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft('Expired')
        return
      }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [spinResult.expiresAt])

  const onGetDirections = useCallback(() => {
    // Open maps app — in production we'd pass the business lat/lng
    const query = encodeURIComponent('restaurant near me')
    const url = Platform.select({
      ios: `maps:?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://maps.google.com/?q=${query}`,
    })
    Linking.openURL(url!)
  }, [])

  const expired = timeLeft === 'Expired'

  return (
    <View style={styles.container}>
      <Text style={styles.celebrationEmoji}>🎉</Text>
      <Text style={styles.title}>You Won!</Text>
      <Text style={styles.prizeName}>{spinResult.prizeName}</Text>

      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>Your Prize Code</Text>
        <Text style={styles.code}>{spinResult.code}</Text>
        <Text style={styles.codeHint}>Show this to the cashier</Text>
      </View>

      <View style={styles.timerBox}>
        <Text style={styles.timerLabel}>Arrival Window</Text>
        <Text style={[styles.timer, expired && styles.timerExpired]}>{timeLeft}</Text>
        {!expired && (
          <Text style={styles.timerHint}>Get there before time runs out!</Text>
        )}
      </View>

      <Text style={styles.points}>+{spinResult.pointsEarned} points earned</Text>

      <Pressable style={styles.directionsBtn} onPress={onGetDirections}>
        <Text style={styles.directionsBtnText}>Get Directions</Text>
      </Pressable>

      <Pressable
        style={styles.homeBtn}
        onPress={() => navigation.popToTop()}
      >
        <Text style={styles.homeBtnText}>Back to Home</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.night,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  celebrationEmoji: { fontSize: 64, marginBottom: 8 },
  title: { fontSize: 36, fontWeight: '800', color: colors.primary },
  prizeName: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginTop: 8 },
  codeBox: {
    backgroundColor: colors.surfaceDim,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
  },
  codeLabel: { fontSize: 13, color: colors.textSecondary },
  code: { fontSize: 32, fontWeight: '800', color: colors.primary, marginTop: 4, letterSpacing: 4 },
  codeHint: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  timerBox: {
    backgroundColor: colors.surfaceDim,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  timerLabel: { fontSize: 13, color: colors.textSecondary },
  timer: { fontSize: 40, fontWeight: '800', color: colors.success, marginTop: 4 },
  timerExpired: { color: colors.error },
  timerHint: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  points: { fontSize: 16, color: colors.success, fontWeight: '600', marginTop: 16 },
  directionsBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 24,
  },
  directionsBtnText: { color: colors.night, fontSize: 17, fontWeight: '700' },
  homeBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  homeBtnText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
})
