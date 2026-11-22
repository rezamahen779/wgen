import { turso } from './turso';
import { getLocalData, setLocalCacheBulk } from './db';

/**
 * Fetch data dari Turso DB. Jika offline / error koneksi, otomatis fallback ke IndexedDB.
 * @param {string} storeName Nama store IndexedDB ('transactions', 'budgets', 'savings', 'debts')
 * @param {object} queryObj Object query Turso { sql: string, args: array }
 * @param {string} userId UID Pengguna
 */
export async function fetchWithOfflineFallback(storeName, queryObj, userId) {
  try {
    if (!navigator.onLine) {
      throw new Error('Koneksi offline terdeteksi');
    }

    const res = await turso.execute(queryObj);
    const rawRows = res.rows || [];

    // 🟢 PASTI-KAN SETIAP OBJECT PUNYA 'id' VALID UNTUK KEYPATH INDEXEDDB
    const validRows = rawRows.map(row => ({
      ...row,
      id: row.id || crypto.randomUUID()
    }));

    // Update Cache Snapshot di IndexedDB lokal
    await setLocalCacheBulk(storeName, validRows);

    return validRows;
  } catch (err) {
    console.warn(`[Offline Mode] Fetch ${storeName} dari Turso Cloud gagal. Mengambil dari IndexedDB lokal...`, err.message);
    
    // Fallback ke IndexedDB Lokal
    const localRows = await getLocalData(storeName, userId);
    return localRows;
  }
}

// 🟢 TAMBAHKAN FUNGSI GET TRANSACTIONS
export async function getTransactions(userId) {
  return await fetchWithOfflineFallback(
    'transactions',
    {
      sql: `SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC`,
      args: [userId]
    },
    userId
  );
}

// 🟢 TAMBAHKAN FUNGSI GET BUDGETS
export async function getBudgets(userId, monthKey) {
  return await fetchWithOfflineFallback(
    'budgets',
    {
      sql: `SELECT * FROM budgets WHERE user_id = ? AND month = ? LIMIT 20`,
      args: [userId, monthKey]
    },
    userId
  );
}