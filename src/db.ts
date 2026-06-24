import Dexie, { type EntityTable } from 'dexie'
import { Account, Transaction, TransactionLineItem, Bill, Subscription } from './types'

interface Settings {
  id: string
  currency: string
  name: string
  darkMode: boolean
  selectedMonth: string
}

const db = new Dexie('FinTracker') as Dexie & {
  accounts: EntityTable<Account, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  bills: EntityTable<Bill, 'id'>
  subscriptions: EntityTable<Subscription, 'id'>
  settings: EntityTable<Settings, 'id'>
}

db.version(1).stores({
  accounts: 'id, type, createdAt',
  transactions: 'id, type, category, accountId, date, billId, createdAt',
  bills: 'id, category, paid, dueDate, subscriptionId, createdAt',
  subscriptions: 'id, category, active, nextRenewal, linkedBillId, createdAt',
  settings: 'id',
})

// Migrate from localStorage if needed
async function migrateFromLocalStorage() {
  const count = await db.accounts.count()
  if (count > 0) return

  const raw = localStorage.getItem('finance_tracker_v2')
  if (!raw) return

  try {
    const data = JSON.parse(raw)
    if (data.accounts?.length) await db.accounts.bulkAdd(data.accounts)
    if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions)
    if (data.bills?.length) await db.bills.bulkAdd(data.bills)
    if (data.subscriptions?.length) await db.subscriptions.bulkAdd(data.subscriptions)
    if (data.settings) {
      await db.settings.put({
        id: 'app',
        currency: data.settings.currency || 'USD',
        name: data.settings.name || '',
        darkMode: data.settings.darkMode || false,
        selectedMonth: data.settings.selectedMonth || '',
      })
    }
    console.log('Migrated data from localStorage to IndexedDB')
  } catch (e) {
    console.error('Migration failed:', e)
  }
}

migrateFromLocalStorage()

export { db, type Settings }
