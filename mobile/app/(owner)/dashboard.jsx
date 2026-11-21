import React from 'react'
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../store/authStore'
import { useRouter } from 'expo-router'

export default function OwnerDashboard() {
  const { user, organization, logout } = useAuthStore()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.orgName}>{organization?.name ?? 'Kaveri Logistics'} (Owner)</Text>
          <Text style={styles.welcome}>Welcome, {user?.fullName ?? 'Fleet Owner'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Active Vehicles</Text>
            <Text style={styles.kpiValue}>8</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Active Drivers</Text>
            <Text style={styles.kpiValue}>8</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Open Work Orders</Text>
            <Text style={styles.kpiValue}>3</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Fleet Health</Text>
            <Text style={styles.kpiValue}>88%</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Owner Fleet Management Modules</Text>
          <View style={styles.moduleList}>
            {['Vehicles & Digital Twins', 'Vehicle Contracts & Partners', 'Drivers & Compliance', 'Workshop Work Orders', 'Parts & Inventory', 'Fleet Finance & EMIs', 'Live Telemetry & Map', 'Executive Reports'].map((mod) => (
              <View key={mod} style={styles.moduleItem}>
                <Text style={styles.moduleText}>{mod}</Text>
                <Text style={styles.moduleAction}>Open →</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  orgName: { fontSize: 12, fontWeight: '700', color: '#6E5696', textTransform: 'uppercase' },
  welcome: { fontSize: 16, fontWeight: '800', color: '#625346', marginTop: 2 },
  logoutBtn: { backgroundColor: '#FCECEB', borderWidth: 1, borderColor: '#D9786C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  logoutText: { fontSize: 11, fontWeight: '700', color: '#B84E42' },
  scroll: { padding: 16 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  kpiCard: { flex: 1, minWidth: '45%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, padding: 16 },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: '#958777' },
  kpiValue: { fontSize: 22, fontWeight: '800', color: '#625346', marginTop: 4 },
  section: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#625346', marginBottom: 12 },
  moduleList: { gap: 8 },
  moduleItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  moduleText: { fontSize: 13, fontWeight: '600', color: '#625346' },
  moduleAction: { fontSize: 12, fontWeight: '700', color: '#6E5696' },
})
