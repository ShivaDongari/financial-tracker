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
      const p = JSON.parse(raw)
      if (!p.subscriptions) p.subscriptions = []
      return p
    }
  } catch {}
  return { accounts: [], transactions: [], bills: [], subscriptions: [], settings: { currency: 'USD', name: '', darkMode: false } }
}

function save(data: StoredData) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }

export const api = {
  getSettings: async (): Promise<AppSettings> => load().settings,
  updateSettings: async (updates: Partial<AppSettings>): Promise<AppSettings> => {
    const d = load(); d.settings = { ...d.settings, ...updates }; save(d); return d.settings
  },

  getAccounts: async (): Promise<Account[]> => load().accounts,
  createAccount: async (input: any): Promise<Account> => {
    const d = load(); const a = { ...input, id: generateId(), createdAt: new Date().toISOString() } as Account
    d.accounts.unshift(a); save(d); return a
  },
  updateAccount: async (id: string, updates: Partial<Account>): Promise<Account> => {
    const d = load(); const i = d.accounts.findIndex(a => a.id === id)
    if (i >= 0) d.accounts[i] = { ...d.accounts[i], ...updates }; save(d); return d.accounts[i]
  },
  deleteAccount: async (id: string): Promise<void> => {
    const d = load(); d.accounts = d.accounts.filter(a => a.id !== id)
    d.transactions = d.transactions.filter(t => t.accountId !== id); save(d)
  },

  getTransactions: async (): Promise<Transaction[]> => load().transactions,
  createTransaction: async (input: any): Promise<Transaction> => {
    const d = load()
    const { lineItems: raw, ...rest } = input
    const lineItems: TransactionLineItem[] = (raw || []).map((li: any) => ({ ...li, id: generateId() }))
    const tx: Transaction = { ...rest, lineItems, id: generateId(), createdAt: new Date().toISOString() }
    d.transactions.unshift(tx); save(d); return tx
  },
  updateTransaction: async (id: string, updates: any): Promise<Transaction> => {
    const d = load(); const i = d.transactions.findIndex(t => t.id === id)
    if (i >= 0) {
      const { lineItems: raw, ...rest } = updates
      const lineItems = raw ? raw.map((li: any) => ({ ...li, id: li.id || generateId() })) : d.transactions[i].lineItems
      d.transactions[i] = { ...d.transactions[i], ...rest, lineItems }
    }
    save(d); return d.transactions[i]
  },
  deleteTransaction: async (id: string): Promise<void> => {
    const d = load(); d.transactions = d.transactions.filter(t => t.id !== id); save(d)
  },

  getBills: async (): Promise<Bill[]> => load().bills,
  createBill: async (input: any): Promise<Bill> => {
    const d = load(); const b = { ...input, id: generateId(), createdAt: new Date().toISOString() } as Bill
    d.bills.push(b); save(d); return b
  },
  updateBill: async (id: string, updates: Partial<Bill>): Promise<Bill> => {
    const d = load(); const i = d.bills.findIndex(b => b.id === id)
    if (i >= 0) d.bills[i] = { ...d.bills[i], ...updates }; save(d); return d.bills[i]
  },
  deleteBill: async (id: string): Promise<void> => {
    const d = load()
    const bill = d.bills.find(b => b.id === id)
    if (bill?.subscriptionId) {
      const sub = d.subscriptions.find(s => s.id === bill.subscriptionId)
      if (sub) sub.linkedBillId = undefined
    }
    d.bills = d.bills.filter(b => b.id !== id); save(d)
  },

  payBill: async (billId: string, accountId: string): Promise<void> => {
    const d = load(); const bill = d.bills.find(b => b.id === billId)
    if (!bill) return
    const today = todayISO()
    const txId = generateId()
    bill.paid = true; bill.paidDate = today; bill.paidTransactionId = txId
    const tx: Transaction = {
      id: txId, type: 'expense', amount: bill.amount, category: bill.category,
      subcategory: bill.subcategory, description: `Bill payment: ${bill.name}`,
      accountId, date: today, notes: 'Auto-created from bill payment',
      billId: bill.id, lineItems: [], createdAt: new Date().toISOString(),
    }
    d.transactions.unshift(tx)
    const acc = d.accounts.find(a => a.id === accountId)
    if (acc) { acc.balance = acc.type === 'credit_card' ? acc.balance + bill.amount : acc.balance - bill.amount }
    save(d)
  },

  unpayBill: async (billId: string): Promise<void> => {
    const d = load(); const bill = d.bills.find(b => b.id === billId)
    if (!bill || !bill.paid) return
    if (bill.paidTransactionId) {
      const tx = d.transactions.find(t => t.id === bill.paidTransactionId)
      if (tx) {
        const acc = d.accounts.find(a => a.id === tx.accountId)
        if (acc) { acc.balance = acc.type === 'credit_card' ? acc.balance - tx.amount : acc.balance + tx.amount }
        d.transactions = d.transactions.filter(t => t.id !== bill.paidTransactionId)
      }
    }
    bill.paid = false; bill.paidDate = undefined; bill.paidTransactionId = undefined
    save(d)
  },

  getSubscriptions: async (): Promise<Subscription[]> => load().subscriptions,

  createSubscription: async (input: any): Promise<Subscription> => {
    const d = load()
    const sub: Subscription = { ...input, id: generateId(), createdAt: new Date().toISOString() }
    d.subscriptions.push(sub)
    // Auto-create linked bill
    const billId = generateId()
    const bill: Bill = {
      id: billId, name: sub.name, amount: sub.amount, dueDate: sub.nextRenewal,
      frequency: sub.frequency, billType: 'fixed', accountId: sub.accountId,
      category: sub.category, subcategory: sub.subcategory, paid: false,
      subscriptionId: sub.id, createdAt: new Date().toISOString(),
    }
    d.bills.push(bill)
    sub.linkedBillId = billId
    save(d); return sub
  },

  updateSubscription: async (id: string, updates: Partial<Subscription>): Promise<Subscription> => {
    const d = load(); const i = d.subscriptions.findIndex(s => s.id === id)
    if (i >= 0) {
      d.subscriptions[i] = { ...d.subscriptions[i], ...updates }
      const sub = d.subscriptions[i]
      // Sync linked bill
      if (sub.linkedBillId) {
        const bill = d.bills.find(b => b.id === sub.linkedBillId)
        if (bill && !bill.paid) {
          bill.name = sub.name; bill.amount = sub.amount; bill.dueDate = sub.nextRenewal
          bill.frequency = sub.frequency; bill.category = sub.category
          bill.subcategory = sub.subcategory; bill.accountId = sub.accountId
        }
      }
    }
    save(d); return d.subscriptions[i]
  },

  deleteSubscription: async (id: string): Promise<void> => {
    const d = load()
    const sub = d.subscriptions.find(s => s.id === id)
    if (sub?.linkedBillId) {
      d.bills = d.bills.filter(b => b.id !== sub.linkedBillId)
    }
    d.subscriptions = d.subscriptions.filter(s => s.id !== id); save(d)
  },

  getDashboard: async (monthKey?: string) => {
    const d = load()
    const today = todayISO()
    const mk = monthKey || today.slice(0, 7)
    const { start: mStart, end: mEnd } = getMonthStartEnd(mk)
    const isCurrentMonth = mk === today.slice(0, 7)
    const cutoff = isCurrentMonth ? today : mEnd

    const monthTxs = d.transactions.filter(t => t.date >= mStart && t.date <= cutoff)
    const futureTxs = isCurrentMonth ? d.transactions.filter(t => t.date > today && t.date <= mEnd) : []
    const scheduledExpenses = futureTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    const totalAssets = d.accounts.filter(a => ['bank', 'cash', 'income'].includes(a.type)).reduce((s, a) => s + a.balance, 0)
    const totalDebt = d.accounts.filter(a => ['credit_card', 'loan'].includes(a.type)).reduce((s, a) => s + a.balance, 0)
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

    const unpaidBills = d.bills.filter(b => !b.paid)
    let upcomingCount = 0, dueSoonCount = 0, overdueCount = 0, paidCount = d.bills.filter(b => b.paid).length
    for (const b of unpaidBills) {
      if (b.noDueDate) { upcomingCount++; continue }
      const days = daysUntil(b.dueDate)
      if (days < 0) overdueCount++
      else if (days <= 7) dueSoonCount++
      else upcomingCount++
    }

    // Bills due this month (unpaid, with due date in selected month)
    const billsDueThisMonth = unpaidBills.filter(b => !b.noDueDate && b.dueDate >= mStart && b.dueDate <= mEnd)
    const billsDueAmount = billsDueThisMonth.reduce((s, b) => s + b.amount, 0)

    // Subscriptions due this month
    const subsDueThisMonth = d.subscriptions.filter(s => s.active && s.nextRenewal >= mStart && s.nextRenewal <= mEnd)
    const subsDueAmount = subsDueThisMonth.reduce((s, sub) => s + sub.amount, 0)

    // Loan payments due this month
    const loanPayments = d.accounts.filter(a => a.type === 'loan' && a.monthlyPayment).reduce((s, a) => s + (a.monthlyPayment || 0), 0)

    // Credit card statement balances (simplified: use statementDueDay)
    const ccDue = d.accounts.filter(a => a.type === 'credit_card' && a.statementDueDay).reduce((s, a) => s + a.balance, 0)

    const totalDueThisMonth = billsDueAmount + loanPayments

    return {
      totalAssets, totalDebt, netWorth: totalAssets - totalDebt,
      monthlyIncome, monthlyExpenses, remainingBudget: monthlyIncome - monthlyExpenses,
      categoryBreakdown, scheduledExpenses, upcomingCount, dueSoonCount, overdueCount, paidCount,
      totalDueThisMonth,
      debtSummary: {
        totalOutstanding: totalDebt,
        dueThisMonth: billsDueAmount + loanPayments + ccDue,
        billsDue: billsDueAmount,
        subscriptionsDue: subsDueAmount,
        loanPaymentsDue: loanPayments,
      },
    }
  },
}
