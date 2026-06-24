import Dexie, { type EntityTable } from 'dexie'
import { Account, Transaction, Bill, Subscription, Budget, Reconciliation } from './types'

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
  budgets: EntityTable<Budget, 'id'>
  reconciliations: EntityTable<Reconciliation, 'id'>
  settings: EntityTable<Settings, 'id'>
}

db.version(1).stores({
  accounts: 'id, type, createdAt',
  transactions: 'id, type, category, accountId, date, billId, createdAt',
  bills: 'id, category, paid, dueDate, subscriptionId, createdAt',
  subscriptions: 'id, category, active, nextRenewal, linkedBillId, createdAt',
  settings: 'id',
})

db.version(2).stores({
  accounts: 'id, type, createdAt',
  transactions: 'id, type, category, accountId, date, billId, createdAt',
  bills: 'id, category, paid, dueDate, subscriptionId, createdAt',
  subscriptions: 'id, category, active, nextRenewal, linkedBillId, createdAt',
  budgets: 'id, category',
  reconciliations: 'id, accountId, date, resolved',
  settings: 'id',
})

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
        id: 'app', currency: data.settings.currency || 'USD',
        name: data.settings.name || '', darkMode: data.settings.darkMode || false,
        selectedMonth: data.settings.selectedMonth || '',
      })
    }
  } catch (e) { console.error('Migration failed:', e) }
}

migrateFromLocalStorage()

export { db, type Settings }
