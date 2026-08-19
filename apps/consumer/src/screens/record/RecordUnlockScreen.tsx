import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useApi } from '../../lib/api'
import { useRecordGate } from '../../lib/recordGate'
import { colors } from '../../lib/theme'

export function RecordUnlockScreen() {
  const api = useApi()
  const { gate, refresh } = useRecordGate()
  const champion = gate.lockReason === 'champion' || gate.participant?.status === 'champion'

  const open = async () => {
    try { await api.recordUnlockSeen() } catch { /* still unlock locally */ }
    await refresh()
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{champion ? '👑' : '✌️'}</Text>
      <Text style={styles.kicker}>{champion ? 'CHAMPION' : 'ELIMINATED'}</Text>
      <Text style={styles.title}>You fought.{'\n'}Now eat.</Text>
      <Text style={styles.body}>
        {champion
          ? 'You are the last player standing. The rest of SerendipEatery is unlocked — spin for deals from local eateries.'
          : 'You are out of the bracket. You still count for the record. Unlock spins and flash deals from local eateries — the app is already on your phone.'}
      </Text>
      <Pressable style={styles.primary} onPress={open}>
        <Text style={styles.primaryText}>Unlock SerendipEatery</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.night, padding: 28, justifyContent: 'center',
  },
  emoji: { fontSize: 56, marginBottom: 12 },
  kicker: { color: colors.primary, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  title: { color: colors.surface, fontWeight: '900', fontSize: 40, lineHeight: 44, marginBottom: 16 },
  body: { color: colors.textSecondary, fontSize: 16, lineHeight: 24, marginBottom: 32 },
  primary: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: colors.night, fontWeight: '800', fontSize: 16 },
})
