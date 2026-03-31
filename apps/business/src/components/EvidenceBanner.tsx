import { useEffect, useState, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import { useApi } from '../lib/api'
import { colors } from '../lib/theme'

interface ThresholdProgress {
  key: string
  label: string
  description: string
  target: number
  current: number
  met: boolean
  pct: number
}

interface EvidenceData {
  thresholds: ThresholdProgress[]
  thresholdsMet: number
  totalThresholds: number
  allMet: boolean
}

interface PaywallData {
  status: string
  thresholdsMet: number
  isLocked: boolean
  canCreateSale: boolean
  message: string | null
}

export function EvidenceBanner() {
  const api = useApi()
  const [evidence, setEvidence] = useState<EvidenceData | null>(null)
  const [paywall, setPaywall] = useState<PaywallData | null>(null)

  const load = useCallback(async () => {
    try {
      const [ev, pw] = await Promise.all([
        api.evidenceProgress(),
        api.paywallStatus(),
      ])
      setEvidence(ev)
      setPaywall(pw)
    } catch { /* */ }
  }, [api])

  useEffect(() => { load() }, [load])

  if (!evidence || !paywall) return null

  // Don't show anything if on paid plan (status = 'free' with 0 met)
  if (paywall.status === 'free' && paywall.thresholdsMet === 0) return null

  const onUpgrade = () => {
    Linking.openURL('https://serendipeatery.com/billing')
  }

  // ─── Hard Lockdown ──────────────────────────────────────────────────
  if (paywall.isLocked) {
    return (
      <View style={styles.lockedContainer}>
        <Text style={styles.lockedTitle}>Trial Complete!</Text>
        <Text style={styles.lockedSubtitle}>
          SerendipEatery works for your business — all 5 evidence thresholds met.
        </Text>

        <View style={styles.thresholdList}>
          {evidence.thresholds.map((t) => (
            <View key={t.key} style={styles.thresholdRow}>
              <Text style={styles.checkmark}>✅</Text>
              <Text style={styles.thresholdLabel}>{t.label}</Text>
              <Text style={styles.thresholdValue}>{t.current}/{t.target}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.lockedNote}>
          Your most recent sale stays active. Upgrade to create new sales.
        </Text>

        <Pressable style={styles.upgradeBtn} onPress={onUpgrade}>
          <Text style={styles.upgradeBtnText}>Upgrade Now</Text>
        </Pressable>

        <Text style={styles.webNote}>Opens in your browser. No in-app payments.</Text>
      </View>
    )
  }

  // ─── Soft Prompts ───────────────────────────────────────────────────
  if (!paywall.message) return null

  return (
    <View style={styles.softContainer}>
      <View style={styles.softHeader}>
        <Text style={styles.softTitle}>
          Evidence: {paywall.thresholdsMet}/5
        </Text>
        <View style={styles.progressBarOuter}>
          <View style={[styles.progressBarInner, { width: `${(paywall.thresholdsMet / 5) * 100}%` }]} />
        </View>
      </View>

      {/* Individual thresholds */}
      <View style={styles.thresholdList}>
        {evidence.thresholds.map((t) => (
          <View key={t.key} style={styles.thresholdRow}>
            <Text style={t.met ? styles.checkmark : styles.pending}>
              {t.met ? '✅' : '⬜'}
            </Text>
            <View style={styles.thresholdInfo}>
              <Text style={[styles.thresholdLabel, !t.met && { opacity: 0.6 }]}>
                {t.label}
              </Text>
              <View style={styles.miniBar}>
                <View style={[styles.miniFill, { width: `${t.pct}%` }]} />
              </View>
            </View>
            <Text style={styles.thresholdValue}>{t.current}/{t.target}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.softMessage}>{paywall.message}</Text>

      <Pressable style={styles.softUpgradeBtn} onPress={onUpgrade}>
        <Text style={styles.softUpgradeBtnText}>View Plans</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  // Locked state
  lockedContainer: {
    backgroundColor: '#1a0f2e',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  lockedTitle: { fontSize: 22, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  lockedSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
  lockedNote: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 12 },
  upgradeBtn: {
    backgroundColor: colors.primary, padding: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 16,
  },
  upgradeBtnText: { color: colors.night, fontSize: 17, fontWeight: '800' },
  webNote: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 6 },

  // Soft prompt
  softContainer: {
    backgroundColor: colors.surfaceDim,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  softHeader: { marginBottom: 10 },
  softTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  progressBarOuter: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3, overflow: 'hidden',
  },
  progressBarInner: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  softMessage: { fontSize: 13, color: colors.primary, marginTop: 10 },
  softUpgradeBtn: {
    borderWidth: 1, borderColor: colors.primary, padding: 10,
    borderRadius: 10, alignItems: 'center', marginTop: 10,
  },
  softUpgradeBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },

  // Thresholds
  thresholdList: { marginTop: 10 },
  thresholdRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  checkmark: { fontSize: 16, width: 24 },
  pending: { fontSize: 16, width: 24 },
  thresholdInfo: { flex: 1 },
  thresholdLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  thresholdValue: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  miniBar: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2, overflow: 'hidden', marginTop: 3,
  },
  miniFill: { height: '100%', backgroundColor: colors.success, borderRadius: 2 },
})
