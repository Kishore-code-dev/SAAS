import React, { useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../store/authStore'
import { useRouter } from 'expo-router'

export default function LoginScreen() {
  const [username, setUsername] = useState('kaveri.owner')
  const [password, setPassword] = useState('DriveMitra@2026')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { login } = useAuthStore()
  const router = useRouter()

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    const result = await login(username, password)
    setLoading(false)
    if (result.success) {
      const currentRole = useAuthStore.getState().role
      if (currentRole === 'driver') {
        router.replace('/(driver)/dashboard')
      } else if (currentRole === 'fleet_manager' || currentRole === 'maintenance' || currentRole === 'finance') {
        router.replace('/(staff)/dashboard')
      } else {
        router.replace('/(owner)/dashboard')
      }
    } else {
      setError(result.message)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>DriveMitra</Text>
        <Text style={styles.subtitle}>Enterprise Fleet Intelligence & Smartphone Telematics</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username or Email</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="kaveri.owner"
            placeholderTextColor="#958777"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#958777"
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#625346" />
          ) : (
            <Text style={styles.buttonText}>Sign In to Fleet Workspace</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: 24,
    shadowColor: '#625346',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#625346',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#958777',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: '#FCECEB',
    borderWidth: 1,
    borderColor: '#D9786C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#B84E42',
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#625346',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#625346',
  },
  button: {
    backgroundColor: '#E8C65A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D8B442',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#625346',
  },
})
