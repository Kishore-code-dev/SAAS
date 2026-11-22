import React, { useEffect } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../store/authStore'
import { useFleetStore } from '../../store/fleetStore'

export default function OwnerDashboard() {
  const { user, organization, logout } = useAuthStore()
  const {
    vehicles,
    drivers,
    workOrders,
    trips,
    contractsSummary,
    pendingSync,
    isLoading,
    loadFleetData,
    flushOfflineQueue,
  } = useFleetStore()
  const router = useRouter()

  useEffect(() => {
    loadFleetData()
  }, [])

  const avgHealth =
    vehicles.length > 0
      ? Math.round(vehicles.reduce((sum, v) => sum + (v.healthScore ?? 0), 0) / vehicles.length)
      : 0
  const openOrders = workOrders.filter((w) => w.status !== 'completed' && w.status !== 'closed').length
  const activeContracts = contractsSummary?.contracts?.filter((c) => c.status === 'active')?.length ?? 0

  const handleLogout = async () => {
    await logout()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.orgName} numberOfLines={1}>
            {organization?.name ?? 'DriveMitra Fleet'} · Owner
          </Text>
          <Text style={styles.welcome} numberOfLines={1}>
            {user?.fullName ?? 'Fleet Owner'}
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
              {pendingSync.length} Offline Action(s) Queued · Tap to Sync
            </Text>
          </TouchableOpacity>
        )}

        {isLoading && vehicles.length === 0 ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color="#6E5696" />
          </View>
        ) : (
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Active Vehicles</Text>
              <Text style={styles.kpiValue}>{vehicles.length}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Drivers</Text>
              <Text style={styles.kpiValue}>{drivers.length}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Open Work Orders</Text>
              <Text style={styles.kpiValue}>{openOrders}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Fleet Health</Text>
              <Text style={styles.kpiValue}>{avgHealth}%</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mobile Fleet Modules</Text>
          <View style={styles.moduleList}>
            <TouchableOpacity style={styles.moduleItem} onPress={() => router.push('/(owner)/vehicles')}>
              <Text style={styles.moduleText}>Vehicles &amp; Ownership ({vehicles.length})</Text>
              <Text style={styles.moduleAction}>Open →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moduleItem} onPress={() => router.push('/(owner)/fuel')}>
              <Text style={styles.moduleText}>Fuel &amp; Receipt OCR Capture</Text>
              <Text style={styles.moduleAction}>Open →</Text>
            </TouchableOpacity>
            <View style={styles.moduleItem}>
              <Text style={styles.moduleText}>Active Vehicle Contracts</Text>
              <Text style={styles.moduleMeta}>{activeContracts} active</Text>
            </View>
            <View style={styles.moduleItem}>
              <Text style={styles.moduleText}>Active &amp; Recent Trips</Text>
              <Text style={styles.moduleMeta}>{trips.length} dispatches</Text>
            </View>
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
  orgName: { fontSize: 12, fontWeight: '700', color: '#6E5696' },
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
  scroll: { padding: 16, gap: 14 },
  syncBanner: {
    backgroundColor: '#FCF5DE',
    borderWidth: 1,
    borderColor: '#D8B442',
    borderRadius: 12,
    padding: 12,
  },
  syncTitle: { fontSize: 12, fontWeight: '700', color: '#625346', textAlign: 'center' },
  loaderBox: { paddingVertical: 40, alignItems: 'center' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
  },
  kpiLabel: { fontSize: 11, fontWeight: '700', color: '#958777' },
  kpiValue: { fontSize: 22, fontWeight: '800', color: '#625346', marginTop: 4 },
  section: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#625346', marginBottom: 12 },
  moduleList: { gap: 4 },
  moduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FAFAFA',
  },
  moduleText: { fontSize: 13, fontWeight: '600', color: '#625346' },
  moduleAction: { fontSize: 12, fontWeight: '700', color: '#6E5696' },
  moduleMeta: { fontSize: 12, fontWeight: '600', color: '#958777' },
})
