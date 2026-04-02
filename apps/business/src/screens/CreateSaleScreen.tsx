import { useState, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, Pressable, Switch, StyleSheet, Alert,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useApi } from '../lib/api'
import { colors } from '../lib/theme'
import type { MainStackParamList } from '../navigation/RootNavigator'

type RouteProps = NativeStackScreenProps<MainStackParamList, 'CreateSale'>['route']

interface PrizeInput {
  name: string
  type: 'percent' | 'amount' | 'free' | 'free_with'
  value: string
  maxSpins: string
  isLongTerm: boolean
}

export function CreateSaleScreen() {
  const route = useRoute<RouteProps>()
  const navigation = useNavigation<any>()
  const api = useApi()
  const { businessId } = route.params

  const [durationMin, setDurationMin] = useState('60')
  const [radiusM, setRadiusM] = useState('500')
  const [maxSpinsTotal, setMaxSpinsTotal] = useState('100')
  const [prizes, setPrizes] = useState<PrizeInput[]>([
    { name: '', type: 'percent', value: '', maxSpins: '', isLongTerm: false },
  ])
  const [submitting, setSubmitting] = useState(false)

  const addPrize = () => {
    setPrizes([...prizes, { name: '', type: 'percent', value: '', maxSpins: '', isLongTerm: false }])
  }

  const updatePrize = (index: number, field: keyof PrizeInput, value: string) => {
    const updated = [...prizes]
    if (field === 'isLongTerm') {
      updated[index] = { ...updated[index], isLongTerm: value === 'true' }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setPrizes(updated)
  }

  const removePrize = (index: number) => {
    if (prizes.length <= 1) return
    setPrizes(prizes.filter((_, i) => i !== index))
  }

  const onSubmit = useCallback(async () => {
    const validPrizes = prizes.filter((p) => p.name && p.value && p.maxSpins)
    if (validPrizes.length === 0) {
      Alert.alert('Error', 'Add at least one prize')
      return
    }

    setSubmitting(true)
    try {
      const now = new Date()
      const endsAt = new Date(now.getTime() + Number(durationMin) * 60 * 1000)

      await api.createSale({
        businessId,
        startsAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        radiusM: Number(radiusM),
        maxSpinsTotal: Number(maxSpinsTotal),
        prizes: validPrizes.map((p) => ({
          name: p.name,
          type: p.type,
          value: Number(p.value),
          maxSpins: Number(p.maxSpins),
          isLongTermCoupon: p.isLongTerm,
        })),
      })

      Alert.alert('Success', 'Flash sale created!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
    } catch (err: any) {
      Alert.alert('Failed', err.message ?? 'Could not create sale')
    } finally {
      setSubmitting(false)
    }
  }, [api, businessId, durationMin, radiusM, maxSpinsTotal, prizes, navigation])

  const prizeTypes: Array<{ label: string; value: PrizeInput['type'] }> = [
    { label: '% Off', value: 'percent' },
    { label: '$ Off', value: 'amount' },
    { label: 'Free', value: 'free' },
    { label: 'Free w/', value: 'free_with' },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>Cancel</Text>
      </Pressable>

      <Text style={styles.title}>Create Flash Sale</Text>

      <Text style={styles.label}>Duration (minutes)</Text>
      <TextInput style={styles.input} value={durationMin} onChangeText={setDurationMin} keyboardType="numeric" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Notification Radius (meters)</Text>
      <TextInput style={styles.input} value={radiusM} onChangeText={setRadiusM} keyboardType="numeric" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Max Total Spins</Text>
      <TextInput style={styles.input} value={maxSpinsTotal} onChangeText={setMaxSpinsTotal} keyboardType="numeric" placeholderTextColor={colors.textMuted} />

      <Text style={styles.sectionTitle}>Prizes</Text>

      {prizes.map((prize, index) => (
        <View key={index} style={styles.prizeCard}>
          <View style={styles.prizeHeader}>
            <Text style={styles.prizeNum}>Prize {index + 1}</Text>
            {prizes.length > 1 && (
              <Pressable onPress={() => removePrize(index)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            )}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Prize name (e.g. 20% off tacos)"
            placeholderTextColor={colors.textMuted}
            value={prize.name}
            onChangeText={(v) => updatePrize(index, 'name', v)}
          />

          <View style={styles.typeRow}>
            {prizeTypes.map((pt) => (
              <Pressable
                key={pt.value}
                style={[styles.typeBtn, prize.type === pt.value && styles.typeBtnActive]}
                onPress={() => updatePrize(index, 'type', pt.value)}
              >
                <Text style={[styles.typeBtnText, prize.type === pt.value && styles.typeBtnTextActive]}>
                  {pt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Long-term coupon toggle */}
          <View style={styles.longTermRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.longTermLabel}>Long-term coupon (valid 1 year)</Text>
              <Text style={styles.longTermHint}>Stored in user wallet — builds loyalty</Text>
            </View>
            <Switch
              value={prize.isLongTerm}
              onValueChange={(v) => updatePrize(index, 'isLongTerm', v ? 'true' : '')}
              trackColor={{ false: '#333', true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.prizeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniLabel}>Value</Text>
              <TextInput
                style={styles.input}
                placeholder={prize.type === 'percent' ? '20' : '5.00'}
                placeholderTextColor={colors.textMuted}
                value={prize.value}
                onChangeText={(v) => updatePrize(index, 'value', v)}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniLabel}>Max Spins</Text>
              <TextInput
                style={styles.input}
                placeholder="50"
                placeholderTextColor={colors.textMuted}
                value={prize.maxSpins}
                onChangeText={(v) => updatePrize(index, 'maxSpins', v)}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>
      ))}

      <Pressable style={styles.addPrizeBtn} onPress={addPrize}>
        <Text style={styles.addPrizeText}>+ Add Prize</Text>
      </Pressable>

      <Pressable
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={onSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitText}>{submitting ? 'Creating...' : 'Launch Flash Sale'}</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  backBtn: { marginBottom: 12 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
  miniLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  input: { backgroundColor: colors.surfaceDim, color: colors.textPrimary, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 20, marginBottom: 10 },
  prizeCard: { backgroundColor: colors.surfaceDim, borderRadius: 14, padding: 14, marginBottom: 12 },
  prizeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  prizeNum: { fontSize: 14, fontWeight: '700', color: colors.primary },
  removeText: { fontSize: 13, color: colors.error, fontWeight: '600' },
  typeRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.textMuted },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeBtnText: { fontSize: 13, color: colors.textSecondary },
  typeBtnTextActive: { color: colors.night, fontWeight: '700' },
  longTermRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, paddingVertical: 4 },
  longTermLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  longTermHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  prizeRow: { flexDirection: 'row', gap: 10 },
  addPrizeBtn: { borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 },
  addPrizeText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  submitBtn: { backgroundColor: colors.primary, padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: colors.night, fontSize: 18, fontWeight: '800' },
})
