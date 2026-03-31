import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useAuth, useUser } from '@clerk/clerk-expo'

export function HomeScreen() {
  const { signOut } = useAuth()
  const { user } = useUser()

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        Hey, {user?.firstName ?? 'Explorer'} 👋
      </Text>
      <Text style={styles.subtitle}>
        Your next meal adventure awaits.
      </Text>
      <Pressable style={styles.signOut} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0a1e', justifyContent: 'center', alignItems: 'center', padding: 24 },
  greeting: { fontSize: 28, fontWeight: '700', color: '#fff8f2' },
  subtitle: { fontSize: 16, color: '#fff8f2', opacity: 0.7, marginTop: 8 },
  signOut: { marginTop: 32, backgroundColor: '#F7941D', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  signOutText: { color: '#0f0a1e', fontWeight: '600', fontSize: 16 },
})
