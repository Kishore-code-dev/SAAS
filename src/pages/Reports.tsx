import React, { useState } from 'react'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { REPORT_CATEGORIES } from '../data/seedOrganizations'
import { useFleet } from '../hooks/useFleet'
import { generateCsvContent } from '../utils/intelligenceEngine'
import { canPerformAction } from '../utils/rbac'
import { formatDateTime, formatInr } from '../components/ui/EnterprisePrimitives'

function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildExcelSpreadsheetXml(
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): string {
  const safeSheet = escapeXml(sheetName.replace(/[\\/?*[\]:]/g, '').slice(0, 30) || 'Report')
  const headerXml = `<Row>${headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('')}</Row>`
  const rowsXml = rows
    .map(
      (r) =>
        `<Row>${r
          .map((cell) => {
            const isNum = typeof cell === 'number' && Number.isFinite(cell)
            return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(cell)}</Data></Cell>`
          })
          .join('')}</Row>`,
    )
    .join('')

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${safeSheet}">
    <Table>${headerXml}${rowsXml}</Table>
  </Worksheet>
</Workbook>`
}

export default function Reports() {
  const {
    activeOrganization,
    activeRole,
    reportingPeriod,
    vehicles,
    drivers,
    trips,
    fuelTransactions,
    maintenanceRecords,
    workOrders,
    predictions,
    riskAssessments,
    financialSummary,
    reports,
    recordReportGeneration,
  } = useFleet()

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(REPORT_CATEGORIES[0].id)
  const [vehicleFilterId, setVehicleFilterId] = useState<string>('all')

  const canExport = canPerformAction(activeRole, 'export_reports')

  const buildReportRows = (categoryId: string): { headers: string[]; rows: Array<Array<string | number>> } => {
    const filterVeh = <T extends { vehicleId?: string; id?: string }>(items: T[], key: 'vehicleId' | 'id' = 'vehicleId') =>
      vehicleFilterId === 'all' ? items : items.filter((i) => i[key] === vehicleFilterId)

    switch (categoryId) {
      case 'predictive_maintenance':
        return {
          headers: ['Vehicle', 'Component', '5-Area Scope', 'Priority', 'Issue', 'Est Window Days', 'Confidence', 'Repair Cost (INR)', 'Delay Cost (INR)', 'Est Savings (INR)', 'Status'],
          rows: filterVeh(predictions).map((p) => {
            const v = vehicles.find((x) => x.id === p.vehicleId)
            return [
              v?.registrationNumber ?? p.vehicleId,
              p.componentName,
              p.healthArea ?? 'Vehicle Health',
              p.insufficientData ? 'insufficient_data' : p.priority,
              p.predictedIssue,
              p.insufficientData ? 'N/A' : `${p.earliestWindowDays}-${p.latestWindowDays}`,
              p.insufficientData ? '0%' : `${Math.round(p.confidenceScore * 100)}%`,
              p.insufficientData ? 0 : p.repairCostInr,
              p.insufficientData ? 0 : p.delayCostInr,
              p.insufficientData ? 0 : p.potentialSavingsInr,
              p.status,
            ]
          }),
        }
      case 'driver_safety':
        return {
          headers: ['Driver', 'DL Number', 'DL Classes', 'DL Expiry', 'Assigned Vehicle', 'Safety Score', 'Total Trips', 'Total Distance (km)', 'Operational Status'],
          rows: drivers.map((d) => {
            const v = vehicles.find((x) => x.id === d.assignedVehicleId)
            return [
              d.name,
              d.licenseNumber,
              (d.licenseCategories ?? ['TRANS']).join(', '),
              d.licenseExpiry,
              v?.registrationNumber ?? 'Unassigned',
              d.safetyScore,
              d.totalTrips,
              d.totalDistanceKm,
              d.operationalStatus,
            ]
          }),
        }
      case 'trip_operations':
        return {
          headers: ['Trip ID', 'Vehicle', 'Origin', 'Destination', 'Distance (km)', 'Duration (min)', 'Avg Speed', 'Status'],
          rows: filterVeh(trips).map((t) => {
            const v = vehicles.find((x) => x.id === t.vehicleId)
            return [t.id, v?.registrationNumber ?? t.vehicleId, t.originAddress, t.destinationAddress, t.distanceKm, t.durationMinutes, t.avgSpeedKmh, t.status]
          }),
        }
      case 'fuel_efficiency':
        return {
          headers: ['Vehicle', 'Station', 'Source', 'Volume', 'Amount (INR)', 'Odometer (km)', 'Status'],
          rows: filterVeh(fuelTransactions).map((f) => {
            const v = vehicles.find((x) => x.id === f.vehicleId)
            return [v?.registrationNumber ?? f.vehicleId, f.station, f.entrySource, f.litersOrKwh, f.amountInr, f.odometerKm, f.verificationStatus]
          }),
        }
      case 'financial_tco':
        return {
          headers: ['Registration', 'Powertrain', 'Fuel Spend (INR)', 'Maint Spend (INR)', 'Total Spend (INR)', 'Est Distance (km)', 'Cost per km (INR)'],
          rows: financialSummary.vehicleCostBreakdown.map((r) => [
            r.registrationNumber,
            r.powertrain,
            r.fuelSpendInr,
            r.maintenanceSpendInr,
            r.totalSpendInr,
            r.distanceKm,
            r.costPerKmInr,
          ]),
        }
      case 'risk_compliance':
        return {
          headers: ['Vehicle', 'Category', 'Severity', 'Title', 'Confidence', 'Insufficient Data'],
          rows: filterVeh(riskAssessments).map((r) => [
            r.vehicleRegistration,
            r.category,
            r.severity,
            r.title,
            `${r.confidencePct}%`,
            r.insufficientData ? 'Yes' : 'No',
          ]),
        }
      case 'service_history':
        return {
          headers: ['Vehicle', 'Record / WO #', 'Component / Summary', 'Workshop / Center', 'Cost (INR)', 'Status', 'Date'],
          rows: [
            ...filterVeh(maintenanceRecords).map((m) => {
              const v = vehicles.find((x) => x.id === m.vehicleId)
              return [v?.registrationNumber ?? m.vehicleId, m.serviceType, m.componentName, m.serviceCenter, m.costInr, m.status, m.performedAt]
            }),
            ...filterVeh(workOrders).map((wo) => {
              const v = vehicles.find((x) => x.id === wo.vehicleId)
              return [v?.registrationNumber ?? wo.vehicleId, wo.workOrderNumber, wo.title, wo.workshopName || 'Internal Bay', wo.totalCostInr, wo.status, wo.createdAt]
            }),
          ],
        }
      case 'fleet_utilization':
      default:
        return {
          headers: ['Registration', 'Make & Model', 'Powertrain', 'Operation Status', 'Odometer (km)', 'Health Score %', 'City'],
          rows: filterVeh(vehicles, 'id').map((v) => [
            v.registrationNumber,
            `${v.make} ${v.model}`,
            v.powertrain,
            v.operationStatus,
            v.odometerKm,
            v.healthScore,
            v.cityName,
          ]),
        }
    }
  }

  const activeCategory = REPORT_CATEGORIES.find((c) => c.id === selectedCategoryId) ?? REPORT_CATEGORIES[0]
  const preview = buildReportRows(selectedCategoryId)

  const handleDownloadCsv = (categoryId: string, title: string) => {
    if (!canExport) {
      toast.error('Your current role does not allow report exports.')
      return
    }
    const { headers, rows } = buildReportRows(categoryId)
    const csv = generateCsvContent(headers, rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeOrganization.code.toLowerCase()}-${categoryId}-${reportingPeriod}.csv`
    a.click()
    URL.revokeObjectURL(url)
    recordReportGeneration({
      categoryId,
      title,
      period: reportingPeriod,
      generatedBy: activeRole.replace('_', ' '),
      format: 'CSV',
      rowCount: rows.length,
    })
    toast.success(`Downloaded CSV: ${title} (${rows.length} rows).`)
  }

  const handleDownloadXlsx = (categoryId: string, title: string) => {
    if (!canExport) {
      toast.error('Your current role does not allow report exports.')
      return
    }
    const { headers, rows } = buildReportRows(categoryId)
    const xml = buildExcelSpreadsheetXml(title, headers, rows)
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeOrganization.code.toLowerCase()}-${categoryId}-${reportingPeriod}.xls`
    a.click()
    URL.revokeObjectURL(url)
    recordReportGeneration({
      categoryId,
      title,
      period: reportingPeriod,
      generatedBy: activeRole.replace('_', ' '),
      format: 'XLSX',
      rowCount: rows.length,
    })
    toast.success(`Downloaded Excel workbook: ${title} (${rows.length} rows).`)
  }

  const handlePrintPdf = () => {
    if (!canExport) {
      toast.error('Your current role does not allow report exports.')
      return
    }
    recordReportGeneration({
      categoryId: activeCategory.id,
      title: activeCategory.title,
      period: reportingPeriod,
      generatedBy: activeRole.replace('_', ' '),
      format: 'PDF',
      rowCount: preview.rows.length,
    })
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h1 className="dm-page-title">Reports & Exports</h1>
          <p className="text-sm text-[#958777] mt-1">
            {activeOrganization.name} · 8 standardized CSV, Excel, & printable executive report categories
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="report-veh-filter" className="sr-only">Filter by vehicle</label>
          <select
            id="report-veh-filter"
            value={vehicleFilterId}
            onChange={(e) => setVehicleFilterId(e.target.value)}
            className="dm-input py-1.5 text-xs w-auto"
          >
            <option value="all">All Organization Vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.registrationNumber}</option>
            ))}
          </select>
          {canExport && (
            <>
              <button
                type="button"
                onClick={() => handleDownloadCsv(activeCategory.id, activeCategory.title)}
                className="btn-primary text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => handleDownloadXlsx(activeCategory.id, activeCategory.title)}
                className="btn-secondary text-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#4D6E4A]" />
                Export Excel
              </button>
              <button type="button" onClick={handlePrintPdf} className="btn-secondary text-xs">
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* 8 Report Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        {REPORT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`enterprise-card p-4 text-left transition-colors ${
              selectedCategoryId === cat.id ? 'border-[#B8A3D9] bg-[#EEE8F7]' : 'hover:bg-[#FFFFFF]'
            }`}
          >
            <h2 className="font-bold text-sm text-[#625346]">{cat.title}</h2>
            <p className="text-xs text-[#958777] mt-1 line-clamp-2">{cat.description}</p>
          </button>
        ))}
      </div>

      {/* Live Printable Preview Table */}
      <div className="enterprise-card overflow-hidden">
        <div className="px-5 py-4 bg-[#FFFFFF] border-b border-[#E5E5E5] flex items-center justify-between">
          <div>
            <h2 className="dm-card-title">{activeCategory.title}</h2>
            <p className="text-xs text-[#958777]">
              {activeOrganization.name} · Period {reportingPeriod.toUpperCase()} · Operating Spend {formatInr(financialSummary.operatingExpenditureInr)}
            </p>
          </div>
          <span className="text-xs font-semibold text-[#958777] tabular-nums">{preview.rows.length} rows</span>
        </div>
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                {preview.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r, idx) => (
                <tr key={idx}>
                  {r.map((cell, cIdx) => (
                    <td key={cIdx} className="tabular-nums text-xs">{String(cell)}</td>
                  ))}
                </tr>
              ))}
              {preview.rows.length === 0 && (
                <tr>
                  <td colSpan={preview.headers.length} className="text-center text-[#958777] py-8">
                    No records available for selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export History Scoped to Active Org */}
      <div className="enterprise-card p-5 no-print">
        <h2 className="dm-card-title text-sm mb-3">
          Report Generation History ({reports.length})
        </h2>
        <div className="divide-y divide-[#E5E5E5]/70 text-xs">
          {reports.map((rep) => (
            <div key={rep.id} className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-[#625346]">{rep.title}</p>
                <p className="text-[#958777]">
                  {rep.format} · {rep.rowCount} rows · Period {rep.period.toUpperCase()} · {rep.generatedBy}
                </p>
              </div>
              <span className="tabular-nums text-[#958777]">
                {formatDateTime(rep.generatedAt, activeOrganization.timezone)}
              </span>
            </div>
          ))}
          {reports.length === 0 && (
            <p className="text-[#958777] py-4 text-center">No exports generated yet in this organization.</p>
          )}
        </div>
      </div>
    </div>
  )
}

