import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Share, ActivityIndicator,
} from 'react-native'
import { useAuth, useUser } from '@clerk/clerk-expo'
import * as WebBrowser from 'expo-web-browser'
import { useApi } from '../lib/api'
import { colors } from '../lib/theme'

export function SettingsScreen() {
  const { signOut } = useAuth()
  const { user: clerkUser } = useUser()
  const api = useApi()

  const [business, setBusiness] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const businesses = await api.myBusinesses()
      if (businesses.length > 0) {
        const biz = businesses[0]
        setBusiness(biz)
        setName(biz.name ?? '')
        setCuisine(biz.cuisine ?? '')
        setAddress(biz.address_line ?? '')
      }
    } catch { /* */ }
  }, [api])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const onSave = useCallback(async () => {
    if (!business) return
    setSaving(true)
    try {
      const updated = await api.updateBusiness(business.id, { name, cuisine, addressLine: address })
      setBusiness({ ...business, ...updated })
      Alert.alert('Saved', 'Business profile updated')
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save')
    } finally { setSaving(false) }
  }, [api, business, name, cuisine, address])

  const onShareReferral = useCallback(async () => {
    if (!business?.referral_code) return
    try {
      await Share.share({
        message: `Join SerendipEatery with my referral code: ${business.referral_code}\n\nhttps://serendip.app/join/${business.referral_code}`,
      })
    } catch { /* cancelled */ }
  }, [business])

  const onManageBilling = useCallback(async () => {
    await WebBrowser.openBrowserAsync('https://serendipeatery.com/billing')
  }, [])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  const planLabels: Record<string, string> = { trial: 'Free Trial', starter: 'Starter', growth: 'Growth', pro: 'Pro' }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Email</Text>
        <Text style={styles.fieldValue}>{clerkUser?.emailAddresses?.[0]?.emailAddress ?? ''}</Text>
      </View>

      <Text style={styles.sectionTitle}>Business Profile</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Business Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.textMuted} />
        <Text style={styles.fieldLabel}>Cuisine</Text>
        <TextInput style={styles.input} value={cuisine} onChangeText={setCuisine} placeholderTextColor={colors.textMuted} />
        <Text style={styles.fieldLabel}>Address</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholderTextColor={colors.textMuted} />
        <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={onSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Billing Plan</Text>
      <View style={styles.card}>
        <View style={styles.planRow}>
          <Text style={styles.planName}>{planLabels[business?.plan] ?? 'Free Trial'}</Text>
          <View style={styles.planBadge}><Text style={styles.planBadgeText}>{business?.plan ?? 'trial'}</Text></View>
        </View>
        {business?.subscription_ends_at && (
          <Text style={styles.planExpiry}>Renews {new Date(business.subscription_ends_at).toLocaleDateString()}</Text>
        )}
        <Pressable style={styles.billingBtn} onPress={onManageBilling}>
          <Text style={styles.billingBtnText}>Manage Billing</Text>
        </Pressable>
        <Text style={styles.billingHint}>Opens in your browser. No in-app payments.</Text>
      </View>

      <Text style={styles.sectionTitle}>Referral Code</Text>
      <View style={styles.card}>
        <Text style={styles.referralCode}>{business?.referral_code ?? 'N/A'}</Text>
        <Text style={styles.referralHint}>Share your code to earn 500 biz points per referral</Text>
        <Pressable style={styles.shareBtn} onPress={onShareReferral}>
          <Text style={styles.shareBtnText}>Share Referral Code</Text>
        </Pressable>
      </View>

      <Pressable style={styles.signOutBtn} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night },
  content: { padding: 20, paddingTop: 60, paddingBottom: 100 },
  center: { flex: 1, backgroundColor: colors.night, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textSecondary, marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: colors.surfaceDim, borderRadius: 14, padding: 16, marginBottom: 4 },
  fieldLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4, marginTop: 8 },
  fieldValue: { fontSize: 16, color: colors.textPrimary },
  input: { backgroundColor: colors.night, color: colors.textPrimary, borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 4 },
  saveBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: colors.night, fontSize: 15, fontWeight: '700' },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  planBadge: { backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  planBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  planExpiry: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  billingBtn: { backgroundColor: colors.accent, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  billingBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  billingHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
  referralCode: { fontSize: 24, fontWeight: '800', color: colors.primary, letterSpacing: 2 },
  referralHint: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  shareBtn: { borderWidth: 1, borderColor: colors.primary, padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  shareBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  signOutBtn: { borderWidth: 1, borderColor: colors.error, padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 24 },
  signOutText: { color: colors.error, fontSize: 16, fontWeight: '600' },
})
