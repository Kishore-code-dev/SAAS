import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuthStore } from '../store/authStore'

export default function IndexGate() {
  const { isLoading, isAuthenticated, role } = useAuthStore()

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.brand}>DriveMitra</Text>
        <Text style={styles.caption}>Loading mobile fleet workspace...</Text>
        <ActivityIndicator size="large" color="#6E5696" style={styles.spinner} />
      </View>
    )
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />
  }

  if (role === 'driver') {
    return <Redirect href="/(driver)/dashboard" />
  }
  if (role === 'fleet_staff' || role === 'fleet_manager' || role === 'maintenance' || role === 'finance') {
    return <Redirect href="/(staff)/dashboard" />
  }
  return <Redirect href="/(owner)/dashboard" />
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEE8F7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: '#625346',
  },
  caption: {
    fontSize: 13,
    color: '#958777',
    marginTop: 6,
  },
  spinner: {
    marginTop: 20,
  },
})
