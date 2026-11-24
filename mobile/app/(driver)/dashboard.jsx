import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../store/authStore'
import { apiClient } from '../../services/api'

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'trips', label: 'My Trips' },
  { id: 'fuel', label: 'Fuel / Exp' },
  { id: 'inspect', label: 'Inspect' },
  { id: 'docs', label: 'Docs & Me' },
]

export default function DriverDashboard() {
  const { user, organization, logout } = useAuthStore()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState('home')
  const [loading, setLoading] = useState(true)
  const [homeData, setHomeData] = useState(null)
  const [trips, setTrips] = useState([])
  const [expenses, setExpenses] = useState([])
  const [fuelLogs, setFuelLogs] = useState([])
  const [docsData, setDocsData] = useState({ driverCompliance: null, vehicleCompliance: null })

  // Interactive odometer & form inputs (zero fabricated telemetry)
  const [odoInput, setOdoInput] = useState('')
  const [fuelLitres, setFuelLitres] = useState('')
  const [fuelAmount, setFuelAmount] = useState('')
  const [fuelStation, setFuelStation] = useState('')
  const [expCategory, setExpCategory] = useState('toll')
  const [expAmount, setExpAmount] = useState('')
  const [expNote, setExpNote] = useState('')
  const [issueTitle, setIssueTitle] = useState('')

  const loadDriverPortal = useCallback(async () => {
    setLoading(true)
    try {
      const [hRes, tRes, fRes, eRes, dRes] = await Promise.all([
        apiClient.get('/driver/home'),
        apiClient.get('/driver/trips'),
        apiClient.get('/driver/fuel'),
        apiClient.get('/driver/expenses'),
        apiClient.get('/driver/documents'),
      ])
      setHomeData(hRes.data)
      setTrips(tRes.data.trips ?? [])
      setFuelLogs(fRes.data.fuelLogs ?? [])
      setExpenses(eRes.data.expenses ?? [])
      setDocsData(dRes.data ?? {})
    } catch (err) {
      Alert.alert('Sync Notice', err.response?.data?.error ?? 'Unable to refresh Driver Portal data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDriverPortal()
  }, [loadDriverPortal])

  const handleLogout = async () => {
    await logout()
    router.replace('/(auth)/login')
  }

  const handleStartTrip = async (tripId) => {
    const num = Number(odoInput)
    if (!Number.isFinite(num) || num <= 0) {
      Alert.alert('Odometer Required', 'Enter your exact starting odometer reading in km.')
      return
    }
    try {
      await apiClient.post(`/driver/trips/${tripId}/start`, { startOdometerKm: num })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setOdoInput('')
      Alert.alert('Trip Started', 'Trip transitioned to In Progress.')
      void loadDriverPortal()
    } catch (err) {
      Alert.alert('Start Failed', err.response?.data?.error ?? 'Unable to start trip.')
    }
  }

  const handleEndTrip = async (tripId) => {
    const num = Number(odoInput)
    if (!Number.isFinite(num) || num <= 0) {
      Alert.alert('Odometer Required', 'Enter your exact ending odometer reading in km.')
      return
    }
    try {
      const res = await apiClient.post(`/driver/trips/${tripId}/end`, { endOdometerKm: num })
      setOdoInput('')
      if (res.data.discrepancyWarning) {
        Alert.alert('Completed with Discrepancy Flag', res.data.discrepancyWarning)
      } else {
        Alert.alert('Trip Completed', 'Trip completed and recorded cleanly.')
      }
      void loadDriverPortal()
    } catch (err) {
      Alert.alert('End Failed', err.response?.data?.error ?? 'Unable to complete trip.')
    }
  }

  const submitFuel = async () => {
    if (!homeData?.assignedVehicle?.id || !Number(fuelLitres) || !Number(fuelAmount)) {
      Alert.alert('Required Fields', 'Enter valid fuel litres and amount (INR).')
      return
    }
    try {
      await apiClient.post('/driver/fuel', {
        vehicleId: homeData.assignedVehicle.id,
        station: fuelStation.trim() || 'Highway Fuel Station',
        litres: Number(fuelLitres),
        amountInr: Number(fuelAmount),
      })
      setFuelLitres('')
      setFuelAmount('')
      setFuelStation('')
      Alert.alert('Fuel Logged', 'Fuel entry saved for fleet verification.')
      void loadDriverPortal()
    } catch (err) {
      Alert.alert('Fuel Error', err.response?.data?.error ?? 'Unable to log fuel.')
    }
  }

  const submitExpense = async () => {
    if (!Number(expAmount)) {
      Alert.alert('Amount Required', 'Enter a valid expense amount in INR.')
      return
    }
    try {
      await apiClient.post('/driver/expenses', {
        vehicleId: homeData?.assignedVehicle?.id,
        category: expCategory,
        amountInr: Number(expAmount),
        description: expNote.trim() || `${expCategory} claim`,
      })
      setExpAmount('')
      setExpNote('')
      Alert.alert('Expense Submitted', 'Submitted for owner approval (approval != reimbursement).')
      void loadDriverPortal()
    } catch (err) {
      Alert.alert('Expense Error', err.response?.data?.error ?? 'Unable to submit expense.')
    }
  }

  const submitInspection = async () => {
    if (!homeData?.assignedVehicle?.id) return
    try {
      await apiClient.post('/driver/inspections', {
        vehicleId: homeData.assignedVehicle.id,
        inspectionType: 'Pre-Trip DVIR',
        brakesOk: true,
        tyresOk: true,
        lightsOk: true,
        fluidLevelsOk: true,
        documentsPresent: true,
        odometerKm: Number(odoInput) || undefined,
      })
      Alert.alert('Pre-Trip DVIR Saved', 'Inspection recorded cleanly.')
      void loadDriverPortal()
    } catch (err) {
      Alert.alert('DVIR Error', err.response?.data?.error ?? 'Unable to save inspection.')
    }
  }

  const submitIssue = async () => {
    if (!issueTitle.trim() || !homeData?.assignedVehicle?.id) {
      Alert.alert('Issue Title Required', 'Describe the defect or roadside issue.')
      return
    }
    try {
      await apiClient.post('/driver/issues', {
        vehicleId: homeData.assignedVehicle.id,
        title: issueTitle.trim(),
        severity: 'medium',
      })
      setIssueTitle('')
      Alert.alert('Issue Reported', 'Maintenance team has been notified.')
    } catch (err) {
      Alert.alert('Issue Error', err.response?.data?.error ?? 'Unable to report issue.')
    }
  }

  const assignedVeh = homeData?.assignedVehicle

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.orgName} numberOfLines={1}>
            {organization?.name ?? 'DriveMitra'} · Driver Portal
          </Text>
          <Text style={styles.welcome} numberOfLines={1}>
            {homeData?.driver?.name ?? user?.fullName ?? 'Driver'}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setActiveTab(t.id)}
            style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDriverPortal} />}
      >
        {activeTab === 'home' && (
          <>
            <View style={styles.tripCard}>
              <Text style={styles.tripBadge}>Assigned Vehicle</Text>
              <Text style={styles.tripRoute}>
                {assignedVeh ? `${assignedVeh.registrationNumber} · ${assignedVeh.make} ${assignedVeh.model}` : 'No vehicle assigned'}
              </Text>
              {assignedVeh && (
                <Text style={styles.tripMeta}>
                  Odometer: {Number(assignedVeh.odometerKm ?? 0).toLocaleString('en-IN')} km · Health {assignedVeh.healthScore ?? '—'}%
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active &amp; Upcoming Trips ({trips.length})</Text>
              {trips.slice(0, 3).map((t) => (
                <View key={t.id} style={styles.moduleItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.moduleText}>{t.originAddress} → {t.destinationAddress}</Text>
                    <Text style={styles.tripSub}>{t.status} · {t.distanceKm} km</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {activeTab === 'trips' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assigned Trips &amp; Odometer Logging</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={odoInput}
              onChangeText={setOdoInput}
              placeholder="Enter actual odometer reading (km)"
              placeholderTextColor="#958777"
            />
            {trips.map((t) => (
              <View key={t.id} style={styles.tripBox}>
                <Text style={styles.moduleText}>{t.originAddress} → {t.destinationAddress}</Text>
                <Text style={styles.tripSub}>Status: {t.status} · Est {t.distanceKm} km</Text>
                <View style={styles.rowGap}>
                  {(t.status === 'planned' || t.status === 'Accepted' || t.status === 'Assigned') && (
                    <TouchableOpacity style={styles.primaryBtnSm} onPress={() => handleStartTrip(t.id)}>
                      <Text style={styles.primaryBtnText}>Start Trip</Text>
                    </TouchableOpacity>
                  )}
                  {(t.status === 'active' || t.status === 'In Progress') && (
                    <TouchableOpacity style={styles.primaryBtnSm} onPress={() => handleEndTrip(t.id)}>
                      <Text style={styles.primaryBtnText}>Complete Trip</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'fuel' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Log Fuel Refill</Text>
              <TextInput style={styles.input} placeholder="Station name" placeholderTextColor="#958777" value={fuelStation} onChangeText={setFuelStation} />
              <TextInput style={styles.input} placeholder="Litres" keyboardType="numeric" placeholderTextColor="#958777" value={fuelLitres} onChangeText={setFuelLitres} />
              <TextInput style={styles.input} placeholder="Amount (INR)" keyboardType="numeric" placeholderTextColor="#958777" value={fuelAmount} onChangeText={setFuelAmount} />
              <TouchableOpacity style={styles.primaryBtn} onPress={submitFuel}>
                <Text style={styles.primaryBtnText}>Save Fuel Entry</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Submit Trip Expense ({expenses.length} logged)</Text>
              <TextInput style={styles.input} placeholder="Category (toll/parking/food/repair)" placeholderTextColor="#958777" value={expCategory} onChangeText={setExpCategory} />
              <TextInput style={styles.input} placeholder="Amount (INR)" keyboardType="numeric" placeholderTextColor="#958777" value={expAmount} onChangeText={setExpAmount} />
              <TextInput style={styles.input} placeholder="Notes / Receipt ref" placeholderTextColor="#958777" value={expNote} onChangeText={setExpNote} />
              <TouchableOpacity style={styles.primaryBtn} onPress={submitExpense}>
                <Text style={styles.primaryBtnText}>Submit Expense</Text>
              </TouchableOpacity>
              {expenses.slice(0, 4).map((e) => (
                <View key={e.id} style={styles.moduleItem}>
                  <Text style={styles.moduleText}>{e.category} · ₹{e.amountInr}</Text>
                  <Text style={styles.tripSub}>{e.approvalStatus} / {e.paymentStatus}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {activeTab === 'inspect' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pre-Trip Vehicle Inspection (DVIR)</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={submitInspection}>
                <Text style={styles.primaryBtnText}>Sign &amp; Submit Pre-Trip DVIR</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Report Vehicle Issue</Text>
              <TextInput style={styles.input} placeholder="Describe defect or warning light" placeholderTextColor="#958777" value={issueTitle} onChangeText={setIssueTitle} />
              <TouchableOpacity style={styles.secondaryBtn} onPress={submitIssue}>
                <Text style={styles.secondaryBtnText}>Report Issue to Fleet Desk</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {activeTab === 'docs' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compliance &amp; Documents (Read-Only)</Text>
            <Text style={styles.tripMeta}>DL No: {docsData?.driverCompliance?.licenseNumber ?? '—'}</Text>
            <Text style={styles.tripMeta}>DL Expiry: {docsData?.driverCompliance?.licenseExpiry ?? '—'}</Text>
            <Text style={styles.tripMeta}>Insurance Expiry: {docsData?.vehicleCompliance?.insuranceExpiry ?? '—'}</Text>
            <Text style={styles.tripMeta}>Fitness / PUC: {docsData?.vehicleCompliance?.fitnessExpiry ?? '—'} / {docsData?.vehicleCompliance?.pucExpiry ?? '—'}</Text>
            <Text style={styles.tripSub}>Safety Score: {homeData?.driver?.safetyScore ?? '—'}/100 · Fuel Entries: {fuelLogs.length}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F8F6' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBE5DF',
  },
  headerText: { flex: 1 },
  orgName: { fontSize: 11, fontWeight: '800', color: '#6E5696', letterSpacing: 0.5, textTransform: 'uppercase' },
  welcome: { fontSize: 17, fontWeight: '800', color: '#362C24', marginTop: 1 },
  logoutBtn: {
    backgroundColor: '#FCECEB',
    borderWidth: 1,
    borderColor: '#D9786C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: { fontSize: 11, fontWeight: '700', color: '#B84E42' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBE5DF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F4F1EA',
  },
  tabBtnActive: { backgroundColor: '#6E5696', shadowColor: '#6E5696', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 11, fontWeight: '700', color: '#625346' },
  tabTextActive: { color: '#FFFFFF' },
  scroll: { padding: 16, gap: 14 },
  tripCard: {
    backgroundColor: '#EEE8F7',
    borderWidth: 1,
    borderColor: '#D3C4F0',
    borderRadius: 14,
    padding: 18,
    gap: 6,
    shadowColor: '#6E5696',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  tripBadge: { fontSize: 11, fontWeight: '800', color: '#6E5696', textTransform: 'uppercase', letterSpacing: 0.5 },
  tripRoute: { fontSize: 17, fontWeight: '800', color: '#362C24' },
  tripMeta: { fontSize: 12, fontWeight: '600', color: '#594A3D', marginTop: 2 },
  section: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBE5DF',
    borderRadius: 14,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#362C24' },
  input: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E2DCD5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#362C24',
  },
  primaryBtn: {
    backgroundColor: '#6E5696',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#6E5696',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnSm: {
    backgroundColor: '#6E5696',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  primaryBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#6E5696',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '800', color: '#6E5696' },
  tripBox: {
    borderWidth: 1,
    borderColor: '#E2DCD5',
    borderRadius: 10,
    padding: 14,
    gap: 8,
    backgroundColor: '#FAFAFA',
  },
  rowGap: { flexDirection: 'row', gap: 10, marginTop: 4 },
  moduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F1EA',
  },
  moduleText: { fontSize: 13, fontWeight: '700', color: '#362C24' },
  tripSub: { fontSize: 11, fontWeight: '600', color: '#958777', marginTop: 3 },
})
