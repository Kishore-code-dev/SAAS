import fs from 'node:fs'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import PDFDocument from 'pdfkit'

export type SchemaDomainGroup =
  | 'Platform Auth, Tenants & Documents'
  | 'Core Fleet Operations (25 Tables)'
  | 'Fleetio Extension Modules (12 Tables)'
  | 'Vehicle Finance & EMI Management (8 Tables)'

export interface ColumnMeta {
  cid: number
  name: string
  type: string
  notNull: boolean
  defaultValue: string | null
  primaryKey: boolean
  foreignKeyRef: string | null
}

export interface ForeignKeyMeta {
  from: string
  toTable: string
  toColumn: string
  onDelete: string
}

export interface IndexMeta {
  name: string
  unique: boolean
  columns: string[]
}

export interface TableMeta {
  name: string
  group: SchemaDomainGroup
  rowCount: number
  columns: ColumnMeta[]
  foreignKeys: ForeignKeyMeta[]
  indexes: IndexMeta[]
}

export interface TypeDefMeta {
  sourceFile: string
  kind: 'interface' | 'type'
  name: string
  fields: Array<{ name: string; definition: string }>
  summaryLine?: string
}

export interface SchemaSnapshot {
  generatedAt: string
  totalTables: number
  totalColumns: number
  totalForeignKeys: number
  totalIndexes: number
  groups: Record<SchemaDomainGroup, TableMeta[]>
  tables: TableMeta[]
  typeDefinitions: TypeDefMeta[]
}

const GROUP_ORDER: SchemaDomainGroup[] = [
  'Platform Auth, Tenants & Documents',
  'Core Fleet Operations (25 Tables)',
  'Fleetio Extension Modules (12 Tables)',
  'Vehicle Finance & EMI Management (8 Tables)',
]

const PLATFORM_TABLES = new Set([
  'users',
  'auth_sessions',
  'password_reset_tokens',
  'organizations',
  'org_fleet_blobs',
  'platform_admin_audit_logs',
  'document_files',
])

const EXTENSION_TABLES = new Set([
  'fleet_tools',
  'fleet_warranties',
  'fleet_custom_records',
  'fleet_service_tasks',
  'fleet_service_programs',
  'fleet_inspection_forms',
  'fleet_inspection_schedules',
  'fleet_recalls',
  'fleet_api_keys',
  'fleet_webhooks',
  'fleet_custom_dashboards',
  'fleet_workspace_settings',
])

const FINANCE_TABLES = new Set([
  'finance_institutions',
  'vehicle_finance_records',
  'finance_emi_instalments',
  'finance_payments',
  'finance_documents',
  'finance_notification_settings',
  'finance_alerts',
  'finance_update_history',
])

function classifyTable(name: string): SchemaDomainGroup {
  if (PLATFORM_TABLES.has(name)) return 'Platform Auth, Tenants & Documents'
  if (EXTENSION_TABLES.has(name)) return 'Fleetio Extension Modules (12 Tables)'
  if (FINANCE_TABLES.has(name)) return 'Vehicle Finance & EMI Management (8 Tables)'
  return 'Core Fleet Operations (25 Tables)'
}

