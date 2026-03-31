import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated'
import { colors } from '../lib/theme'
import type { MainStackParamList } from '../navigation/RootNavigator'

type RouteProps = NativeStackScreenProps<MainStackParamList, 'Spin'>['route']

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const WHEEL_SIZE = SCREEN_WIDTH * 0.75
const SLOT_COUNT = 12 // visual segments on the wheel

export function SpinScreen() {
  const route = useRoute<RouteProps>()
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const { spinResult, prizes } = route.params
  const [showResult, setShowResult] = useState(false)

  const rotation = useSharedValue(0)

  // Build wheel segments from prizes
  const segments = buildSegments(prizes, SLOT_COUNT)

  useEffect(() => {
    // Calculate target angle based on animationSeed
    const slotIndex = spinResult.animationSeed % SLOT_COUNT
    const degreesPerSlot = 360 / SLOT_COUNT
    // Land in the middle of the winning slot
    const targetSlotAngle = slotIndex * degreesPerSlot + degreesPerSlot / 2
    // Spin multiple full rotations + land on target
    const fullSpins = 5 * 360
    const targetAngle = fullSpins + (360 - targetSlotAngle)

    rotation.value = withSequence(
      // Quick start
      withTiming(360, { duration: 400, easing: Easing.in(Easing.quad) }),
      // Main spin with deceleration
      withTiming(targetAngle, {
        duration: 3500,
        easing: Easing.out(Easing.cubic),
      }),
    )

    // Show result after animation
    const timer = setTimeout(() => {
      setShowResult(true)
      // Navigate to win screen after brief celebration
      setTimeout(() => {
        navigation.replace('Win', { spinResult })
      }, 1500)
    }, 4200)

    return () => clearTimeout(timer)
  }, [spinResult, navigation, rotation])

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spinning...</Text>

      <View style={styles.wheelContainer}>
        {/* Pointer */}
        <View style={styles.pointer}>
          <View style={styles.pointerTriangle} />
        </View>

        {/* Wheel */}
        <Animated.View style={[styles.wheel, wheelStyle]}>
          {segments.map((seg, i) => {
            const angle = (i * 360) / SLOT_COUNT
            return (
              <View
                key={i}
                style={[
                  styles.segment,
                  {
                    transform: [
                      { rotate: `${angle}deg` },
                      { translateY: -WHEEL_SIZE / 2 },
                    ],
                    backgroundColor: seg.color,
                  },
                ]}
              >
                <Text style={styles.segmentText} numberOfLines={1}>
                  {seg.label}
                </Text>
              </View>
            )
          })}
        </Animated.View>
      </View>

      {showResult && (
        <Animated.View style={styles.resultOverlay}>
          <Text style={styles.winText}>You won!</Text>
          <Text style={styles.prizeName}>{spinResult.prizeName}</Text>
          <Text style={styles.points}>+{spinResult.pointsEarned} pts</Text>
        </Animated.View>
      )}
    </View>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const SEGMENT_COLORS = [
  '#F7941D', '#534AB7', '#1D9E75', '#E53E3E',
  '#F7941D', '#534AB7', '#1D9E75', '#E53E3E',
  '#F7941D', '#534AB7', '#1D9E75', '#E53E3E',
]

function buildSegments(prizes: any[], count: number) {
  const segments: Array<{ label: string; color: string }> = []
  if (!prizes || prizes.length === 0) {
    for (let i = 0; i < count; i++) {
      segments.push({ label: '?', color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] })
    }
    return segments
  }

  // Distribute prizes across slots
  for (let i = 0; i < count; i++) {
    const prize = prizes[i % prizes.length]
    segments.push({
      label: prize.name ?? '?',
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    })
  }
  return segments
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.night,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginBottom: 30 },
  wheelContainer: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointer: {
    position: 'absolute',
    top: -15,
    zIndex: 10,
    alignItems: 'center',
  },
  pointerTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primary,
  },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    backgroundColor: colors.surfaceDim,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    position: 'absolute',
    width: WHEEL_SIZE * 0.45,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    left: WHEEL_SIZE / 2 - (WHEEL_SIZE * 0.45) / 2,
    top: WHEEL_SIZE / 2 - 15,
    transformOrigin: 'center center',
  },
  segmentText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  resultOverlay: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
  },
  winText: { fontSize: 32, fontWeight: '800', color: colors.primary },
  prizeName: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginTop: 8 },
  points: { fontSize: 16, color: colors.success, fontWeight: '600', marginTop: 4 },
})
