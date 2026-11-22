import React, { useEffect } from 'react'
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../../store/authStore'
import { useFleetStore } from '../../store/fleetStore'
import { useRouter } from 'expo-router'

export default function DriverDashboard() {
  const { user, organization, logout } = useAuthStore()
  const { trips, vehicles, pendingSync, isLoading, loadFleetData, queueFieldAction, flushOfflineQueue } = useFleetStore()
  const router = useRouter()

  useEffect(() => {
    loadFleetData()
  }, [])

  const activeTrip = trips.find((t) => t.status === 'active') ?? trips[0]
  const assignedVehicle = vehicles.find((v) => v.id === activeTrip?.vehicleId) ?? vehicles[0]

  const handleLogout = async () => {
    await logout()
    router.replace('/(auth)/login')
  }

  const submitPreTripDvir = () => {
    queueFieldAction('/fleet/inspections', {
      vehicleId: assignedVehicle?.id ?? 'veh-1',
      status: 'passed',
      timestamp: new Date().toISOString(),
    })
    Alert.alert('DVIR Logged', 'Pre-trip DVIR recorded and queued for synchronization.')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.orgName} numberOfLines={1}>
            {organization?.name ?? 'DriveMitra'} · Driver
          </Text>
          <Text style={styles.welcome} numberOfLines={1}>
            {user?.fullName ?? 'Commercial Driver'}
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
              {pendingSync.length} Offline Record(s) Queued · Tap to Sync
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.tripCard}>
          <Text style={styles.tripBadge}>
            {activeTrip ? `Dispatch · ${activeTrip.status}` : 'Assigned Dispatch'}
          </Text>
          <Text style={styles.tripRoute}>
            {activeTrip ? `${activeTrip.originAddress} → ${activeTrip.destinationAddress}` : 'Standby for dispatch'}
          </Text>
          <Text style={styles.tripMeta}>
            Vehicle: {assignedVehicle ? `${assignedVehicle.registrationNumber} · ${assignedVehicle.make} ${assignedVehicle.model}` : 'Pending assignment'}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={submitPreTripDvir}>
            <Text style={styles.primaryBtnText}>Sign Pre-Trip DVIR Inspection</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver Trip History ({trips.length})</Text>
          <View style={styles.moduleList}>
            {trips.slice(0, 5).map((t) => (
              <View key={t.id} style={styles.moduleItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.moduleText}>{t.originAddress} → {t.destinationAddress}</Text>
                  <Text style={styles.tripSub}>{t.distanceKm} km · Avg {t.avgSpeedKmh} km/h</Text>
                </View>
                <Text style={styles.moduleAction}>{t.status}</Text>
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
  orgName: { fontSize: 12, fontWeight: '700', color: '#B84E42' },
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
  tripCard: { backgroundColor: '#EEE8F7', borderWidth: 1, borderColor: '#B8A3D9', borderRadius: 12, padding: 16 },
  tripBadge: { fontSize: 11, fontWeight: '800', color: '#6E5696', textTransform: 'uppercase', marginBottom: 4 },
  tripRoute: { fontSize: 16, fontWeight: '800', color: '#625346', marginBottom: 6 },
  tripMeta: { fontSize: 12, color: '#625346', marginBottom: 14 },
  primaryBtn: { backgroundColor: '#6E5696', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  section: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#625346', marginBottom: 12 },
  moduleList: { gap: 8 },
  moduleItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FAFAFA' },
  moduleText: { fontSize: 13, fontWeight: '600', color: '#625346' },
  tripSub: { fontSize: 11, color: '#958777', marginTop: 2 },
  moduleAction: { fontSize: 11, fontWeight: '700', color: '#B84E42', textTransform: 'capitalize' },
})
