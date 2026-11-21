import React, { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useAuthStore } from '../store/authStore'
import { initOfflineDatabase } from '../database/sqlite'

export default function RootLayout() {
  const { isAuthenticated, role, isLoading, initializeAuth } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    initOfflineDatabase()
    initializeAuth()
  }, [])

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (isAuthenticated && inAuthGroup) {
      if (role === 'driver') {
        router.replace('/(driver)/dashboard')
      } else if (role === 'fleet_manager' || role === 'maintenance' || role === 'finance') {
        router.replace('/(staff)/dashboard')
      } else {
        router.replace('/(owner)/dashboard')
      }
    }
  }, [isAuthenticated, segments, isLoading, role])

  return (
    <>
      <StatusBar style="dark" backgroundColor="#EEE8F7" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}>
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(owner)/dashboard" />
        <Stack.Screen name="(staff)/dashboard" />
        <Stack.Screen name="(driver)/dashboard" />
      </Stack>
    </>
  )
}
