import { useSignUp } from '@clerk/clerk-expo'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native'
import { useState, useCallback } from 'react'
import type { RootStackParamList } from '../../navigation/RootNavigator'

export function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const onSignUp = useCallback(async () => {
    if (!isLoaded) return
    try {
      const result = await signUp.create({ emailAddress: email, password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
      }
    } catch (err: any) {
      Alert.alert('Sign up failed', err.errors?.[0]?.message ?? 'Something went wrong')
    }
  }, [isLoaded, email, password, signUp, setActive])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SerendipEatery</Text>
      <Text style={styles.subtitle}>Create your account</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#fff8f280"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#fff8f280"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable style={styles.button} onPress={onSignUp}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('SignIn')}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0a1e', justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '800', color: '#F7941D', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#fff8f2', opacity: 0.7, textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#1a1230', color: '#fff8f2', borderRadius: 12, padding: 16, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: '#F7941D', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#0f0a1e', fontWeight: '700', fontSize: 16 },
  link: { color: '#F7941D', textAlign: 'center', marginTop: 24, fontSize: 14 },
})