export function extractTypeDefinitionsFromFile(relPath: string): TypeDefMeta[] {
  const absPath = path.resolve(process.cwd(), relPath)
  if (!fs.existsSync(absPath)) return []
  const content = fs.readFileSync(absPath, 'utf8')
  const lines = content.split(/\r?\n/)
  const results: TypeDefMeta[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    const ifaceMatch = line.match(/^export\s+interface\s+([A-Za-z0-9_]+)(?:\s+extends\s+([^{]+))?\s*\{/)
    if (ifaceMatch) {
      const name = ifaceMatch[1]
      const fields: Array<{ name: string; definition: string }> = []
      let depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
      i += 1
      while (i < lines.length && depth > 0) {
        const inner = lines[i].trim()
        depth += (inner.match(/\{/g) || []).length - (inner.match(/\}/g) || []).length
        if (depth >= 1 && inner && !inner.startsWith('//') && !inner.startsWith('*') && !inner.startsWith('/*')) {
          const propMatch = inner.match(/^([A-Za-z0-9_?]+)\s*:\s*(.+?);?$/)
          if (propMatch && depth === 1) {
            fields.push({ name: propMatch[1], definition: propMatch[2] })
          }
        }
        i += 1
      }
      results.push({ sourceFile: relPath, kind: 'interface', name, fields })
      continue
    }

    const typeMatch = line.match(/^export\s+type\s+([A-Za-z0-9_]+)\s*=\s*(.*)$/)
    if (typeMatch) {
      const name = typeMatch[1]
      let def = typeMatch[2].trim()
      if (!def || def.endsWith('|') || def.endsWith('&')) {
        const parts: string[] = def ? [def] : []
        i += 1
        while (i < lines.length) {
          const next = lines[i].trim()
          if (!next || next.startsWith('export ') || next.startsWith('import ')) break
          parts.push(next)
          if (!next.endsWith('|') && !next.endsWith('&') && !next.startsWith('|')) {
            // peek if next line continues union
            const peek = lines[i + 1]?.trim() ?? ''
            if (!peek.startsWith('|') && !peek.startsWith('&')) {
              i += 1
              break
            }
          }
          i += 1
        }
        def = parts.join(' ').replace(/\s+/g, ' ').replace(/^\|\s*/, '')
      } else {
        i += 1
      }
      results.push({ sourceFile: relPath, kind: 'type', name, fields: [], summaryLine: def })
      continue
    }

    i += 1
  }

  return results
}

export function extractSchemaSnapshot(db: DatabaseSync): SchemaSnapshot {
  const tableRows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string }>

  const groups: Record<SchemaDomainGroup, TableMeta[]> = {
    'Platform Auth, Tenants & Documents': [],
    'Core Fleet Operations (25 Tables)': [],
    'Fleetio Extension Modules (12 Tables)': [],
    'Vehicle Finance & EMI Management (8 Tables)': [],
  }

  const tables: TableMeta[] = []
  let totalColumns = 0
  let totalForeignKeys = 0
  let totalIndexes = 0

  for (const row of tableRows) {
    const tableName = row.name
    const safeIdent = tableName.replace(/"/g, '""')

    const fkRows = db.prepare(`PRAGMA foreign_key_list("${safeIdent}")`).all() as Array<Record<string, unknown>>
    const foreignKeys: ForeignKeyMeta[] = fkRows.map((fk) => ({
      from: String(fk.from),
      toTable: String(fk.table),
      toColumn: String(fk.to),
      onDelete: String(fk.on_delete || 'NO ACTION'),
    }))
    const fkMap = new Map<string, string>()
    for (const fk of foreignKeys) {
      fkMap.set(fk.from, `${fk.toTable}.${fk.toColumn} (${fk.onDelete})`)
    }

    const colRows = db.prepare(`PRAGMA table_info("${safeIdent}")`).all() as Array<Record<string, unknown>>
    const columns: ColumnMeta[] = colRows.map((col) => {
      const colName = String(col.name)
      return {
        cid: Number(col.cid),
        name: colName,
        type: String(col.type || 'TEXT'),
        notNull: Number(col.notnull) === 1,
        defaultValue: col.dflt_value != null ? String(col.dflt_value) : null,
        primaryKey: Number(col.pk) > 0,
        foreignKeyRef: fkMap.get(colName) ?? null,
      }
    })

    const idxRows = db.prepare(`PRAGMA index_list("${safeIdent}")`).all() as Array<Record<string, unknown>>
    const indexes: IndexMeta[] = []
    for (const idx of idxRows) {
      const idxName = String(idx.name)
      if (idxName.startsWith('sqlite_autoindex_')) continue
      const safeIdx = idxName.replace(/"/g, '""')
      const idxCols = db.prepare(`PRAGMA index_info("${safeIdx}")`).all() as Array<Record<string, unknown>>
      indexes.push({
        name: idxName,
        unique: Number(idx.unique) === 1,
        columns: idxCols.map((c) => String(c.name)),
      })
    }

    const countRow = db.prepare(`SELECT COUNT(*) AS count FROM "${safeIdent}"`).get() as { count: number }
    const group = classifyTable(tableName)
    const meta: TableMeta = {
      name: tableName,
      group,
      rowCount: Number(countRow?.count ?? 0),
      columns,
      foreignKeys,
      indexes,
    }

    tables.push(meta)
    groups[group].push(meta)
    totalColumns += columns.length
    totalForeignKeys += foreignKeys.length
    totalIndexes += indexes.length
  }

  const typeDefinitions = [
    ...extractTypeDefinitionsFromFile('src/types/fleet.ts'),
    ...extractTypeDefinitionsFromFile('src/types/finance.ts'),
  ]

  return {
    generatedAt: new Date().toISOString(),
    totalTables: tables.length,
    totalColumns,
    totalForeignKeys,
    totalIndexes,
    groups,
    tables,
    typeDefinitions,
  }
}

const COLORS = {
  forest: '#0D3B26',
  forestSoft: '#E8F5EE',
  plum: '#6E5696',
  plumSoft: '#EEE8F7',
  espresso: '#625346',
  taupe: '#958777',
  border: '#E5E5E5',
  zebra: '#FAFAFA',
  white: '#FFFFFF',
  amber: '#8B6B16',
}

export async function generateFullSchemaPdfBuffer(
  db: DatabaseSync,
  options?: { organizationName?: string; organizationCode?: string },
): Promise<Buffer> {
  const snapshot = extractSchemaSnapshot(db)

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 48, bottom: 48, left: 42, right: 42 },
      bufferPages: true,
      info: {
        Title: 'DriveMitra — Complete SQLite Database & TypeScript Data Structures',
        Author: 'DriveMitra Platform Architecture',
        Subject: 'Normalized Relational Database Schema, ER Constraints, TypeScript Interfaces & REST Endpoints',
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const leftX = doc.page.margins.left
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 18

    const ensureSpace = (neededHeight: number) => {
      if (doc.y + neededHeight > bottomLimit) {
        doc.addPage()
      }
    }

    const drawSectionBanner = (kicker: string, title: string, subtitle?: string) => {
      doc.font('Helvetica-Bold').fontSize(13)
      const titleH = doc.heightOfString(title, { width: pageWidth - 24 })
      let subH = 0
      if (subtitle) {
        doc.font('Helvetica').fontSize(8.5)
        subH = doc.heightOfString(subtitle, { width: pageWidth - 24 })
      }
      const bannerH = 22 + titleH + (subtitle ? subH + 6 : 4)
      ensureSpace(bannerH + 12)
      doc.moveDown(0.3)
      const startY = doc.y
      doc.save()
      doc.roundedRect(leftX, startY, pageWidth, bannerH, 6).fillAndStroke(COLORS.plumSoft, '#DDD3ED')
      doc.fillColor(COLORS.plum).font('Helvetica-Bold').fontSize(8).text(kicker.toUpperCase(), leftX + 12, startY + 7, { width: pageWidth - 24, lineBreak: false })
      const titleY = startY + 18
      doc.fillColor(COLORS.espresso).font('Helvetica-Bold').fontSize(13).text(title, leftX + 12, titleY, { width: pageWidth - 24 })
      if (subtitle) {
        doc.fillColor(COLORS.taupe).font('Helvetica').fontSize(8.5).text(subtitle, leftX + 12, titleY + titleH + 3, { width: pageWidth - 24 })
      }
      doc.restore()
      doc.y = startY + bannerH + 8
    }

    // ===================== COVER / EXECUTIVE SUMMARY =====================
    doc.save()
    doc.roundedRect(leftX, 48, pageWidth, 108, 8).fill(COLORS.forest)
    doc.fillColor('#D8EADF').font('Helvetica-Bold').fontSize(9).text('DRIVEMITRA ENTERPRISE FLEET & FINANCE ARCHITECTURE', leftX + 18, 66)
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(20).text('Complete Database & Data Structures', leftX + 18, 82)
    doc.fillColor('#CBE4D6').font('Helvetica').fontSize(9.5).text(
      `Normalized SQLite Relational Schema (${snapshot.totalTables} Tables), Foreign Key Graph, TypeScript Domain Models & REST API`,
      leftX + 18,
      110,
      { width: pageWidth - 36 },
    )
    doc.fillColor('#A9D1BB').font('Helvetica').fontSize(8).text(
      `Generated: ${snapshot.generatedAt.slice(0, 19).replace('T', ' ')} UTC  |  Engine: SQLite (WAL + Foreign Keys ON)${options?.organizationName ? `  |  Tenant: ${options.organizationName} (${options.organizationCode ?? ''})` : ''}`,
      leftX + 18,
      134,
      { width: pageWidth - 36 },
    )
    doc.restore()
    doc.y = 172

    // KPI Summary Strip
    const kpis = [
      { label: 'SQLite Tables', value: String(snapshot.totalTables), sub: 'Normalized Relational' },
      { label: 'Total Columns', value: String(snapshot.totalColumns), sub: 'Typed & Constrained' },
      { label: 'Foreign Keys', value: String(snapshot.totalForeignKeys), sub: 'Cascade Enforced' },
      { label: 'TS Models', value: String(snapshot.typeDefinitions.length), sub: 'Interfaces & Unions' },
    ]
    const kpiTopY = doc.y
    const gap = 8
    const boxW = (pageWidth - gap * 3) / 4
    kpis.forEach((kpi, idx) => {
      const bx = leftX + idx * (boxW + gap)
      doc.save()
      doc.roundedRect(bx, kpiTopY, boxW, 52, 6).fillAndStroke(COLORS.zebra, COLORS.border)
      doc.fillColor(COLORS.taupe).font('Helvetica-Bold').fontSize(7.5).text(kpi.label.toUpperCase(), bx + 10, kpiTopY + 8, { width: boxW - 20, lineBreak: false })
      doc.fillColor(COLORS.forest).font('Helvetica-Bold').fontSize(16).text(kpi.value, bx + 10, kpiTopY + 20, { width: boxW - 20, lineBreak: false })
      doc.fillColor(COLORS.espresso).font('Helvetica').fontSize(7.5).text(kpi.sub, bx + 10, kpiTopY + 39, { width: boxW - 20, lineBreak: false })
      doc.restore()
    })
    doc.y = kpiTopY + 64

    // Architecture & Multi-Tenancy Overview
    drawSectionBanner(
      'Section 1 · Architecture & ER Hierarchy',
      'Multi-Tenant Relational Data Model & Cascade Boundaries',
      'Strict organization_id isolation across Core Fleet, Fleetio Modules, and Vehicle Finance subsystems',
    )

    const erLines: Array<[string, string]> = [
      ['Tenant Root', 'organizations (PK: id) -> cascades ON DELETE CASCADE to all 25 fleet_*, 12 extension, and 8 finance tables'],
      ['Auth & RBAC', 'users -> auth_sessions, password_reset_tokens; 6 roles (platform_admin, org_admin, fleet_manager, maintenance, finance, viewer)'],
      ['Vehicle Aggregate', 'fleet_vehicles (PK: id) -> fleet_vehicle_components (health/wear) & fleet_tyre_positions (axle/tread)'],
      ['Driver & Trips', 'fleet_drivers -> fleet_driver_events, fleet_driver_assignments, fleet_trips, fleet_fuel_transactions'],
      ['Maintenance Loop', 'fleet_inspections -> fleet_small_issues -> fleet_work_orders -> fleet_maintenance_records + fleet_parts_inventory'],
      ['Finance Aggregate', 'vehicle_finance_records -> finance_emi_instalments -> finance_payments + finance_documents (masked by RBAC)'],
      ['Extension Modules', 'fleet_tools, fleet_warranties, fleet_custom_records, service_tasks/programs, inspection_forms/schedules, recalls, api_keys, webhooks, dashboards, workspace_settings'],
    ]

    for (const [label, desc] of erLines) {
      doc.font('Helvetica-Bold').fontSize(8.5)
      const labelH = doc.heightOfString(`• ${label}:`, { width: 105 })
      doc.font('Helvetica').fontSize(8.5)
      const descH = doc.heightOfString(desc, { width: pageWidth - 116 })
      const rowH = Math.max(labelH, descH)
      ensureSpace(rowH + 6)
      const ry = doc.y
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.forest).text(`• ${label}:`, leftX + 4, ry, { width: 105 })
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.espresso).text(desc, leftX + 112, ry, { width: pageWidth - 116 })
      doc.y = ry + rowH + 4
    }

    // Domain Table Inventory Matrix
    ensureSpace(80)
    doc.moveDown(0.3)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.espresso).text('Domain Table Distribution', leftX, doc.y)
    doc.moveDown(0.3)
    for (const g of GROUP_ORDER) {
      const list = snapshot.groups[g]
      const prefix = `${g} (${list.length}): `
      const tableNames = list.map((t) => t.name).join(', ')
      doc.font('Helvetica').fontSize(8)
      const lineH = doc.heightOfString(`${prefix}${tableNames}`, { width: pageWidth - 12 })
      ensureSpace(lineH + 6)
      const gy = doc.y
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.plum).text(prefix, leftX + 6, gy, { continued: true, width: pageWidth - 12 })
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.espresso).text(tableNames, { width: pageWidth - 12 })
      doc.y = Math.max(doc.y, gy + lineH) + 3
    }

    // ===================== SECTION 2: COMPLETE TABLE-BY-TABLE SCHEMA =====================
    for (const groupName of GROUP_ORDER) {
      const groupTables = snapshot.groups[groupName]
      if (!groupTables.length) continue
      doc.addPage()
      drawSectionBanner(
        'Section 2 · Normalized SQLite Tables',
        groupName,
        `${groupTables.length} relational tables with column types, keys, defaults, indexes & foreign key cascades`,
      )

      for (const tbl of groupTables) {
        ensureSpace(78)
        const headerY = doc.y
        doc.save()
        doc.roundedRect(leftX, headerY, pageWidth, 24, 4).fillAndStroke(COLORS.forestSoft, '#B7DEC9')
        doc.fillColor(COLORS.forest).font('Helvetica-Bold').fontSize(10).text(tbl.name, leftX + 10, headerY + 6, { width: 260 })
        doc.fillColor(COLORS.espresso).font('Helvetica').fontSize(8).text(
          `${tbl.columns.length} cols  ·  ${tbl.foreignKeys.length} FK  ·  ${tbl.indexes.length} idx  ·  ${tbl.rowCount} live rows`,
          leftX + pageWidth - 230,
          headerY + 7,
          { width: 220, align: 'right' },
        )
        doc.restore()
        doc.y = headerY + 27

        // Column Table Header
        const colWidths = [148, 60, 48, 52, pageWidth - 148 - 60 - 48 - 52]
        const renderColHeader = () => {
          const hy = doc.y
          doc.save()
          doc.rect(leftX, hy, pageWidth, 16).fill('#F2EFEA')
          doc.fillColor(COLORS.espresso).font('Helvetica-Bold').fontSize(7.5)
          doc.text('COLUMN', leftX + 6, hy + 4, { width: colWidths[0] - 8 })
          doc.text('TYPE', leftX + colWidths[0], hy + 4, { width: colWidths[1] - 4 })
          doc.text('KEY', leftX + colWidths[0] + colWidths[1], hy + 4, { width: colWidths[2] - 4 })
          doc.text('NULL', leftX + colWidths[0] + colWidths[1] + colWidths[2], hy + 4, { width: colWidths[3] - 4 })
          doc.text('FOREIGN KEY / DEFAULT', leftX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], hy + 4, { width: colWidths[4] - 6 })
          doc.restore()
          doc.y = hy + 16
        }

        renderColHeader()

        tbl.columns.forEach((col, cIdx) => {
          const keyBadge = col.primaryKey ? 'PK' : col.foreignKeyRef ? 'FK' : '-'
          const nullLabel = col.notNull ? 'NOT NULL' : 'NULL'
          const notesParts: string[] = []
          if (col.foreignKeyRef) notesParts.push(`-> ${col.foreignKeyRef}`)
          if (col.defaultValue != null) notesParts.push(`DEFAULT ${col.defaultValue}`)
          const noteStr = notesParts.join(' | ') || '-'

          doc.font('Helvetica-Bold').fontSize(7.5)
          const nameH = doc.heightOfString(col.name, { width: colWidths[0] - 8 })
          doc.font('Helvetica').fontSize(7)
          const noteH = doc.heightOfString(noteStr, { width: colWidths[4] - 6 })
          const rowH = Math.max(14, Math.ceil(Math.max(nameH, noteH)) + 5)

          if (doc.y + rowH > bottomLimit) {
            doc.addPage()
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.forest).text(`${tbl.name} (continued)`, leftX, doc.y)
            doc.moveDown(0.2)
            renderColHeader()
          }

          const ry = doc.y
          if (cIdx % 2 === 1) {
            doc.save()
            doc.rect(leftX, ry, pageWidth, rowH).fill(COLORS.zebra)
            doc.restore()
          }

          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.espresso).text(col.name, leftX + 6, ry + 3, { width: colWidths[0] - 8 })
          doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.plum).text(col.type, leftX + colWidths[0], ry + 3, { width: colWidths[1] - 4, lineBreak: false })
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(col.primaryKey ? COLORS.forest : col.foreignKeyRef ? COLORS.amber : COLORS.taupe)
            .text(keyBadge, leftX + colWidths[0] + colWidths[1], ry + 3, { width: colWidths[2] - 4, lineBreak: false })
          doc.font('Helvetica').fontSize(7).fillColor(COLORS.taupe).text(nullLabel, leftX + colWidths[0] + colWidths[1] + colWidths[2], ry + 3, { width: colWidths[3] - 4, lineBreak: false })
          doc.font('Helvetica').fontSize(7).fillColor(COLORS.espresso).text(noteStr, leftX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], ry + 3, { width: colWidths[4] - 6 })

          doc.y = ry + rowH
        })

        if (tbl.indexes.length > 0) {
          const idxText = `Indexes: ${tbl.indexes.map((ix) => `${ix.name}(${ix.columns.join(', ')})`).join(' · ')}`
          doc.font('Helvetica-Oblique').fontSize(7)
          const idxH = doc.heightOfString(idxText, { width: pageWidth - 12 })
          ensureSpace(idxH + 6)
          const iy = doc.y + 2
          doc.font('Helvetica-Oblique').fontSize(7).fillColor(COLORS.taupe).text(idxText, leftX + 6, iy, { width: pageWidth - 12 })
          doc.y = iy + idxH + 2
        }
        doc.moveDown(0.55)
      }
    }

    // ===================== SECTION 3: TYPESCRIPT DATA STRUCTURES =====================
    doc.addPage()
    drawSectionBanner(
      'Section 3 · TypeScript Data Structures',
      'Shared Frontend & Backend Contracts',
      `${snapshot.typeDefinitions.length} interfaces and union types in src/types/fleet.ts & src/types/finance.ts synchronized with SQLite`,
    )

    for (const td of snapshot.typeDefinitions) {
      if (td.kind === 'type') {
        const typeStr = `type ${td.name} = ${td.summaryLine ?? ''}`
        doc.font('Helvetica').fontSize(7.5)
        const typeH = doc.heightOfString(typeStr, { width: pageWidth - 10 })
        ensureSpace(typeH + 8)
        const ty = doc.y
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.plum).text(`type ${td.name}`, leftX + 4, ty, { continued: true, width: pageWidth - 10 })
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.espresso).text(` = ${td.summaryLine ?? ''}`, { width: pageWidth - 10 })
        doc.y = Math.max(doc.y, ty + typeH) + 4
        continue
      }

      ensureSpace(46)
      const boxY = doc.y
      doc.save()
      doc.roundedRect(leftX, boxY, pageWidth, 18, 3).fill('#F4F1FA')
      doc.fillColor(COLORS.plum).font('Helvetica-Bold').fontSize(8.5).text(`interface ${td.name}`, leftX + 8, boxY + 5, { width: 260, lineBreak: false })
      doc.fillColor(COLORS.taupe).font('Helvetica').fontSize(7.5).text(`${td.sourceFile} · ${td.fields.length} fields`, leftX + pageWidth - 200, boxY + 5, { width: 192, align: 'right', lineBreak: false })
      doc.restore()
      doc.y = boxY + 21

      // Print interface fields in clean 2-column grid with true wrapped height measurement
      const colW = (pageWidth - 14) / 2
      const nameW = 92
      const defW = colW - nameW - 6
      for (let idx = 0; idx < td.fields.length; idx += 2) {
        const leftField = td.fields[idx]
        const rightField = td.fields[idx + 1]

        doc.font('Helvetica-Bold').fontSize(7)
        const leftNameH = doc.heightOfString(leftField.name, { width: nameW })
        doc.font('Helvetica').fontSize(7)
        const leftDefH = doc.heightOfString(`: ${leftField.definition}`, { width: defW })

        let rightNameH = 0
        let rightDefH = 0
        if (rightField) {
          doc.font('Helvetica-Bold').fontSize(7)
          rightNameH = doc.heightOfString(rightField.name, { width: nameW })
          doc.font('Helvetica').fontSize(7)
          rightDefH = doc.heightOfString(`: ${rightField.definition}`, { width: defW })
        }

        const rowH = Math.max(10.5, Math.ceil(Math.max(leftNameH, leftDefH, rightNameH, rightDefH)))
        ensureSpace(rowH + 4)
        const rowY = doc.y

        doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.forest).text(leftField.name, leftX + 6, rowY, { width: nameW })
        doc.font('Helvetica').fontSize(7).fillColor(COLORS.espresso).text(`: ${leftField.definition}`, leftX + 6 + nameW + 2, rowY, { width: defW })

        if (rightField) {
          const rx = leftX + colW + 10
          doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.forest).text(rightField.name, rx, rowY, { width: nameW })
          doc.font('Helvetica').fontSize(7).fillColor(COLORS.espresso).text(`: ${rightField.definition}`, rx + nameW + 2, rowY, { width: defW })
        }
        doc.y = rowY + rowH + 3
      }
      doc.moveDown(0.45)
    }

    // ===================== SECTION 4: REST API & RBAC MATRIX =====================
    doc.addPage()
    drawSectionBanner(
      'Section 4 · Server API & RBAC Surface',
      'Express Backend Endpoints & Role Authorization Matrix (server/routes.ts)',
      'HttpOnly cookie session auth, multi-tenant SQL scoping, and transactional SQLite persistence',
    )

    const apiGroups: Array<{ group: string; endpoints: string[] }> = [
      {
        group: 'Authentication & Platform Administration',
        endpoints: [
          'POST /api/auth/login · POST /api/auth/logout · GET /api/auth/me · POST /api/auth/change-password',
          'POST /api/auth/request-password-reset · POST /api/auth/complete-password-reset',
          'GET /api/platform-admin/organizations · POST /api/platform-admin/organizations · PATCH .../status · PATCH .../subscription',
        ],
      },
      {
        group: 'Core Fleet State & Documents',
        endpoints: [
          'GET /api/fleet/bootstrap (normalized 25-table operational dataset + 12 extension modules)',
          'PUT /api/fleet/state (atomic BEGIN IMMEDIATE transactional sync across operational tables)',
          'POST /api/fleet/members (creates users + org_members rows with temporary credential rotation)',
          'POST /api/fleet/documents · GET /api/fleet/documents/:docId/file',
          'GET /api/live/weather (Open-Meteo corridor cache) · POST /api/live/truck-route (Google Routes API proxy)',
        ],
      },
      {
        group: 'Fleetio Extension Modules (/api/fleet/modules/*)',
        endpoints: [
          'GET /api/fleet/modules · POST/PATCH /api/fleet/modules/tools · POST /api/fleet/modules/warranties',
          'POST /api/fleet/modules/custom-records · POST /api/fleet/modules/service-tasks · POST /api/fleet/modules/service-programs',
          'POST /api/fleet/modules/inspection-forms · POST /api/fleet/modules/inspection-schedules',
          'POST/PATCH /api/fleet/modules/recalls · POST/DELETE /api/fleet/modules/api-keys · POST/PATCH /api/fleet/modules/webhooks',
          'POST /api/fleet/modules/custom-dashboards · PUT /api/fleet/modules/settings',
        ],
      },
      {
        group: 'Vehicle Finance & EMI Subsystem (/api/finance/*)',
        endpoints: [
          'GET /api/finance/workspace (RBAC-masked account refs for non-finance/non-admin roles)',
          'POST /api/finance/institutions · POST /api/finance/records · PATCH /api/finance/records/:id/terms (restructure/foreclose)',
          'POST /api/finance/emis/:emiId/payments · PATCH /api/finance/emis/:emiId/status · POST /api/finance/payments/:id/reconcile',
          'POST /api/finance/payments/:id/correct · POST/GET /api/finance/documents · PATCH /api/finance/documents/:id/verify',
          'PUT /api/finance/settings · POST /api/finance/alerts/evaluate · PATCH /api/finance/alerts/:id/ack',
        ],
      },
    ]

    for (const grp of apiGroups) {
      ensureSpace(48)
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.forest).text(grp.group, leftX + 4, doc.y)
      doc.moveDown(0.25)
      for (const ep of grp.endpoints) {
        ensureSpace(14)
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.espresso).text(`•  ${ep}`, leftX + 10, doc.y, { width: pageWidth - 14 })
        doc.moveDown(0.2)
      }
      doc.moveDown(0.45)
    }

    // Stamp page numbers on every page without triggering PDFKit bottom-margin auto-pagination
    const range = doc.bufferedPageRange()
    for (let p = 0; p < range.count; p++) {
      doc.switchToPage(range.start + p)
      const prevBottom = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      const fy = doc.page.height - 30
      doc.save()
      doc.moveTo(leftX, fy - 6).lineTo(leftX + pageWidth, fy - 6).lineWidth(0.5).stroke(COLORS.border)
      doc.fillColor(COLORS.taupe).font('Helvetica').fontSize(7.5).text(
        `DriveMitra Enterprise Fleet ERP · SQLite Schema & Data Structures (${snapshot.totalTables} Tables)`,
        leftX,
        fy,
        { width: pageWidth - 100, lineBreak: false },
      )
      doc.text(`Page ${p + 1} of ${range.count}`, leftX + pageWidth - 90, fy, { width: 90, align: 'right', lineBreak: false })
      doc.restore()
      doc.page.margins.bottom = prevBottom
    }

    doc.end()
  })
}
