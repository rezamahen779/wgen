import { initDB } from '../lib/db';
import { turso } from '../lib/turso';

let isSyncing = false;

const cleanVal = (val, fallback = null) => {
  return val === undefined ? fallback : val;
};

export function setupAutoSync() {
  window.addEventListener('online', () => {
    console.log('🌐 Koneksi internet terhubung kembali! Menjalankan Auto-Sync...');
    processSyncQueue();
  });

  if (navigator.onLine) {
    processSyncQueue();
  }
}

export async function processSyncQueue() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const db = await initDB();
    const queue = await db.getAll('sync_queue');

    if (queue.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`🚀 Mengirim ${queue.length} item pending ke Turso DB...`);
    let anySynced = false;

    for (const item of queue) {
      const { id, action, tableName, payload } = item;
      let success = false;
      const targetTable = tableName || 'transactions';

      try {
        // 1. HANDLER TABEL: TRANSACTIONS (Dashboard, List, Report)
        if (targetTable === 'transactions') {
          if (action === 'INSERT' && payload) {
            await turso.execute({
              sql: `INSERT INTO transactions (
                      id, user_id, type, amount, currency, category, payment_method, note, receipt_image, date,
                      has_warranty, warranty_months, warranty_expiry, is_asset, expense_nature, income_nature, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                cleanVal(payload.id),
                cleanVal(payload.user_id),
                cleanVal(payload.type),
                cleanVal(payload.amount, 0),
                cleanVal(payload.currency, 'IDR'),
                cleanVal(payload.category),
                cleanVal(payload.payment_method, 'Cash'),
                cleanVal(payload.note, ''),
                cleanVal(payload.receipt_image),
                cleanVal(payload.date),
                payload.has_warranty ? 1 : 0,
                cleanVal(payload.warranty_months, 0),
                cleanVal(payload.warranty_expiry),
                payload.is_asset ? 1 : 0,
                cleanVal(payload.expense_nature),
                cleanVal(payload.income_nature),
                cleanVal(payload.created_at, new Date().toISOString())
              ]
            });
            success = true;
          } else if (action === 'UPDATE' && payload) {
            await turso.execute({
              sql: `UPDATE transactions 
                    SET type = ?, expense_nature = ?, category = ?, amount = ?, currency = ?, payment_method = ?, note = ?, date = ?, receipt_image = ?,
                        has_warranty = ?, warranty_months = ?, warranty_expiry = ?, is_asset = ?
                    WHERE id = ? AND user_id = ?`,
              args: [
                cleanVal(payload.type),
                cleanVal(payload.expense_nature),
                cleanVal(payload.category),
                cleanVal(payload.amount, 0),
                cleanVal(payload.currency, 'IDR'),
                cleanVal(payload.payment_method, 'Cash'),
                cleanVal(payload.note, ''),
                cleanVal(payload.date),
                cleanVal(payload.receipt_image),
                payload.has_warranty ? 1 : 0,
                cleanVal(payload.warranty_months, 0),
                cleanVal(payload.warranty_expiry),
                payload.is_asset ? 1 : 0,
                cleanVal(payload.id),
                cleanVal(payload.user_id)
              ]
            });
            success = true;
          } else if (action === 'DELETE' && payload) {
            await turso.execute({
              sql: `DELETE FROM transactions WHERE id = ?`,
              args: [cleanVal(payload.id)]
            });
            success = true;
          }
        } 
        
        // 2. HANDLER TABEL: BUDGETS (Budgeting.jsx)
        else if (targetTable === 'budgets') {
          if (action === 'INSERT' || action === 'UPDATE') {
            await turso.execute({
              sql: `INSERT INTO budgets (id, user_id, category, amount, currency, month) 
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET 
                      category=excluded.category, amount=excluded.amount, currency=excluded.currency, month=excluded.month`,
              args: [
                cleanVal(payload.id),
                cleanVal(payload.user_id),
                cleanVal(payload.category),
                cleanVal(payload.amount, 0),
                cleanVal(payload.currency, 'IDR'),
                cleanVal(payload.month)
              ]
            });
            success = true;
          } else if (action === 'DELETE') {
            await turso.execute({
              sql: `DELETE FROM budgets WHERE id = ?`,
              args: [cleanVal(payload.id)]
            });
            success = true;
          }
        }

        // 3. HANDLER TABEL: SAVINGS (Savings.jsx / Save.jsx)
        else if (targetTable === 'savings') {
          if (action === 'INSERT' || action === 'UPDATE') {
            await turso.execute({
              sql: `INSERT INTO savings (id, user_id, name, target_amount, current_amount, currency, due_date) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET 
                      name=excluded.name, target_amount=excluded.target_amount, current_amount=excluded.current_amount, currency=excluded.currency, due_date=excluded.due_date`,
              args: [
                cleanVal(payload.id),
                cleanVal(payload.user_id),
                cleanVal(payload.name),
                cleanVal(payload.target_amount, 0),
                cleanVal(payload.current_amount, 0),
                cleanVal(payload.currency, 'IDR'),
                cleanVal(payload.due_date)
              ]
            });
            success = true;
          } else if (action === 'DELETE') {
            await turso.execute({
              sql: `DELETE FROM savings WHERE id = ?`,
              args: [cleanVal(payload.id)]
            });
            success = true;
          }
        }

        // 4. HANDLER TABEL: DEBTS (DebtManager.jsx)
        else if (targetTable === 'debts') {
          if (action === 'INSERT' || action === 'UPDATE') {
            await turso.execute({
              sql: `INSERT INTO debts (id, user_id, person_name, type, amount, currency, status, due_date, note) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET 
                      person_name=excluded.person_name, type=excluded.type, amount=excluded.amount, currency=excluded.currency, status=excluded.status, due_date=excluded.due_date, note=excluded.note`,
              args: [
                cleanVal(payload.id),
                cleanVal(payload.user_id),
                cleanVal(payload.person_name),
                cleanVal(payload.type),
                cleanVal(payload.amount, 0),
                cleanVal(payload.currency, 'IDR'),
                cleanVal(payload.status, 'unpaid'),
                cleanVal(payload.due_date),
                cleanVal(payload.note, '')
              ]
            });
            success = true;
          } else if (action === 'DELETE') {
            await turso.execute({
              sql: `DELETE FROM debts WHERE id = ?`,
              args: [cleanVal(payload.id)]
            });
            success = true;
          }
        }
      } catch (err) {
        console.error(`Gagal sync item (${targetTable}):`, item, err);
      }

      if (success) {
        await db.delete('sync_queue', id);
        anySynced = true;
      }
    }

    if (anySynced) {
      console.log('✅ Auto-Sync selesai! Memperbarui tampilan UI di seluruh menu...');
      window.dispatchEvent(new Event('transaction-added'));
      window.dispatchEvent(new Event('wgen-data-synced'));
    }
  } catch (err) {
    console.error("Error pada Sync Engine:", err);
  } finally {
    isSyncing = false;
  }
}