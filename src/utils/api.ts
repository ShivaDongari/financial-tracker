import { Account, Transaction, Bill, AppSettings, TransactionLineItem } from '../types'
import { generateId } from './helpers'

const STORAGE_KEY = 'finance_tracker_v2'

interface StoredData {
  accounts: Account[]
  transactions: Transaction[]
  bills: Bill[]
  settings: AppSettings
}

function load(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { accounts: [], transactions: [], bills: [], settings: { currency: 'USD', name: '' } }
}

function save(data: StoredData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const api = {
  getSettings: async (): Promise<AppSettings> => load().settings,

  updateSettings: async (updates: Partial<AppSettings>): Promise<AppSettings> => {
    const data = load()
    data.settings = { ...data.settings, ...updates }
    save(data)
    return data.settings
  },

  getAccounts: async (): Promise<Account[]> => load().accounts,

  createAccount: async (input: Omit<Account, 'id' | 'createdAt'>): Promise<Account> => {
    const data = load()
    const account = { ...input, id: generateId(), createdAt: new Date().toISOString() } as Account
    data.accounts.unshift(account)
    save(data)
    return account
  },

  updateAccount: async (id: string, updates: Partial<Account>): Promise<Account> => {
    const data = load()
    const idx = data.accounts.findIndex(a => a.id === id)
    if (idx >= 0) data.accounts[idx] = { ...data.accounts[idx], ...updates }
    save(data)
    return data.accounts[idx]
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
    const lineItems: TransactionLineItem[] = (rawItems || []).map((li: any) => ({
      ...li,
      id: generateId(),
    }))
    const tx: Transaction = {
      ...rest,
      lineItems,
      id: generateId(),
      createdAt: new Date().toISOString(),
    }
    data.transactions.unshift(tx)
    save(data)
    return tx
  },

  updateTransaction: async (id: string, updates: any): Promise<Transaction> => {
    const data = load()
    const idx = data.transactions.findIndex(t => t.id === id)
    if (idx >= 0) {
      const { lineItems: rawItems, ...rest } = updates
      const lineItems = rawItems
        ? rawItems.map((li: any) => ({ ...li, id: li.id || generateId() }))
        : data.transactions[idx].lineItems
      data.transactions[idx] = { ...data.transactions[idx], ...rest, lineItems }
    }
    save(data)
    return data.transactions[idx]
  },

  deleteTransaction: async (id: string): Promise<void> => {
    const data = load()
    data.transactions = data.transactions.filter(t => t.id !== id)
    save(data)
  },

  getBills: async (): Promise<Bill[]> => load().bills,

  createBill: async (input: Omit<Bill, 'id' | 'createdAt'>): Promise<Bill> => {
    const data = load()
    const bill = { ...input, id: generateId(), createdAt: new Date().toISOString() } as Bill
    data.bills.push(bill)
    save(data)
    return bill
  },

  updateBill: async (id: string, updates: Partial<Bill>): Promise<Bill> => {
    const data = load()
    const idx = data.bills.findIndex(b => b.id === id)
    if (idx >= 0) data.bills[idx] = { ...data.bills[idx], ...updates }
    save(data)
    return data.bills[idx]
  },

  deleteBill: async (id: string): Promise<void> => {
    const data = load()
    data.bills = data.bills.filter(b => b.id !== id)
    save(data)
  },

  getDashboard: async () => {
    const data = load()
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

    const monthTxs = data.transactions.filter(t => t.date >= monthStart && t.date < monthEnd)

    const totalAssets = data.accounts
      .filter(a => a.type === 'bank' || a.type === 'cash' || a.type === 'income')
      .reduce((s, a) => s + a.balance, 0)
    const totalDebt = data.accounts
      .filter(a => a.type === 'credit_card' || a.type === 'loan')
      .reduce((s, a) => s + a.balance, 0)

    const monthlyIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const monthlyExpenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    const categoryBreakdown: Record<string, number> = {}
    for (const tx of monthTxs.filter(t => t.type === 'expense')) {
      if (tx.lineItems?.length) {
        for (const li of tx.lineItems) {
          categoryBreakdown[li.category] = (categoryBreakdown[li.category] || 0) + li.amount
        }
      } else {
        categoryBreakdown[tx.category] = (categoryBreakdown[tx.category] || 0) + tx.amount
      }
    }

    return {
      totalAssets,
      totalDebt,
      netWorth: totalAssets - totalDebt,
      monthlyIncome,
      monthlyExpenses,
      remainingBudget: monthlyIncome - monthlyExpenses,
      categoryBreakdown,
    }
  },
}
