import React, { useEffect } from 'react'
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../store/authStore'
import { useFleetStore } from '../../store/fleetStore'
import { useRouter } from 'expo-router'

export default function StaffDashboard() {
  const { user, organization, permissions, logout } = useAuthStore()
  const { workOrders, vehicles, isLoading, loadFleetData, pendingSync, flushOfflineQueue } = useFleetStore()
  const router = useRouter()

  useEffect(() => {
    loadFleetData()
  }, [])

  const grantedModules = permissions?.modules
    ? Object.entries(permissions.modules)
        .filter(([, actions]) => actions?.view)
        .map(([key]) => key)
    : []

  const handleLogout = async () => {
    await logout()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.orgName} numberOfLines={1}>
            {organization?.name ?? 'DriveMitra'} · Fleet Staff
          </Text>
          <Text style={styles.welcome} numberOfLines={1}>
            {user?.fullName ?? 'Fleet Staff'}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadFleetData} />}
      >
        {pendingSync.length > 0 && (
          <TouchableOpacity style={styles.syncBanner} onPress={flushOfflineQueue}>
            <Text style={styles.syncTitle}>
              {pendingSync.length} Pending Offline Task(s) · Tap to Sync
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Granted Modules ({grantedModules.length}/31 · Owner RBAC Enforced)
          </Text>
          <View style={styles.chipWrap}>
            {grantedModules.map((mod) => (
              <View key={mod} style={styles.chip}>
                <Text style={styles.chipText}>{mod.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permitted Operational Desk ({workOrders.length} Work Orders · {vehicles.length} Vehicles)</Text>
          <View style={styles.moduleList}>
            {workOrders.slice(0, 6).map((wo) => (
              <View key={wo.id} style={styles.moduleItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.moduleText}>{wo.title}</Text>
                  <Text style={styles.moduleMeta}>{wo.workOrderNumber} · {wo.workshopName}</Text>
                </View>
                <Text style={styles.moduleAction}>{wo.status}</Text>
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
    gap: 12,
  },
  headerText: { flex: 1 },
  orgName: { fontSize: 12, fontWeight: '700', color: '#1F7A4C' },
  welcome: { fontSize: 16, fontWeight: '800', color: '#625346', marginTop: 2 },
  logoutBtn: {
    backgroundColor: '#FCECEB',
    borderWidth: 1,
    borderColor: '#D9786C',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  logoutText: { fontSize: 12, fontWeight: '700', color: '#B84E42' },
  scroll: { padding: 16, gap: 12 },
  syncBanner: {
    backgroundColor: '#FCF5DE',
    borderWidth: 1,
    borderColor: '#D8B442',
    borderRadius: 12,
    padding: 12,
  },
  syncTitle: { fontSize: 12, fontWeight: '700', color: '#625346', textAlign: 'center' },
  section: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#625346', marginBottom: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#EEE8F7', borderWidth: 1, borderColor: '#DDD3ED', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  chipText: { fontSize: 11, fontWeight: '600', color: '#6E5696', textTransform: 'capitalize' },
  moduleList: { gap: 8 },
  moduleItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  moduleText: { fontSize: 13, fontWeight: '600', color: '#625346' },
  moduleMeta: { fontSize: 11, color: '#958777', marginTop: 2 },
  moduleAction: { fontSize: 11, fontWeight: '700', color: '#1F7A4C', textTransform: 'capitalize' },
})
