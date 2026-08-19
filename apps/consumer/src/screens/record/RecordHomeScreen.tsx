import { useCallback, useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as WebBrowser from 'expo-web-browser'
import { useApi } from '../../lib/api'
import { useRecordGate } from '../../lib/recordGate'
import { colors } from '../../lib/theme'
import type { RecordStackParamList } from '../../navigation/RootNavigator'

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:3000'

export function RecordHomeScreen() {
  const api = useApi()
  const { userId } = useAuth()
  const { user } = useUser()
  const { gate, refresh } = useRecordGate()
  const navigation = useNavigation<NativeStackNavigationProp<RecordStackParamList>>()

  const [name, setName] = useState(user?.fullName ?? '')
  const [email, setEmail] = useState(user?.primaryEmailAddress?.emailAddress ?? '')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [consent, setConsent] = useState(false)
  const [smsConsent, setSmsConsent] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const attempt = gate.attempt
  const participant = gate.participant
  const verified = Boolean(participant?.phone_verified_at)
  const count = attempt?.registrationCount ?? 0
  const target = attempt?.auto_start_threshold ?? attempt?.target_participants ?? 50000
  const progress = Math.min(100, (count / target) * 100)

  const register = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !consent || !smsConsent || !ageConfirmed) return
    setBusy(true)
    setError('')
    try {
      await api.recordRegister({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        consentGiven: consent,
        smsConsent,
        ageConfirmed,
        userId: userId ?? undefined,
      })
      await api.recordSendOtp(phone.trim())
      setOtpSent(true)
      await refresh()
    } catch (err: any) {
      setError(err.message ?? 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    if (!code.trim()) return
    setBusy(true)
    setError('')
    try {
      await api.recordVerifyOtp(phone.trim() || participant?.phone_e164, code.trim())
      await refresh()
    } catch (err: any) {
      setError(err.message ?? 'Could not verify code')
    } finally {
      setBusy(false)
    }
  }

  const play = async () => {
    setStarting(true)
    setError('')
    try {
      const { battleId } = await api.recordStartMatch()
      navigation.navigate('BattleArena', { battleId })
    } catch (err: any) {
      setError(err.message ?? 'Match is not ready yet')
    } finally {
      setStarting(false)
    }
  }

  useFocusEffect(useCallback(() => {
    ;(async () => {
      try { await api.recordSyncMatch() } catch { /* no live match */ }
      await refresh()
    })()
  }, [api, refresh]))

  const match = gate.currentMatch
  const opponentName = match
    ? (match.player1_id === participant?.id ? match.player2_name : match.player1_name)
    : null

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>GUINNESS WORLD RECORD ATTEMPT</Text>
        <Text style={styles.title}>{attempt?.record_name ?? 'Rock · Paper · Scissors'}</Text>
        <Text style={styles.sub}>
          Single elimination. First to two. You will get a text when you are up.
        </Text>

        <View style={styles.counter}>
          <Text style={styles.count}>{Number(count).toLocaleString()}</Text>
          <Text style={styles.countLabel}>verified players</Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.target}>Target {Number(target).toLocaleString()}</Text>
        </View>

        {gate.lockReason === 'alive' && match && (
          <View style={styles.card}>
            <Text style={styles.cardKicker}>ROUND {match.round}</Text>
            <Text style={styles.cardTitle}>vs {opponentName || 'Opponent'}</Text>
            {match.deadline_at && (
              <Text style={styles.cardMeta}>
                Lock your throws by {new Date(match.deadline_at).toLocaleString()}
              </Text>
            )}
            <Pressable style={styles.primary} onPress={play} disabled={starting}>
              {starting ? <ActivityIndicator color={colors.night} /> : <Text style={styles.primaryText}>Lock your throws</Text>}
            </Pressable>
          </View>
        )}

        {gate.lockReason === 'waiting' && verified && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>You're in.</Text>
            <Text style={styles.cardMeta}>
              The official tournament starts by itself at {Number(target).toLocaleString()} verified players. We'll text you when round 1 is live.
            </Text>
            <Text style={[styles.cardTitle, { fontSize: 18, marginTop: 8 }]}>While you wait — settle tonight.</Text>
            <Text style={styles.cardMeta}>
              Invite friends. Winner picks dinner, the movie, who pays. Same first-to-two bracket we'll use for the record.
            </Text>
            <Pressable style={styles.primary} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/tournament`)}>
              <Text style={styles.primaryText}>Create a friend tournament</Text>
            </Pressable>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/tournament`)}>
              <Text style={styles.link}>Have a code? Join one</Text>
            </Pressable>
          </View>
        )}

        {participant && !verified && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Verify your phone</Text>
            <Text style={styles.cardMeta}>Unverified numbers are dropped at freeze and do not count.</Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
            />
            <Pressable style={styles.primary} onPress={verify} disabled={busy}>
              <Text style={styles.primaryText}>{busy ? 'Checking…' : 'Verify'}</Text>
            </Pressable>
            <Pressable onPress={() => api.recordSendOtp(phone || participant.phone_e164).catch(() => {})}>
              <Text style={styles.link}>Resend code</Text>
            </Pressable>
          </View>
        )}

        {!participant && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Register to play</Text>
            <TextInput style={styles.input} placeholder="Legal name (for the official record)" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Mobile number" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

            <Pressable style={styles.checkRow} onPress={() => setAgeConfirmed((v) => !v)}>
              <Text style={styles.check}>{ageConfirmed ? '☑' : '☐'}</Text>
              <Text style={styles.checkLabel}>I am {attempt?.min_age ?? 13} or older</Text>
            </Pressable>
            <Pressable style={styles.checkRow} onPress={() => setConsent((v) => !v)}>
              <Text style={styles.check}>{consent ? '☑' : '☐'}</Text>
              <Text style={styles.checkLabel}>List my name on the official Guinness roster</Text>
            </Pressable>
            <Pressable style={styles.checkRow} onPress={() => setSmsConsent((v) => !v)}>
              <Text style={styles.check}>{smsConsent ? '☑' : '☐'}</Text>
              <Text style={styles.checkLabel}>Text me when I am up (required)</Text>
            </Pressable>

            <Pressable
              style={styles.primary}
              onPress={register}
              disabled={busy || !name.trim() || !email.trim() || !phone.trim() || !consent || !smsConsent || !ageConfirmed}
            >
              <Text style={styles.primaryText}>{busy ? 'Registering…' : otpSent ? 'Code sent' : 'Register'}</Text>
            </Pressable>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {error?.includes('Match') ? (
          <Pressable onPress={() => Alert.alert('Not yet', 'Your match is not live. We will text you.')}>
            <Text style={styles.link}>Why can't I play?</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.night },
  container: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  kicker: { color: colors.primary, fontWeight: '700', letterSpacing: 2, fontSize: 12, marginBottom: 8 },
  title: { color: colors.surface, fontWeight: '900', fontSize: 28, marginBottom: 8 },
  sub: { color: colors.textSecondary, fontSize: 14, marginBottom: 24, lineHeight: 20 },
  counter: { marginBottom: 24 },
  count: { color: colors.primary, fontWeight: '900', fontSize: 48 },
  countLabel: { color: colors.textMuted, marginBottom: 8 },
  bar: { height: 8, borderRadius: 99, backgroundColor: colors.surfaceDim, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: colors.primary },
  target: { color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: 'right' },
  card: { backgroundColor: colors.surfaceDim, borderRadius: 20, padding: 20, marginBottom: 16 },
  cardKicker: { color: colors.primary, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  cardTitle: { color: colors.surface, fontWeight: '800', fontSize: 22, marginBottom: 8 },
  cardMeta: { color: colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  input: {
    backgroundColor: colors.night, color: colors.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(247,148,29,0.2)',
  },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  check: { color: colors.primary, fontSize: 18, width: 22 },
  checkLabel: { color: colors.textSecondary, flex: 1, fontSize: 13, lineHeight: 18 },
  primary: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  primaryText: { color: colors.night, fontWeight: '800', fontSize: 16 },
  link: { color: colors.primary, textAlign: 'center', marginTop: 12, fontWeight: '700' },
  error: { color: colors.error, marginTop: 8, textAlign: 'center' },
})
