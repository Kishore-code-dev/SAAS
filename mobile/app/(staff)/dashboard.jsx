import React from 'react'
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../store/authStore'
import { useRouter } from 'expo-router'

export default function StaffDashboard() {
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
          <Text style={styles.orgName}>{organization?.name ?? 'Kaveri Logistics'} (Staff)</Text>
          <Text style={styles.welcome}>Welcome, {user?.fullName ?? 'Fleet Staff'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permitted Operational Modules</Text>
          <View style={styles.moduleList}>
            {['Vehicle Inspections & Defect Triage', 'Workshop Work Orders & Parts', 'Driver Assignments & Meter History', 'Fuel & Energy Logging', 'Service Reminders'].map((mod) => (
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
  orgName: { fontSize: 12, fontWeight: '700', color: '#1F7A4C', textTransform: 'uppercase' },
  welcome: { fontSize: 16, fontWeight: '800', color: '#625346', marginTop: 2 },
  logoutBtn: { backgroundColor: '#FCECEB', borderWidth: 1, borderColor: '#D9786C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  logoutText: { fontSize: 11, fontWeight: '700', color: '#B84E42' },
  scroll: { padding: 16 },
  section: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#625346', marginBottom: 12 },
  moduleList: { gap: 8 },
  moduleItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  moduleText: { fontSize: 13, fontWeight: '600', color: '#625346' },
  moduleAction: { fontSize: 12, fontWeight: '700', color: '#1F7A4C' },
})
