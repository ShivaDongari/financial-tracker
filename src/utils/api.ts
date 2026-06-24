import { db } from '../db'
import { Account, Transaction, TransactionLineItem, Bill, Subscription, DashboardData, CATEGORY_TREE } from '../types'
import { generateId, daysUntil, getMonthStartEnd, todayISO, currentMonthKey } from './helpers'

type NewAccount = Omit<Account, 'id' | 'createdAt'>
type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'lineItems'> & { lineItems?: TransactionLineItem[] }
type NewBill = Omit<Bill, 'id' | 'createdAt'>
type NewSubscription = Omit<Subscription, 'id' | 'createdAt'>

interface AppSettings {
  currency: string
  name: string
  darkMode: boolean
  selectedMonth: string
}

export const api = {
  // ── Settings ──

  async getSettings(): Promise<AppSettings> {
    const s = await db.settings.get('app')
    return s ?? { currency: 'USD', name: '', darkMode: false, selectedMonth: currentMonthKey() }
  },

  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await api.getSettings()
    const merged = { ...current, ...updates, id: 'app' }
    await db.settings.put(merged)
    return merged
  },

  // ── Accounts ──

  async getAccounts(): Promise<Account[]> {
    return db.accounts.orderBy('createdAt').reverse().toArray()
  },

  async createAccount(input: NewAccount): Promise<Account> {
    const account: Account = { ...input, id: generateId(), createdAt: new Date().toISOString() }
    await db.accounts.add(account)
    return account
  },

  async updateAccount(id: string, updates: Partial<Account>): Promise<void> {
    await db.accounts.update(id, updates)
  },

  async deleteAccount(id: string): Promise<void> {
    await db.transaction('rw', db.accounts, db.transactions, async () => {
      await db.accounts.delete(id)
      await db.transactions.where('accountId').equals(id).delete()
    })
  },

  // ── Transactions ──

  async getTransactions(): Promise<Transaction[]> {
    return db.transactions.orderBy('date').reverse().toArray()
  },

  async createTransaction(input: NewTransaction): Promise<Transaction> {
    const lineItems = (input.lineItems || []).map(li => ({ ...li, id: li.id || generateId() }))
    const tx: Transaction = { ...input, lineItems, id: generateId(), createdAt: new Date().toISOString() }
    await db.transactions.add(tx)
    return tx
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
    if (updates.lineItems) {
      updates.lineItems = updates.lineItems.map(li => ({ ...li, id: li.id || generateId() }))
    }
    await db.transactions.update(id, updates)
  },

  async deleteTransaction(id: string): Promise<void> {
    await db.transactions.delete(id)
  },

  // ── Bills ──

  async getBills(): Promise<Bill[]> {
    return db.bills.toArray()
  },

  async createBill(input: NewBill): Promise<Bill> {
    const bill: Bill = { ...input, id: generateId(), createdAt: new Date().toISOString() }
    await db.bills.add(bill)
    return bill
  },

  async updateBill(id: string, updates: Partial<Bill>): Promise<void> {
    await db.bills.update(id, updates)
  },

  async deleteBill(id: string): Promise<void> {
    const bill = await db.bills.get(id)
    if (bill?.subscriptionId) {
      await db.subscriptions.update(bill.subscriptionId, { linkedBillId: undefined })
    }
    await db.bills.delete(id)
  },

  async payBill(billId: string, accountId: string): Promise<void> {
    const bill = await db.bills.get(billId)
    if (!bill) return
    const today = todayISO()
    const txId = generateId()

    await db.transaction('rw', db.bills, db.transactions, db.accounts, async () => {
      await db.bills.update(billId, { paid: true, paidDate: today, paidTransactionId: txId })

      await db.transactions.add({
        id: txId, type: 'expense', amount: bill.amount, category: bill.category,
        subcategory: bill.subcategory, description: `Bill payment: ${bill.name}`,
        accountId, date: today, notes: 'Auto-created from bill payment',
        billId: bill.id, lineItems: [], createdAt: new Date().toISOString(),
      })

      const acc = await db.accounts.get(accountId)
      if (acc) {
        const newBalance = acc.type === 'credit_card' ? acc.balance + bill.amount : acc.balance - bill.amount
        await db.accounts.update(accountId, { balance: newBalance })
      }
    })
  },

  async unpayBill(billId: string): Promise<void> {
    const bill = await db.bills.get(billId)
    if (!bill?.paid) return

    await db.transaction('rw', db.bills, db.transactions, db.accounts, async () => {
      if (bill.paidTransactionId) {
        const tx = await db.transactions.get(bill.paidTransactionId)
        if (tx) {
          const acc = await db.accounts.get(tx.accountId)
          if (acc) {
            const newBalance = acc.type === 'credit_card' ? acc.balance - tx.amount : acc.balance + tx.amount
            await db.accounts.update(tx.accountId, { balance: newBalance })
          }
          await db.transactions.delete(bill.paidTransactionId)
        }
      }
      await db.bills.update(billId, { paid: false, paidDate: undefined, paidTransactionId: undefined })
    })
  },

  // ── Subscriptions ──

  async getSubscriptions(): Promise<Subscription[]> {
    return db.subscriptions.toArray()
  },

  async createSubscription(input: NewSubscription): Promise<Subscription> {
    const subId = generateId()
    const billId = generateId()

    const sub: Subscription = { ...input, id: subId, linkedBillId: billId, createdAt: new Date().toISOString() }
    const bill: Bill = {
      id: billId, name: input.name, amount: input.amount, dueDate: input.nextRenewal,
      frequency: input.frequency, billType: 'fixed', accountId: input.accountId,
      category: input.category, subcategory: input.subcategory, paid: false,
      subscriptionId: subId, createdAt: new Date().toISOString(),
    }

    await db.transaction('rw', db.subscriptions, db.bills, async () => {
      await db.subscriptions.add(sub)
      await db.bills.add(bill)
    })
    return sub
  },

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<void> {
    await db.transaction('rw', db.subscriptions, db.bills, async () => {
      await db.subscriptions.update(id, updates)
      const sub = await db.subscriptions.get(id)
      if (sub?.linkedBillId) {
        const bill = await db.bills.get(sub.linkedBillId)
        if (bill && !bill.paid) {
          await db.bills.update(sub.linkedBillId, {
            name: sub.name, amount: sub.amount, dueDate: sub.nextRenewal,
            frequency: sub.frequency, category: sub.category, subcategory: sub.subcategory,
            accountId: sub.accountId,
          })
        }
      }
    })
  },

  async deleteSubscription(id: string): Promise<void> {
    const sub = await db.subscriptions.get(id)
    await db.transaction('rw', db.subscriptions, db.bills, async () => {
      if (sub?.linkedBillId) await db.bills.delete(sub.linkedBillId)
      await db.subscriptions.delete(id)
    })
  },

  // ── Dashboard ──

  async getDashboard(monthKey?: string): Promise<DashboardData> {
    const today = todayISO()
    const mk = monthKey || today.slice(0, 7)
    const { start: mStart, end: mEnd } = getMonthStartEnd(mk)
    const isCurrentMonth = mk === today.slice(0, 7)
    const cutoff = isCurrentMonth ? today : mEnd

    const [accounts, allTx, allBills, allSubs] = await Promise.all([
      db.accounts.toArray(),
      db.transactions.where('date').between(mStart, mEnd, true, true).toArray(),
      db.bills.toArray(),
      db.subscriptions.where('active').equals(1).toArray(),
    ])

    const monthTxs = allTx.filter(t => t.date <= cutoff)
    const futureTxs = isCurrentMonth ? allTx.filter(t => t.date > today) : []
    const scheduledExpenses = futureTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    const totalAssets = accounts.filter(a => ['bank', 'cash', 'income'].includes(a.type)).reduce((s, a) => s + a.balance, 0)
    const totalDebt = accounts.filter(a => ['credit_card', 'loan'].includes(a.type)).reduce((s, a) => s + a.balance, 0)
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

    const unpaidBills = allBills.filter(b => !b.paid)
    let upcomingCount = 0, dueSoonCount = 0, overdueCount = 0
    for (const b of unpaidBills) {
      if (b.noDueDate) { upcomingCount++; continue }
      const d = daysUntil(b.dueDate)
      if (d < 0) overdueCount++
      else if (d <= 7) dueSoonCount++
      else upcomingCount++
    }

    const billsDueThisMonth = unpaidBills.filter(b => !b.noDueDate && b.dueDate >= mStart && b.dueDate <= mEnd)
    const billsDue = billsDueThisMonth.reduce((s, b) => s + b.amount, 0)
    const subsDue = allSubs.filter(s => s.nextRenewal >= mStart && s.nextRenewal <= mEnd).reduce((s, sub) => s + sub.amount, 0)
    const loanPayments = accounts.filter(a => a.type === 'loan' && a.monthlyPayment).reduce((s, a) => s + (a.monthlyPayment || 0), 0)

    return {
      totalAssets, totalDebt, netWorth: totalAssets - totalDebt,
      monthlyIncome, monthlyExpenses, remainingBudget: monthlyIncome - monthlyExpenses,
      categoryBreakdown, scheduledExpenses, upcomingCount, dueSoonCount, overdueCount,
      paidCount: allBills.filter(b => b.paid).length,
      totalDueThisMonth: billsDue + loanPayments,
      debtSummary: {
        totalOutstanding: totalDebt, dueThisMonth: billsDue + loanPayments,
        billsDue, subscriptionsDue: subsDue, loanPaymentsDue: loanPayments,
      },
    }
  },

  // ── Export/Import ──

  async exportAll(): Promise<string> {
    const [accounts, transactions, bills, subscriptions, settings] = await Promise.all([
      db.accounts.toArray(), db.transactions.toArray(), db.bills.toArray(),
      db.subscriptions.toArray(), api.getSettings(),
    ])
    return JSON.stringify({ accounts, transactions, bills, subscriptions, settings })
  },

  async importAll(json: string): Promise<boolean> {
    try {
      const data = JSON.parse(json)
      if (!data.accounts || !data.transactions || !data.bills) return false
      await db.transaction('rw', db.accounts, db.transactions, db.bills, db.subscriptions, db.settings, async () => {
        await db.accounts.clear(); await db.transactions.clear(); await db.bills.clear(); await db.subscriptions.clear()
        if (data.accounts.length) await db.accounts.bulkAdd(data.accounts)
        if (data.transactions.length) await db.transactions.bulkAdd(data.transactions)
        if (data.bills.length) await db.bills.bulkAdd(data.bills)
        if (data.subscriptions?.length) await db.subscriptions.bulkAdd(data.subscriptions)
        if (data.settings) await db.settings.put({ ...data.settings, id: 'app' })
      })
      return true
    } catch { return false }
  },
}
