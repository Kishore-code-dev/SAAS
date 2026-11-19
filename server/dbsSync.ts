import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { generateFullSchemaPdfBuffer } from './schemaPdf.ts'

export interface DbsSyncResult {
  targetDir: string
  totalTables: number
  totalRows: number
  schemaChanged: boolean
  pdfRegenerated: boolean
  integrity: string
}

let inFlightSync: Promise<DbsSyncResult> | null = null
let pendingTimer: ReturnType<typeof setTimeout> | null = null

function buildSchemaSqlContent(db: DatabaseSync, timestampIso: string): { fullSql: string; bodyOnly: string } {
  const ddlRows = db
    .prepare(
      "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name",
    )
    .all() as Array<{ type: string; name: string; sql: string }>

  const bodyLines = ['PRAGMA foreign_keys = ON;', '', ...ddlRows.map((r) => `${r.sql.trim()};\n`)]
  const bodyOnly = bodyLines.join('\n')
  const fullSql = [
    '-- DriveMitra Full SQLite Database Schema Reference',
    `-- Snapshot created: ${timestampIso}`,
    bodyOnly,
  ].join('\n')

  return { fullSql, bodyOnly }
}

function stripTimestampHeader(existingSql: string): string {
  return existingSql
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('-- DriveMitra Full SQLite Database Schema Reference') && !line.startsWith('-- Snapshot created:'))
    .join('\n')
}

export async function syncDbsReferenceFolder(
  db: DatabaseSync,
  options?: { targetDir?: string; regeneratePdf?: boolean; updateRootPdf?: boolean },
): Promise<DbsSyncResult> {
  if (!options?.targetDir && inFlightSync) {
    return inFlightSync
  }

  const run = async (): Promise<DbsSyncResult> => {
    const targetDir = path.resolve(options?.targetDir ?? path.join(process.cwd(), 'DBS'))
    fs.mkdirSync(targetDir, { recursive: true })

    const nowIso = new Date().toISOString()
    const tempDbPath = path.join(targetDir, `.drivemitra.tmp-${process.pid}-${Date.now()}.db`)
    const finalDbPath = path.join(targetDir, 'drivemitra.db')

    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath)
    db.exec(`VACUUM INTO '${tempDbPath.replace(/'/g, "''")}'`)

    const copyDb = new DatabaseSync(tempDbPath)
    let integrity = 'unknown'
    const tableCounts: Array<{ table: string; rows: number }> = []
    const tablesDump: Record<string, unknown[]> = {}

    try {
      const checkRow = copyDb.prepare('PRAGMA integrity_check').get() as { integrity_check: string } | undefined
      integrity = checkRow?.integrity_check ?? 'unknown'
      if (integrity !== 'ok') {
        throw new Error(`SQLite reference backup integrity check failed: ${integrity}`)
      }

      const tableRows = copyDb
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all() as Array<{ name: string }>

      for (const row of tableRows) {
        const safeIdent = row.name.replace(/"/g, '""')
        const rows = copyDb.prepare(`SELECT * FROM "${safeIdent}"`).all() as Record<string, unknown>[]
        tablesDump[row.name] = rows
        tableCounts.push({ table: row.name, rows: rows.length })
      }
    } finally {
      copyDb.close()
    }

    fs.renameSync(tempDbPath, finalDbPath)

    const schemaPath = path.join(targetDir, 'schema.sql')
    const { fullSql, bodyOnly } = buildSchemaSqlContent(db, nowIso)
    const previousBody = fs.existsSync(schemaPath) ? stripTimestampHeader(fs.readFileSync(schemaPath, 'utf8')) : ''
    const schemaChanged = previousBody.trim() !== bodyOnly.trim()
    fs.writeFileSync(schemaPath, fullSql, 'utf8')

    const totalRows = tableCounts.reduce((acc, item) => acc + item.rows, 0)
    const exportPath = path.join(targetDir, 'full_data_export.json')
    fs.writeFileSync(
      exportPath,
      JSON.stringify(
        {
          generatedAt: nowIso,
          source: '.drivemitra-data/drivemitra.db',
          totalTables: tableCounts.length,
          totalRows,
          tableCounts,
          tables: tablesDump,
        },
        null,
        2,
      ),
      'utf8',
    )

    const pdfPath = path.join(targetDir, 'DriveMitra_Full_Database_Architecture.pdf')
    const shouldRegenPdf = Boolean(options?.regeneratePdf) || schemaChanged || !fs.existsSync(pdfPath)
    if (shouldRegenPdf) {
      const pdfBuf = await generateFullSchemaPdfBuffer(db, {
        organizationName: 'DriveMitra Multi-Tenant Reference',
        organizationCode: 'ALL-ORGS',
      })
      fs.writeFileSync(pdfPath, pdfBuf)
      const rootPdfPath = path.resolve(process.cwd(), 'DriveMitra_Full_Database_Architecture.pdf')
      if (!options?.targetDir && (options?.updateRootPdf ?? fs.existsSync(rootPdfPath))) {
        fs.writeFileSync(rootPdfPath, pdfBuf)
      }
    }

    const readmeLines = [
      '# DriveMitra Database Reference Copy (`DBS/`)',
      '',
      `- **Snapshot Timestamp**: ${nowIso}`,
      `- **Integrity Check**: ${integrity}`,
      `- **Total Tables**: ${tableCounts.length}`,
      `- **Total Rows**: ${totalRows}`,
      '',
      '## Auto-Sync Behavior',
      'This folder is automatically kept in sync with `.drivemitra-data/drivemitra.db` on server startup/migrations and after mutating API operations.',
      '',
      '## Contents',
      '- `drivemitra.db` — Self-contained SQLite binary database copy (created via `VACUUM INTO`).',
      '- `schema.sql` — Complete `CREATE TABLE` and `CREATE INDEX` DDL statements for all tables.',
      '- `full_data_export.json` — Full JSON export of every table and live row.',
      '- `DriveMitra_Full_Database_Architecture.pdf` — Multi-page formatted schema, ER hierarchy, TypeScript interfaces, and API reference.',
      '',
      '## Table Row Counts',
      ...tableCounts.map((c) => `- \`${c.table}\`: ${c.rows} rows`),
      '',
    ]
    fs.writeFileSync(path.join(targetDir, 'README.md'), readmeLines.join('\n'), 'utf8')

    return {
      targetDir,
      totalTables: tableCounts.length,
      totalRows,
      schemaChanged,
      pdfRegenerated: shouldRegenPdf,
      integrity,
    }
  }

  if (options?.targetDir) {
    return run()
  }

  inFlightSync = run().finally(() => {
    inFlightSync = null
  })
  return inFlightSync
}

export function scheduleDbsSync(db: DatabaseSync, delayMs = 1200): void {
  if (process.env.NODE_ENV === 'test') return
  if (pendingTimer) {
    clearTimeout(pendingTimer)
  }
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    void syncDbsReferenceFolder(db).catch((err) => {
      console.warn('[DBS-Sync] Failed to refresh DBS reference copy:', err instanceof Error ? err.message : String(err))
    })
  }, delayMs)
}
