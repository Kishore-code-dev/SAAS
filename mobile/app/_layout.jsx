import React, { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useAuthStore } from '../store/authStore'
import { initOfflineDatabase } from '../database/sqlite'
import { initializeApiBaseUrl } from '../services/api'

export default function RootLayout() {
  const { isAuthenticated, role, isLoading, initializeAuth } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    initOfflineDatabase()
    initializeApiBaseUrl().finally(() => {
      initializeAuth()
    })
  }, [initializeAuth])

  useEffect(() => {
    if (isLoading) return

    const topSegment = segments[0]
    const inAuthGroup = topSegment === '(auth)'

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (isAuthenticated && (inAuthGroup || !topSegment)) {
      if (role === 'driver') {
        router.replace('/(driver)/dashboard')
      } else if (role === 'fleet_staff' || role === 'fleet_manager' || role === 'maintenance' || role === 'finance') {
        router.replace('/(staff)/dashboard')
      } else {
        router.replace('/(owner)/dashboard')
      }
    }
  }, [isAuthenticated, segments, isLoading, role, router])

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor="#EEE8F7" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(owner)" />
        <Stack.Screen name="(staff)" />
        <Stack.Screen name="(driver)" />
      </Stack>
    </SafeAreaProvider>
  )
}
