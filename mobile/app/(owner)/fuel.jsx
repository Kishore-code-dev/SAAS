import React, { useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { useFleetStore } from '../../store/fleetStore'

export default function MobileFuelScreen() {
  const { vehicles, fuelTransactions, submitFuelEntry, pendingSync } = useFleetStore()
  const [liters, setLiters] = useState('42.5')
  const [amount, setAmount] = useState('4050')
  const [station, setStation] = useState('IndianOil Highway Pump')
  const [receiptUri, setReceiptUri] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const targetVehicle = vehicles[0]

  const captureReceipt = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Camera Permission', 'Allow camera access to photograph the fuel pump receipt.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 })
    if (!result.canceled && result.assets?.[0]?.uri) {
      setReceiptUri(result.assets[0].uri)
    }
  }

  const handleSubmit = async () => {
    const qty = Number(liters)
    const total = Number(amount)
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(total) || total <= 0) {
      Alert.alert('Invalid Fuel Entry', 'Enter quantity and total amount greater than zero.')
      return
    }
    setSubmitting(true)
    const res = await submitFuelEntry({
      vehicleId: targetVehicle?.id ?? 'veh-1',
      litersOrKwh: qty,
      amountInr: total,
      station: station.trim() || 'Fuel Station',
      receiptUri,
    })
    setSubmitting(false)
    Alert.alert(
      res.synced ? 'Fuel Logged' : 'Queued Offline',
      res.synced
        ? 'Fuel entry uploaded to DriveMitra cloud.'
        : 'Saved to local SQLite queue and will sync automatically when online.',
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Fuel &amp; Receipt Capture</Text>
        <Text style={styles.subtitle}>
          Vehicle: {targetVehicle?.registrationNumber ?? 'Primary Fleet Vehicle'} · Pending sync: {pendingSync.length}
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Fuel Station</Text>
          <TextInput value={station} onChangeText={setStation} style={styles.input} />

          <Text style={styles.label}>Quantity (Liters / kWh)</Text>
          <TextInput value={liters} onChangeText={setLiters} keyboardType="decimal-pad" style={styles.input} />

          <Text style={styles.label}>Total Amount (INR)</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" style={styles.input} />

          <TouchableOpacity style={styles.cameraBtn} onPress={captureReceipt}>
            <Text style={styles.cameraBtnText}>
              {receiptUri ? 'Receipt Photo Attached ✓' : 'Capture Pump Receipt Photo'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.submitBtnText}>
              {submitting ? 'Submitting...' : 'Save Fuel Entry'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Verified Fuel Entries</Text>
          {fuelTransactions.slice(0, 5).map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View>
                <Text style={styles.txStation}>{tx.station}</Text>
                <Text style={styles.txMeta}>{tx.litersOrKwh} units · {(tx.timestamp ?? '').slice(0, 10)}</Text>
              </View>
              <Text style={styles.txAmount}>₹{tx.amountInr}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  scroll: { padding: 16, gap: 14 },
  title: { fontSize: 18, fontWeight: '800', color: '#625346' },
  subtitle: { fontSize: 12, color: '#958777' },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  label: { fontSize: 12, fontWeight: '700', color: '#625346' },
  input: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#625346',
  },
  cameraBtn: {
    backgroundColor: '#EEE8F7',
    borderWidth: 1,
    borderColor: '#B8A3D9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cameraBtnText: { fontSize: 13, fontWeight: '700', color: '#6E5696' },
  submitBtn: {
    backgroundColor: '#E8C65A',
    borderWidth: 1,
    borderColor: '#D8B442',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: '#625346' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#625346' },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FAFAFA',
  },
  txStation: { fontSize: 13, fontWeight: '700', color: '#625346' },
  txMeta: { fontSize: 11, color: '#958777' },
  txAmount: { fontSize: 13, fontWeight: '800', color: '#625346' },
})
