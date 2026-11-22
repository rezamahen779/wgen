import { openDB } from 'idb';

const DB_NAME = 'wgen_note_offline_db';
const DB_VERSION = 3; // Naik ke v3 untuk menambahkan store settings & user profiles

// ==========================================
// 1. INISIALISASI DATABASE INDEXEDDB
// ==========================================
export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // 1. Store Transaksi & Riwayat (Dashboard, List/Transaksi, Report)
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'id' });
      }

      // 2. Store Budgeting (Budgeting.jsx)
      if (!db.objectStoreNames.contains('budgets')) {
        db.createObjectStore('budgets', { keyPath: 'id' });
      }

      // 3. Store Tabungan & Aset (Save / Savings.jsx)
      if (!db.objectStoreNames.contains('savings')) {
        db.createObjectStore('savings', { keyPath: 'id' });
      }

      // 4. Store Utang Piutang (DebtManager.jsx)
      if (!db.objectStoreNames.contains('debts')) {
        db.createObjectStore('debts', { keyPath: 'id' });
      }

      // 5. Store Settings & Pengaturan Aplikasi (Settings.jsx)
      if (!db.objectStoreNames.contains('app_settings')) {
        db.createObjectStore('app_settings', { keyPath: 'key' });
      }

      // 6. Store Antrean Sinkronisasi (Sync Queue saat Offline -> Online)
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

// ==========================================
// 2. HELPER ANTREAN SINKRONISASI (SYNC QUEUE)
// ==========================================
export const addToSyncQueue = async (action, tableName, payload) => {
  const db = await initDB();
  await db.add('sync_queue', {
    action,       // 'INSERT' | 'UPDATE' | 'DELETE'
    tableName,    // 'transactions' | 'budgets' | 'savings' | 'debts' | 'app_settings'
    payload,      // Data JSON
    createdAt: new Date().toISOString()
  });
};

export const getSyncQueue = async () => {
  const db = await initDB();
  return await db.getAll('sync_queue');
};

export const clearSyncQueueItem = async (id) => {
  const db = await initDB();
  await db.delete('sync_queue', id);
};

// ==========================================
// 3. HELPER OPERASI LOKAL (GENERIC CRUD)
// ==========================================

// Ambil Semua Data dari Store Spesifik (Offline Read)
export const getLocalData = async (storeName, userId) => {
  const db = await initDB();
  const allData = await db.getAll(storeName);
  
  // Filter berdasarkan User ID jika diberikan
  if (userId) {
    return allData.filter(item => item.user_id === userId);
  }
  return allData;
};

// Timpa/Update Cache Snapshot dari Cloud Turso ke IndexedDB
export const setLocalCacheBulk = async (storeName, itemsArray) => {
  const db = await initDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  
  await store.clear();
  for (const item of itemsArray) {
    await store.put(item);
  }
  await tx.done;
};

// Simpan / Update 1 Item ke Lokal & Otomatis Antre Sync jika Offline
export const saveLocalItem = async (storeName, item, actionType = 'INSERT', isOnline = true) => {
  const db = await initDB();
  await db.put(storeName, item); // Langsung perbarui UI lokal tanpa delay

  if (!isOnline) {
    await addToSyncQueue(actionType, storeName, item);
  }
};

// Hapus 1 Item dari Lokal & Antre Sync jika Offline
export const deleteLocalItem = async (storeName, id, isOnline = true) => {
  const db = await initDB();
  await db.delete(storeName, id);

  if (!isOnline) {
    await addToSyncQueue('DELETE', storeName, { id });
  }
};

// ==========================================
// 4. HELPER KHUSUS SETTINGS (SETTINGS.JSX)
// ==========================================
export const getSettingItem = async (key, fallbackValue = null) => {
  try {
    const db = await initDB();
    const result = await db.get('app_settings', key);
    return result ? result.value : fallbackValue;
  } catch (e) {
    return fallbackValue;
  }
};

export const setSettingItem = async (key, value) => {
  const db = await initDB();
  await db.put('app_settings', { key, value, updatedAt: new Date().toISOString() });
};