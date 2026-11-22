import * as SQLite from 'expo-sqlite'

let dbInstance = null
let memoryFallbackQueue = []

function getDb() {
  if (dbInstance) return dbInstance
  try {
    dbInstance = SQLite.openDatabaseSync('drivemitra_offline.db')
    return dbInstance
  } catch {
    return null
  }
}

export function initOfflineDatabase() {
  const db = getDb()
  if (!db) return
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS pending_sync (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT DEFAULT 'pending'
      );
      CREATE TABLE IF NOT EXISTS cached_fleet (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
  } catch {
    // fallback handled gracefully in memory
  }
}

export function queueOfflineAction(endpoint, payload) {
  const createdAt = new Date().toISOString()
  const serialized = JSON.stringify(payload)
  const db = getDb()
  if (!db) {
    memoryFallbackQueue.push({
      id: Date.now(),
      endpoint,
      payload: serialized,
      created_at: createdAt,
      status: 'pending',
    })
    return
  }
  try {
    initOfflineDatabase()
    db.runSync(
      'INSERT INTO pending_sync (endpoint, payload, created_at, status) VALUES (?, ?, ?, ?);',
      [endpoint, serialized, createdAt, 'pending'],
    )
  } catch {
    memoryFallbackQueue.push({
      id: Date.now(),
      endpoint,
      payload: serialized,
      created_at: createdAt,
      status: 'pending',
    })
  }
}

export function getPendingActions() {
  const db = getDb()
  if (!db) {
    return memoryFallbackQueue.filter((item) => item.status === 'pending')
  }
  try {
    initOfflineDatabase()
    return db.getAllSync("SELECT * FROM pending_sync WHERE status = 'pending' ORDER BY id DESC;")
  } catch {
    return memoryFallbackQueue.filter((item) => item.status === 'pending')
  }
}

export function markActionSynced(id) {
  memoryFallbackQueue = memoryFallbackQueue.map((item) =>
    item.id === id ? { ...item, status: 'synced' } : item,
  )
  const db = getDb()
  if (!db) return
  try {
    db.runSync("UPDATE pending_sync SET status = 'synced' WHERE id = ?;", [id])
  } catch {
    // ignore
  }
}
