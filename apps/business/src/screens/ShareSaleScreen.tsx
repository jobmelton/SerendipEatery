import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, Image, Pressable, StyleSheet, ActivityIndicator, Alert, Share,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useRoute, useNavigation } from '@react-navigation/native'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useApi } from '../lib/api'
import { colors } from '../lib/theme'
import type { MainStackParamList } from '../navigation/RootNavigator'

type RouteProps = NativeStackScreenProps<MainStackParamList, 'ShareSale'>['route']

export function ShareSaleScreen() {
  const route = useRoute<RouteProps>()
  const navigation = useNavigation<any>()
  const api = useApi()
  const { saleId, businessName } = route.params

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const result = await api.getSaleShareCard(saleId)
        setImageUrl(result.imageUrl)
      } catch { /* */ }
      setLoading(false)
    })()
  }, [api, saleId])

  const onShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Flash sale at ${businessName}! Spin for prizes on SerendipEatery 🎰\n\nhttps://serendip.app/sale/${saleId}`,
      })
    } catch { /* cancelled */ }
  }, [businessName, saleId])

  const onCopyLink = useCallback(async () => {
    await Clipboard.setStringAsync(`https://serendip.app/sale/${saleId}`)
    Alert.alert('Copied!', 'Sale link copied to clipboard')
  }, [saleId])

  const onDownload = useCallback(async () => {
    if (!imageUrl) return
    try {
      const localUri = FileSystem.cacheDirectory + `sale-card-${saleId}.png`
      await FileSystem.downloadAsync(imageUrl, localUri)

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: 'image/png',
          dialogTitle: 'Save sale card',
        })
      } else {
        Alert.alert('Downloaded', 'Card saved to cache')
      }
    } catch {
      Alert.alert('Error', 'Failed to download card')
    }
  }, [imageUrl, saleId])

  return (
    <View style={styles.container}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>Done</Text>
      </Pressable>

      <Text style={styles.title}>Promote Your Sale</Text>
      <Text style={styles.subtitle}>Share this card to attract more customers</Text>

      <View style={styles.cardContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="contain" />
        ) : (
          <View style={styles.cardPlaceholder}>
            <Text style={styles.placeholderEmoji}>⚡</Text>
            <Text style={styles.placeholderText}>Flash Sale</Text>
            <Text style={styles.placeholderBiz}>{businessName}</Text>
          </View>
        )}
      </View>

      <View style={styles.shareButtons}>
        <Pressable style={styles.shareBtn} onPress={onShare}>
          <Text style={styles.shareBtnIcon}>📤</Text>
          <Text style={styles.shareBtnText}>Share</Text>
        </Pressable>

        <Pressable style={[styles.shareBtn, { backgroundColor: colors.accent }]} onPress={onCopyLink}>
          <Text style={styles.shareBtnIcon}>🔗</Text>
          <Text style={styles.shareBtnText}>Copy Link</Text>
        </Pressable>

        <Pressable style={[styles.shareBtn, { backgroundColor: colors.success }]} onPress={onDownload}>
          <Text style={styles.shareBtnIcon}>💾</Text>
          <Text style={styles.shareBtnText}>Download</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.night, padding: 20, paddingTop: 60 },
  backBtn: { marginBottom: 12 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  cardContainer: {
    backgroundColor: colors.surfaceDim, borderRadius: 20,
    height: 340, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 20,
  },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { alignItems: 'center' },
  placeholderEmoji: { fontSize: 48 },
  placeholderText: { fontSize: 22, fontWeight: '700', color: colors.primary, marginTop: 8 },
  placeholderBiz: { fontSize: 16, color: colors.textSecondary, marginTop: 4 },
  shareButtons: { flexDirection: 'row', gap: 10 },
  shareBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 14,
    padding: 14, alignItems: 'center',
  },
  shareBtnIcon: { fontSize: 22 },
  shareBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 },
})
