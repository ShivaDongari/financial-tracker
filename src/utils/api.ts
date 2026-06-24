import { Account, Transaction, Bill, Subscription, AppSettings, TransactionLineItem } from '../types'
import { generateId, daysUntil, getMonthStartEnd, todayISO } from './helpers'

const STORAGE_KEY = 'finance_tracker_v2'

interface StoredData {
  accounts: Account[]
  transactions: Transaction[]
  bills: Bill[]
  subscriptions: Subscription[]
  settings: AppSettings
}

function load(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (!parsed.subscriptions) parsed.subscriptions = []
      return parsed
    }
  } catch {}
  return { accounts: [], transactions: [], bills: [], subscriptions: [], settings: { currency: 'USD', name: '', darkMode: false } }
}

function save(data: StoredData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const api = {
  getSettings: async (): Promise<AppSettings> => load().settings,
  updateSettings: async (updates: Partial<AppSettings>): Promise<AppSettings> => {
    const data = load(); data.settings = { ...data.settings, ...updates }; save(data); return data.settings
  },

  getAccounts: async (): Promise<Account[]> => load().accounts,
  createAccount: async (input: any): Promise<Account> => {
    const data = load()
    const account = { ...input, id: generateId(), createdAt: new Date().toISOString() } as Account
    data.accounts.unshift(account); save(data); return account
  },
  updateAccount: async (id: string, updates: Partial<Account>): Promise<Account> => {
    const data = load()
    const idx = data.accounts.findIndex(a => a.id === id)
    if (idx >= 0) data.accounts[idx] = { ...data.accounts[idx], ...updates }
    save(data); return data.accounts[idx]
  },
  deleteAccount: async (id: string): Promise<void> => {
    const data = load()
    data.accounts = data.accounts.filter(a => a.id !== id)
    data.transactions = data.transactions.filter(t => t.accountId !== id)
    save(data)
  },

  getTransactions: async (): Promise<Transaction[]> => load().transactions,
  createTransaction: async (input: any): Promise<Transaction> => {
    const data = load()
    const { lineItems: rawItems, ...rest } = input
    const lineItems: TransactionLineItem[] = (rawItems || []).map((li: any) => ({ ...li, id: generateId() }))
    const tx: Transaction = { ...rest, lineItems, id: generateId(), createdAt: new Date().toISOString() }
    data.transactions.unshift(tx); save(data); return tx
  },
  updateTransaction: async (id: string, updates: any): Promise<Transaction> => {
    const data = load()
    const idx = data.transactions.findIndex(t => t.id === id)
    if (idx >= 0) {
      const { lineItems: rawItems, ...rest } = updates
      const lineItems = rawItems ? rawItems.map((li: any) => ({ ...li, id: li.id || generateId() })) : data.transactions[idx].lineItems
      data.transactions[idx] = { ...data.transactions[idx], ...rest, lineItems }
    }
    save(data); return data.transactions[idx]
  },
  deleteTransaction: async (id: string): Promise<void> => {
    const data = load(); data.transactions = data.transactions.filter(t => t.id !== id); save(data)
  },

  getBills: async (): Promise<Bill[]> => load().bills,
  createBill: async (input: any): Promise<Bill> => {
    const data = load()
    const bill = { ...input, id: generateId(), createdAt: new Date().toISOString() } as Bill
    data.bills.push(bill); save(data); return bill
  },
  updateBill: async (id: string, updates: Partial<Bill>): Promise<Bill> => {
    const data = load()
    const idx = data.bills.findIndex(b => b.id === id)
    if (idx >= 0) data.bills[idx] = { ...data.bills[idx], ...updates }
    save(data); return data.bills[idx]
  },
  deleteBill: async (id: string): Promise<void> => {
    const data = load(); data.bills = data.bills.filter(b => b.id !== id); save(data)
  },

  // Bill pay workflow: mark paid + create transaction + update account balance
  payBill: async (billId: string, accountId: string): Promise<void> => {
    const data = load()
    const bill = data.bills.find(b => b.id === billId)
    if (!bill) return
    const today = todayISO()

    // Mark bill as paid
    bill.paid = true
    bill.paidDate = today

    // Create expense transaction
    const tx: Transaction = {
      id: generateId(), type: 'expense', amount: bill.amount, category: bill.category,
      description: `Bill payment: ${bill.name}`, accountId,
      date: today, notes: `Auto-created from bill payment`, lineItems: [],
      createdAt: new Date().toISOString(),
    }
    data.transactions.unshift(tx)

    // Deduct from account
    const acc = data.accounts.find(a => a.id === accountId)
    if (acc) {
      if (acc.type === 'credit_card') acc.balance += bill.amount
      else acc.balance -= bill.amount
    }

    save(data)
  },

  getSubscriptions: async (): Promise<Subscription[]> => load().subscriptions,
  createSubscription: async (input: any): Promise<Subscription> => {
    const data = load()
    const sub = { ...input, id: generateId(), createdAt: new Date().toISOString() } as Subscription
    data.subscriptions.push(sub); save(data); return sub
  },
  updateSubscription: async (id: string, updates: Partial<Subscription>): Promise<Subscription> => {
    const data = load()
    const idx = data.subscriptions.findIndex(s => s.id === id)
    if (idx >= 0) data.subscriptions[idx] = { ...data.subscriptions[idx], ...updates }
    save(data); return data.subscriptions[idx]
  },
  deleteSubscription: async (id: string): Promise<void> => {
    const data = load(); data.subscriptions = data.subscriptions.filter(s => s.id !== id); save(data)
  },

  getDashboard: async (monthKey?: string) => {
    const data = load()
    const today = todayISO()
    const mk = monthKey || today.slice(0, 7)
    const { start: monthStart, end: monthEnd } = getMonthStartEnd(mk)
    const isCurrentMonth = mk === today.slice(0, 7)

    const cutoff = isCurrentMonth ? today : monthEnd
    const monthTxs = data.transactions.filter(t => t.date >= monthStart && t.date <= cutoff)
    const futureTxs = isCurrentMonth ? data.transactions.filter(t => t.date > today && t.date <= monthEnd) : []
    const scheduledExpenses = futureTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    const totalAssets = data.accounts.filter(a => a.type === 'bank' || a.type === 'cash' || a.type === 'income').reduce((s, a) => s + a.balance, 0)
    const totalDebt = data.accounts.filter(a => a.type === 'credit_card' || a.type === 'loan').reduce((s, a) => s + a.balance, 0)
    const monthlyIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const monthlyExpenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    const categoryBreakdown: Record<string, number> = {}
    for (const tx of monthTxs.filter(t => t.type === 'expense')) {
      if (tx.lineItems?.length) {
        for (const li of tx.lineItems) categoryBreakdown[li.category] = (categoryBreakdown[li.category] || 0) + li.amount
      } else {
        categoryBreakdown[tx.category] = (categoryBreakdown[tx.category] || 0) + tx.amount
      }
    }

    const unpaidBills = data.bills.filter(b => !b.paid)
    let upcomingCount = 0, dueSoonCount = 0, overdueCount = 0, paidCount = data.bills.filter(b => b.paid).length
    for (const b of unpaidBills) {
      if (b.noDueDate) { upcomingCount++; continue }
      const days = daysUntil(b.dueDate)
      if (days < 0) overdueCount++
      else if (days <= 7) dueSoonCount++
      else upcomingCount++
    }

    return {
      totalAssets, totalDebt, netWorth: totalAssets - totalDebt,
      monthlyIncome, monthlyExpenses, remainingBudget: monthlyIncome - monthlyExpenses,
      categoryBreakdown, scheduledExpenses, upcomingCount, dueSoonCount, overdueCount, paidCount,
    }
  },
}
