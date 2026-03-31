import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useAuth, useUser } from '@clerk/clerk-expo'

export function DashboardScreen() {
  const { signOut } = useAuth()
  const { user } = useUser()

  const businessName =
    (user?.unsafeMetadata as { businessName?: string })?.businessName ?? 'Your Business'

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{businessName}</Text>
      <Text style={styles.subtitle}>
        Welcome back, {user?.firstName ?? 'Owner'} 👋
      </Text>
      <Text style={styles.hint}>Your business dashboard is coming soon.</Text>
      <Pressable style={styles.signOut} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0a1e', justifyContent: 'center', alignItems: 'center', padding: 24 },
  greeting: { fontSize: 28, fontWeight: '700', color: '#F7941D' },
  subtitle: { fontSize: 18, color: '#fff8f2', marginTop: 8 },
  hint: { fontSize: 14, color: '#fff8f2', opacity: 0.5, marginTop: 16 },
  signOut: { marginTop: 32, backgroundColor: '#F7941D', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  signOutText: { color: '#0f0a1e', fontWeight: '600', fontSize: 16 },
})
