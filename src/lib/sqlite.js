import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const sqlite = new SQLiteConnection(CapacitorSQLite);

export async function initDB() {
  const db = await sqlite.createConnection('wgen_db', false, 'no-encryption', 1, false);
  await db.open();

  // 1. Tabel data transaksi
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      title TEXT,
      amount REAL,
      category TEXT,
      created_at TEXT
    );
  `);

  // 2. Tabel Antrean Sinkronisasi (Sync Queue)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT,
      table_name TEXT,
      payload TEXT,
      created_at TEXT
    );
  `);

  return db;
}