import * as SQLite from 'expo-sqlite'

const db = SQLite.openDatabaseSync('drivemitra_offline.db')

export function initOfflineDatabase() {
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
}

export function queueOfflineAction(endpoint, payload) {
  const createdAt = new Date().toISOString()
  db.runSync(
    'INSERT INTO pending_sync (endpoint, payload, created_at) VALUES (?, ?, ?);',
    [endpoint, JSON.stringify(payload), createdAt]
  )
}

export function getPendingActions() {
  return db.getAllSync('SELECT * FROM pending_sync WHERE status = "pending";')
}

export function markActionSynced(id) {
  db.runSync('UPDATE pending_sync SET status = "synced" WHERE id = ?;', [id])
}
