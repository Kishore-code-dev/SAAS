import React, { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFleetStore } from '../../store/fleetStore'

export default function MobileVehiclesScreen() {
  const { vehicles, isLoading, loadFleetData } = useFleetStore()
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (vehicles.length === 0) {
      loadFleetData()
    }
  }, [])

  const filtered = vehicles.filter((v) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      v.registrationNumber?.toLowerCase().includes(q) ||
      `${v.make ?? ''} ${v.model ?? ''}`.toLowerCase().includes(q)
    )
  })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fleet Vehicles ({filtered.length})</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search registration or model..."
          placeholderTextColor="#958777"
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={loadFleetData}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.reg}>{item.registrationNumber}</Text>
              <Text style={styles.status}>{item.operationStatus ?? 'active'}</Text>
            </View>
            <Text style={styles.model}>
              {item.make} {item.model} · {item.fuelType}
            </Text>
            <View style={[styles.rowBetween, styles.metaRow]}>
              <Text style={styles.metaText}>
                Odometer: {(item.odometerKm ?? 0).toLocaleString('en-IN')} km
              </Text>
              <Text style={styles.healthText}>Health: {item.healthScore ?? 0}%</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#625346' },
  searchInput: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#625346',
  },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reg: { fontSize: 15, fontWeight: '800', color: '#625346' },
  status: { fontSize: 11, fontWeight: '700', color: '#6E5696', textTransform: 'capitalize' },
  model: { fontSize: 12, color: '#958777' },
  metaRow: { marginTop: 6 },
  metaText: { fontSize: 12, fontWeight: '600', color: '#625346' },
  healthText: { fontSize: 12, fontWeight: '700', color: '#4D6E4A' },
})
