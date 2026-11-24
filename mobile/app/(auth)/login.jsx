import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../store/authStore'
import {
  HOSTED_DEV_API_URL,
  HOSTED_SHARED_API_URL,
  detectLocalLanApiUrl,
  getApiBaseUrl,
  initializeApiBaseUrl,
  setApiBaseUrl,
} from '../../services/api'

export default function LoginScreen() {
  const [username, setUsername] = useState('kaveri.owner')
  const [password, setPassword] = useState('DriveMitra@2026')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showServerConfig, setShowServerConfig] = useState(false)
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl())
  const { login } = useAuthStore()
  const router = useRouter()

  const localLanUrl = detectLocalLanApiUrl()

  useEffect(() => {
    initializeApiBaseUrl().then((url) => setServerUrl(url))
  }, [])

  const applyServerUrl = async (nextUrl) => {
    const updated = await setApiBaseUrl(nextUrl)
    setServerUrl(updated)
  }

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    if (serverUrl && serverUrl !== getApiBaseUrl()) {
      await setApiBaseUrl(serverUrl)
    }
    const result = await login(username.trim(), password)
    setLoading(false)
    if (result.success) {
      const currentRole = useAuthStore.getState().role
      if (currentRole === 'driver') {
        router.replace('/(driver)/dashboard')
      } else if (currentRole === 'fleet_staff' || currentRole === 'fleet_manager' || currentRole === 'maintenance' || currentRole === 'finance') {
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>DRIVEMITRA ENTERPRISE MOBILE</Text>
            </View>
            <Text style={styles.title}>DriveMitra</Text>
            <Text style={styles.subtitle}>
              Fleet Intelligence &amp; Smartphone Telematics
            </Text>

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
                autoCorrect={false}
                placeholder="kaveri.owner"
                placeholderTextColor="#958777"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                  <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Password"
                placeholderTextColor="#958777"
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#362C24" />
              ) : (
                <Text style={styles.buttonText}>Sign In to Fleet Workspace</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.serverToggle}
              onPress={() => setShowServerConfig((prev) => !prev)}
            >
              <Text style={styles.serverToggleText}>
                {showServerConfig ? 'Hide API Server Settings ▲' : 'API Server Settings ▼'}
              </Text>
            </TouchableOpacity>

            {showServerConfig && (
              <View style={styles.serverPanel}>
                <Text style={styles.serverLabel}>Backend API Endpoint</Text>
                <TextInput
                  style={styles.serverInput}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="https://.../api"
                  placeholderTextColor="#958777"
                />
                <View style={styles.presetRow}>
                  <TouchableOpacity
                    style={styles.presetBtn}
                    onPress={() => applyServerUrl(HOSTED_SHARED_API_URL)}
                  >
                    <Text style={styles.presetText}>Shared Cloud</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetBtn}
                    onPress={() => applyServerUrl(HOSTED_DEV_API_URL)}
                  >
                    <Text style={styles.presetText}>Dev Cloud</Text>
                  </TouchableOpacity>
                  {localLanUrl && (
                    <TouchableOpacity
                      style={styles.presetBtn}
                      onPress={() => applyServerUrl(localLanUrl)}
                    >
                      <Text style={styles.presetText}>Local LAN</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F2',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EBE5DF',
    padding: 24,
    shadowColor: '#362C24',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  badge: {
    alignSelf: 'center',
    backgroundColor: '#EEE8F7',
    borderWidth: 1,
    borderColor: '#D3C4F0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6E5696',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#362C24',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#958777',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: '#FCECEB',
    borderWidth: 1,
    borderColor: '#D9786C',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#B84E42',
    fontSize: 12,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#362C24',
    marginBottom: 6,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6E5696',
  },
  input: {
    backgroundColor: '#F9F8F6',
    borderWidth: 1,
    borderColor: '#E2DCD5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: '#362C24',
  },
  button: {
    backgroundColor: '#E8C65A',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D8B442',
    shadowColor: '#D8B442',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#362C24',
    letterSpacing: 0.3,
  },
  serverToggle: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 8,
  },
  serverToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6E5696',
  },
  serverPanel: {
    marginTop: 10,
    padding: 14,
    backgroundColor: '#F9F8F6',
    borderWidth: 1,
    borderColor: '#EBE5DF',
    borderRadius: 12,
    gap: 8,
  },
  serverLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#958777',
  },
  serverInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2DCD5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#362C24',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    backgroundColor: '#EEE8F7',
    borderWidth: 1,
    borderColor: '#D3C4F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6E5696',
  },
})
