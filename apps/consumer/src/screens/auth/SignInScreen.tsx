import { useSignIn } from '@clerk/clerk-expo'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native'
import { useState, useCallback } from 'react'
import * as WebBrowser from 'expo-web-browser'
import type { RootStackParamList } from '../../navigation/RootNavigator'

WebBrowser.maybeCompleteAuthSession()

export function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const onSignIn = useCallback(async () => {
    if (!isLoaded) return
    try {
      const result = await signIn.create({ identifier: email, password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
      }
    } catch (err: any) {
      Alert.alert('Sign in failed', err.errors?.[0]?.message ?? 'Something went wrong')
    }
  }, [isLoaded, email, password, signIn, setActive])

  const onOAuth = useCallback(async () => {
    if (!isLoaded) return
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: 'serendipeatery://sso-callback',
        redirectUrlComplete: 'serendipeatery://sso-callback',
      })
    } catch (err: any) {
      Alert.alert('OAuth failed', err.errors?.[0]?.message ?? 'Something went wrong')
    }
  }, [isLoaded, signIn])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SerendipEatery</Text>
      <Text style={styles.subtitle}>Sign in to your account</Text>

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

      <Pressable style={styles.button} onPress={onSignIn}>
        <Text style={styles.buttonText}>Sign In</Text>
      </Pressable>

      <Pressable style={styles.oauthButton} onPress={onOAuth}>
        <Text style={styles.oauthText}>Continue with Google</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('SignUp')}>
        <Text style={styles.link}>Don't have an account? Sign up</Text>
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
  oauthButton: { borderWidth: 1, borderColor: '#F7941D', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  oauthText: { color: '#F7941D', fontWeight: '600', fontSize: 16 },
  link: { color: '#F7941D', textAlign: 'center', marginTop: 24, fontSize: 14 },
})
