import { useEffect, useState, useRef } from 'react'
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Animated,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useApi } from '../lib/api'
import { colors } from '../lib/theme'
import type { MainStackParamList } from '../navigation/RootNavigator'

type Move = 'rock' | 'paper' | 'scissors'

const MOVE_ICONS: Record<Move, string> = { rock: '✊', paper: '✋', scissors: '✌️' }
const MOVE_LABELS: Record<Move, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' }

const LOOT_AMOUNTS = [25, 50, 75, 100, 125, 150]

type Phase = 'selecting' | 'waiting' | 'revealing' | 'loot' | 'done'

export function BattleArenaScreen() {
  const api = useApi()
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>()
  const route = useRoute<RouteProp<MainStackParamList, 'BattleArena'>>()
  const { battleId } = route.params

  const [phase, setPhase] = useState<Phase>('selecting')
  const [myMoves, setMyMoves] = useState<Move[]>([])
  const [battle, setBattle] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [lootResult, setLootResult] = useState<any>(null)
  const [revealIndex, setRevealIndex] = useState(-1)
  const [lootSpinning, setLootSpinning] = useState(false)
  const lootRotation = useRef(new Animated.Value(0)).current

  // Load battle state
  useEffect(() => {
    api.getBattle(battleId).then((data) => {
      setBattle(data.battle)
      if (data.battle.status === 'completed') {
        setResult(data)
        setPhase('revealing')
      }
    }).catch(() => {})
  }, [battleId])

  // Poll while waiting for opponent
  useEffect(() => {
    if (phase !== 'waiting') return
    const interval = setInterval(async () => {
      try {
        const data = await api.getBattle(battleId)
        if (data.battle.status === 'completed') {
          setBattle(data.battle)
          setResult(data)
          setPhase('revealing')
          clearInterval(interval)
        }
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [phase, battleId])

  // Animate round reveals
  useEffect(() => {
    if (phase !== 'revealing' || !result?.rounds) return
    let i = 0
    const timer = setInterval(() => {
      setRevealIndex(i)
      i++
      if (i >= result.rounds.length) {
        clearInterval(timer)
        setTimeout(() => {
          if (result.battle?.winner_id) setPhase('loot')
          else setPhase('done')
        }, 1500)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [phase, result])

  const addMove = (move: Move) => {
    if (myMoves.length >= 3) return
    setMyMoves([...myMoves, move])
  }

  const submitMoves = async () => {
    try {
      const data = await api.submitMoves(battleId, myMoves)
      if (data.result) {
        setBattle(data.battle)
        setResult(data)
        setPhase('revealing')
      } else {
        setPhase('waiting')
      }
    } catch {}
  }

  const spinLoot = async () => {
    setLootSpinning(true)
    Animated.timing(lootRotation, {
      toValue: 5 + Math.random() * 3,
      duration: 3000,
      useNativeDriver: true,
    }).start()

    try {
      const data = await api.claimLoot(battleId, 'points')
      setTimeout(() => {
        setLootResult(data)
        setLootSpinning(false)
        setPhase('done')
      }, 3000)
    } catch {
      setLootSpinning(false)
      setPhase('done')
    }
  }

  const isWinner = battle?.winner_id && result?.battle?.winner_id === battle?.challenger_id
    // This is simplified — real check would compare against current user ID

  return (
    <View style={styles.container}>
      {/* Player avatars */}
      <View style={styles.players}>
        <View style={styles.playerCard}>
          <View style={[styles.playerAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.playerAvatarText}>Y</Text>
          </View>
          <Text style={styles.playerName}>You</Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={styles.playerCard}>
          <View style={[styles.playerAvatar, { backgroundColor: colors.accent }]}>
            <Text style={styles.playerAvatarText}>?</Text>
          </View>
          <Text style={styles.playerName}>Opponent</Text>
        </View>
      </View>

      {/* Move selection phase */}
      {phase === 'selecting' && (
        <View style={styles.selectSection}>
          <Text style={styles.selectTitle}>Choose 3 moves</Text>

          {/* Move dots */}
          <View style={styles.dotsRow}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[styles.dot, myMoves[i] ? styles.dotFilled : styles.dotEmpty]}
              >
                {myMoves[i] && <Text style={styles.dotIcon}>{MOVE_ICONS[myMoves[i]]}</Text>}
              </View>
            ))}
          </View>

          {/* Move buttons */}
          <View style={styles.movesRow}>
            {(['rock', 'paper', 'scissors'] as Move[]).map((move) => (
              <Pressable
                key={move}
                style={[styles.moveBtn, myMoves.length >= 3 && styles.moveBtnDisabled]}
                onPress={() => addMove(move)}
                disabled={myMoves.length >= 3}
              >
                <Text style={styles.moveIcon}>{MOVE_ICONS[move]}</Text>
                <Text style={styles.moveLabel}>{MOVE_LABELS[move]}</Text>
              </Pressable>
            ))}
          </View>

          {myMoves.length > 0 && myMoves.length < 3 && (
            <Pressable onPress={() => setMyMoves([])} style={styles.resetBtn}>
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          )}

          {myMoves.length === 3 && (
            <Pressable style={styles.readyBtn} onPress={submitMoves}>
              <Text style={styles.readyText}>Ready!</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Waiting phase */}
      {phase === 'waiting' && (
        <View style={styles.waitSection}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.waitText}>Waiting for opponent...</Text>
          <Text style={styles.waitSubtext}>They're choosing their moves</Text>
        </View>
      )}

      {/* Reveal phase */}
      {phase === 'revealing' && result?.rounds && (
        <View style={styles.revealSection}>
          <Text style={styles.revealTitle}>Battle Results</Text>
          {result.rounds.map((round: any, i: number) => (
            <View
              key={i}
              style={[styles.roundRow, i <= revealIndex ? styles.roundVisible : styles.roundHidden]}
            >
              <Text style={styles.roundNum}>R{round.round}</Text>
              <Text style={styles.roundMove}>{MOVE_ICONS[round.challengerMove as Move]}</Text>
              <Text style={styles.roundVs}>vs</Text>
              <Text style={styles.roundMove}>{MOVE_ICONS[round.defenderMove as Move]}</Text>
              <Text style={[
                styles.roundResult,
                { color: round.winnerId ? colors.success : colors.textMuted },
              ]}>
                {round.winnerId ? (round.winnerId === battle?.challenger_id ? 'W' : 'L') : '—'}
              </Text>
            </View>
          ))}
          {revealIndex >= result.rounds.length - 1 && result.battle?.winner_id && (
            <Text style={styles.winnerText}>
              {result.battle.winner_id === battle?.challenger_id ? 'You Win!' : 'You Lose'}
            </Text>
          )}
        </View>
      )}

      {/* Loot phase */}
      {phase === 'loot' && (
        <View style={styles.lootSection}>
          <Text style={styles.lootTitle}>Spin for Loot!</Text>
          <View style={styles.lootWheel}>
            {LOOT_AMOUNTS.map((amt, i) => (
              <View key={amt} style={[styles.lootSlice, { transform: [{ rotate: `${i * 60}deg` }] }]}>
                <Text style={styles.lootSliceText}>{amt}</Text>
              </View>
            ))}
          </View>
          {!lootSpinning && !lootResult && (
            <Pressable style={styles.readyBtn} onPress={spinLoot}>
              <Text style={styles.readyText}>Spin Loot Wheel</Text>
            </Pressable>
          )}
          {lootSpinning && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />}
          {lootResult && (
            <Text style={styles.lootAmount}>+{lootResult.amount} points!</Text>
          )}
        </View>
      )}

      {/* Done phase */}
      {phase === 'done' && (
        <View style={styles.doneSection}>
          {lootResult && (
            <Text style={styles.lootAmount}>+{lootResult.amount} points!</Text>
          )}
          <View style={styles.doneButtons}>
            <Pressable
              style={styles.rematchBtn}
              onPress={() => {
                setMyMoves([])
                setResult(null)
                setLootResult(null)
                setRevealIndex(-1)
                setPhase('selecting')
              }}
            >
              <Text style={styles.rematchText}>Rematch</Text>
            </Pressable>
            <Pressable style={styles.doneBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night, paddingTop: 60 },
  // Players
  players: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 24, paddingVertical: 20,
  },
  playerCard: { alignItems: 'center', gap: 6 },
  playerAvatar: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
  },
  playerAvatarText: { color: colors.night, fontSize: 24, fontWeight: '900' },
  playerName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  vs: { color: colors.primary, fontSize: 24, fontWeight: '900' },
  // Selection
  selectSection: { alignItems: 'center', paddingTop: 20 },
  selectTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 20 },
  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  dot: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  dotEmpty: { borderWidth: 2, borderColor: colors.textMuted, borderStyle: 'dashed' },
  dotFilled: { backgroundColor: colors.surfaceDim, borderWidth: 2, borderColor: colors.primary },
  dotIcon: { fontSize: 24 },
  movesRow: { flexDirection: 'row', gap: 20 },
  moveBtn: {
    backgroundColor: colors.surfaceDim, width: 90, height: 100, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderColor: 'rgba(247,148,29,0.2)',
  },
  moveBtnDisabled: { opacity: 0.4 },
  moveIcon: { fontSize: 36 },
  moveLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  resetBtn: { marginTop: 16 },
  resetText: { color: colors.error, fontSize: 14, fontWeight: '600' },
  readyBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 40, paddingVertical: 14,
    borderRadius: 28, marginTop: 24,
  },
  readyText: { color: colors.night, fontSize: 18, fontWeight: '800' },
  // Waiting
  waitSection: { alignItems: 'center', paddingTop: 60, gap: 16 },
  waitText: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  waitSubtext: { color: colors.textMuted, fontSize: 14 },
  // Reveal
  revealSection: { alignItems: 'center', paddingTop: 20 },
  revealTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 20 },
  roundRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 20,
  },
  roundVisible: { opacity: 1 },
  roundHidden: { opacity: 0 },
  roundNum: { color: colors.textMuted, fontSize: 14, fontWeight: '700', width: 28 },
  roundMove: { fontSize: 32 },
  roundVs: { color: colors.textMuted, fontSize: 14 },
  roundResult: { fontSize: 18, fontWeight: '900', width: 24, textAlign: 'center' },
  winnerText: {
    color: colors.primary, fontSize: 32, fontWeight: '900', marginTop: 20,
  },
  // Loot
  lootSection: { alignItems: 'center', paddingTop: 30 },
  lootTitle: { color: colors.primary, fontSize: 24, fontWeight: '900', marginBottom: 20 },
  lootWheel: {
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: colors.surfaceDim, borderWidth: 3, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  lootSlice: { position: 'absolute' },
  lootSliceText: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  lootAmount: { color: colors.success, fontSize: 36, fontWeight: '900', marginTop: 20 },
  // Done
  doneSection: { alignItems: 'center', paddingTop: 40 },
  doneButtons: { flexDirection: 'row', gap: 16, marginTop: 30 },
  rematchBtn: {
    borderWidth: 2, borderColor: colors.primary,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24,
  },
  rematchText: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  doneBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24,
  },
  doneText: { color: colors.night, fontSize: 16, fontWeight: '800' },
})
