import { db } from '../db'
import { Account, Transaction, TransactionLineItem, Bill, Subscription, Budget, Reconciliation, SavingsGoal, DashboardData } from '../types'
import { generateId, daysUntil, getMonthStartEnd, todayISO, currentMonthKey, getNextOccurrence } from './helpers'

type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'lineItems'> & { lineItems?: TransactionLineItem[] }

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
  async getAccounts(): Promise<Account[]> { return db.accounts.orderBy('createdAt').reverse().toArray() },
  async createAccount(input: Partial<Account>): Promise<Account> {
    const account = { ...input, id: generateId(), createdAt: new Date().toISOString() } as Account
    await db.accounts.add(account); return account
  },
  async updateAccount(id: string, updates: Partial<Account>): Promise<void> { await db.accounts.update(id, updates) },
  async deleteAccount(id: string): Promise<void> {
    await db.transaction('rw', db.accounts, db.transactions, async () => {
      await db.accounts.delete(id)
      await db.transactions.where('accountId').equals(id).delete()
    })
  },

  // ── Transactions ──
  async getTransactions(): Promise<Transaction[]> { return db.transactions.orderBy('date').reverse().toArray() },

  async createTransaction(input: NewTransaction): Promise<Transaction> {
    const lineItems = (input.lineItems || []).map(li => ({ ...li, id: li.id || generateId() }))
    const tx: Transaction = { ...input, lineItems, id: generateId(), createdAt: new Date().toISOString() }

    await db.transaction('rw', db.transactions, db.accounts, async () => {
      await db.transactions.add(tx)
      // Auto-update account balance for manual transactions (not bill payments — those handle it themselves)
      if (!tx.billId && !tx.refundOfId) {
        const acc = await db.accounts.get(tx.accountId)
        if (acc) {
          let newBal = acc.balance
          if (tx.type === 'expense') newBal = acc.type === 'credit_card' ? newBal + tx.amount : newBal - tx.amount
          else if (tx.type === 'income') newBal += tx.amount
          if (newBal !== acc.balance) await db.accounts.update(tx.accountId, { balance: newBal })
        }
      }
    })
    return tx
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
    if (updates.lineItems) updates.lineItems = updates.lineItems.map(li => ({ ...li, id: li.id || generateId() }))
    await db.transactions.update(id, updates)
  },

  async deleteTransaction(id: string): Promise<void> { await db.transactions.delete(id) },

  // ── Refunds ──
  async refundTransaction(originalTxId: string, amount?: number, date?: string): Promise<Transaction> {
    const original = await db.transactions.get(originalTxId)
    if (!original) throw new Error('Original transaction not found')
    const refundAmount = amount ?? original.amount
    const refundDate = date ?? todayISO()
    const refundId = generateId()

    const refundTx: Transaction = {
      id: refundId, type: 'refund', amount: refundAmount, category: original.category,
      subcategory: original.subcategory, description: `Refund: ${original.description}`,
      accountId: original.accountId, date: refundDate, refundOfId: originalTxId,
      notes: `Refund of ${original.description}`, lineItems: [], createdAt: new Date().toISOString(),
    }

    await db.transaction('rw', db.transactions, db.accounts, async () => {
      await db.transactions.add(refundTx)
      // Mark original as partially/fully refunded
      const existingRefunded = original.refundedAmount || 0
      await db.transactions.update(originalTxId, { refundedAmount: existingRefunded + refundAmount })
      // Credit back to account
      const acc = await db.accounts.get(original.accountId)
      if (acc) {
        const newBal = acc.type === 'credit_card' ? acc.balance - refundAmount : acc.balance + refundAmount
        await db.accounts.update(original.accountId, { balance: newBal })
      }
    })
    return refundTx
  },

  // ── Bills ──
  async getBills(): Promise<Bill[]> { return db.bills.toArray() },

  async createBill(input: Partial<Bill> & { isRecurringPayment?: boolean }): Promise<Bill> {
    const bill: Bill = { ...input, id: generateId(), createdAt: new Date().toISOString() } as Bill
    await db.bills.add(bill)

    // If marked as recurring payment, auto-create linked subscription
    if (input.isRecurringPayment && input.frequency && input.frequency !== 'once') {
      const subId = generateId()
      const sub: Subscription = {
        id: subId, name: bill.name, amount: bill.amount,
        frequency: bill.frequency as 'monthly' | 'quarterly' | 'yearly',
        nextRenewal: bill.dueDate, category: bill.category,
        subcategory: bill.subcategory, accountId: bill.accountId,
        active: true, linkedBillId: bill.id, createdAt: new Date().toISOString(),
      }
      await db.subscriptions.add(sub)
      await db.bills.update(bill.id, { subscriptionId: subId })
    }
    return bill
  },

  async updateBill(id: string, updates: Partial<Bill>): Promise<void> { await db.bills.update(id, updates) },

  async deleteBill(id: string): Promise<void> {
    const bill = await db.bills.get(id)
    if (bill?.subscriptionId) await db.subscriptions.update(bill.subscriptionId, { linkedBillId: undefined })
    await db.bills.delete(id)
  },

  async payBill(billId: string, accountId: string, paymentDate?: string): Promise<void> {
    const bill = await db.bills.get(billId)
    if (!bill) return
    const pDate = paymentDate || todayISO()
    const txId = generateId()

    await db.transaction('rw', db.bills, db.transactions, db.accounts, async () => {
      await db.bills.update(billId, { paid: true, paidDate: pDate, paidTransactionId: txId })
      await db.transactions.add({
        id: txId, type: 'expense', amount: bill.amount, category: bill.category,
        subcategory: bill.subcategory, description: `Bill payment: ${bill.name}`,
        accountId, date: pDate, notes: 'Auto-created from bill payment',
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

  // Get last paid amount for a variable bill (for reference)
  async getLastBillAmount(billName: string): Promise<number | null> {
    const bills = await db.bills.toArray()
    const paid = bills.filter(b => b.name === billName && b.paid).sort((a, b) => (b.paidDate || '').localeCompare(a.paidDate || ''))
    return paid.length > 0 ? paid[0].amount : null
  },

  // ── Credit Card Statements ──
  async generateStatement(accountId: string): Promise<void> {
    const acc = await db.accounts.get(accountId)
    if (!acc || acc.type !== 'credit_card') return
    const today = todayISO()
    const statements = acc.statements || []
    const lastStatement = statements[statements.length - 1]

    // Get transactions since last statement (or all if no prior statement)
    const since = lastStatement ? lastStatement.statementDate : acc.createdAt.split('T')[0]
    const txs = await db.transactions.where('accountId').equals(accountId).toArray()
    const periodTxs = txs.filter(t => t.date > since && t.date <= today && t.type === 'expense')
    const statementBalance = periodTxs.reduce((s, t) => s + t.amount, 0)

    // Calculate due date (statementDueDay or 25 days after)
    const dueDay = acc.statementDueDay || 25
    const dueMonth = new Date()
    dueMonth.setMonth(dueMonth.getMonth() + 1)
    const dueDate = `${dueMonth.getFullYear()}-${String(dueMonth.getMonth() + 1).padStart(2, '0')}-${String(Math.min(dueDay, 28)).padStart(2, '0')}`

    statements.push({ statementDate: today, dueDate, statementBalance, paid: false })
    await db.accounts.update(accountId, { statements })
  },

  // ── Subscriptions (Recurring Payments) ──
  async getSubscriptions(): Promise<Subscription[]> { return db.subscriptions.toArray() },

  async createSubscription(input: Partial<Subscription>): Promise<Subscription> {
    const subId = generateId()
    const billId = generateId()
    const sub = { ...input, id: subId, linkedBillId: billId, createdAt: new Date().toISOString() } as Subscription
    const bill: Bill = {
      id: billId, name: sub.name, amount: sub.amount, dueDate: sub.nextRenewal,
      frequency: sub.frequency, billType: 'fixed', accountId: sub.accountId,
      category: sub.category, subcategory: sub.subcategory, paid: false,
      subscriptionId: subId, isRecurringPayment: true, createdAt: new Date().toISOString(),
    }
    await db.transaction('rw', db.subscriptions, db.bills, async () => {
      await db.subscriptions.add(sub); await db.bills.add(bill)
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

  // ── Budgets ──
  async getBudgets(): Promise<Budget[]> { return db.budgets.toArray() },
  async setBudget(category: string, monthlyLimit: number): Promise<Budget> {
    const existing = await db.budgets.where('category').equals(category).first()
    if (existing) { await db.budgets.update(existing.id, { monthlyLimit }); return { ...existing, monthlyLimit } }
    const budget: Budget = { id: generateId(), category, monthlyLimit, createdAt: new Date().toISOString() }
    await db.budgets.add(budget); return budget
  },
  async deleteBudget(id: string): Promise<void> { await db.budgets.delete(id) },
  async getBudgetStatus(monthKey?: string) {
    const budgets = await db.budgets.toArray()
    if (!budgets.length) return []
    const mk = monthKey || currentMonthKey()
    const { start: mStart, end: mEnd } = getMonthStartEnd(mk)
    const txs = await db.transactions.where('date').between(mStart, mEnd, true, true).toArray()
    const expenseTxs = txs.filter(t => t.type === 'expense')
    // Subtract refunds from category spending
    const refundTxs = txs.filter(t => t.type === 'refund')

    return budgets.map(b => {
      let spent = 0
      for (const tx of expenseTxs) {
        if (tx.lineItems?.length) { for (const li of tx.lineItems) { if (li.category === b.category) spent += li.amount } }
        else { if (tx.category === b.category) spent += tx.amount }
      }
      // Deduct refunds from the category
      for (const tx of refundTxs) { if (tx.category === b.category) spent -= tx.amount }
      spent = Math.max(0, spent)
      const percent = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0
      return { category: b.category, limit: b.monthlyLimit, spent, percent, over: percent >= 100 }
    }).sort((a, b) => b.percent - a.percent)
  },

  // ── Reconciliation ──
  async getReconciliations(accountId?: string): Promise<Reconciliation[]> {
    if (accountId) return db.reconciliations.where('accountId').equals(accountId).reverse().sortBy('date')
    return db.reconciliations.orderBy('date').reverse().toArray()
  },
  async createReconciliation(accountId: string, actualBalance: number, notes?: string): Promise<Reconciliation> {
    const account = await db.accounts.get(accountId)
    if (!account) throw new Error('Account not found')
    const recon: Reconciliation = {
      id: generateId(), accountId, date: todayISO(), actualBalance, trackedBalance: account.balance,
      difference: actualBalance - account.balance, resolved: false, notes, createdAt: new Date().toISOString(),
    }
    await db.reconciliations.add(recon); return recon
  },
  async resolveReconciliation(id: string, adjustBalance: boolean): Promise<void> {
    const recon = await db.reconciliations.get(id)
    if (!recon) return
    await db.transaction('rw', db.reconciliations, db.accounts, db.transactions, async () => {
      await db.reconciliations.update(id, { resolved: true })
      if (adjustBalance && recon.difference !== 0) {
        await db.accounts.update(recon.accountId, { balance: recon.actualBalance })
        await db.transactions.add({
          id: generateId(), type: recon.difference > 0 ? 'income' : 'expense',
          amount: Math.abs(recon.difference), category: 'Other',
          description: 'Reconciliation adjustment', accountId: recon.accountId,
          date: todayISO(), notes: recon.notes || 'Balance adjusted to match actual',
          lineItems: [], createdAt: new Date().toISOString(),
        })
      }
    })
  },

  // ── Recurring Automation ──
  async processRecurringBills(): Promise<{ generated: number; notifications: string[] }> {
    const today = todayISO()
    const bills = await db.bills.where('paid').equals(0).toArray()
    let generated = 0
    const notifications: string[] = []
    for (const bill of bills) {
      if (bill.noDueDate || bill.frequency === 'once') continue
      if (!bill.dueDate || bill.dueDate > today) {
        const d = bill.dueDate ? daysUntil(bill.dueDate) : null
        if (d !== null && d >= 0 && d <= 3) notifications.push(`${bill.name} is due ${d === 0 ? 'today' : `in ${d} day${d > 1 ? 's' : ''}`} (${bill.amount.toFixed(2)})`)
        continue
      }
      if (bill.accountId && bill.dueDate <= today) {
        const txId = generateId()
        await db.transaction('rw', db.bills, db.transactions, db.accounts, async () => {
          await db.bills.update(bill.id, { paid: true, paidDate: today, paidTransactionId: txId })
          await db.transactions.add({
            id: txId, type: 'expense', amount: bill.amount, category: bill.category,
            subcategory: bill.subcategory, description: `Auto-paid: ${bill.name}`,
            accountId: bill.accountId!, date: today, notes: 'Auto-generated recurring payment',
            billId: bill.id, lineItems: [], createdAt: new Date().toISOString(),
          })
          const acc = await db.accounts.get(bill.accountId!)
          if (acc) {
            const nb = acc.type === 'credit_card' ? acc.balance + bill.amount : acc.balance - bill.amount
            await db.accounts.update(bill.accountId!, { balance: nb })
          }
          const nextDate = getNextOccurrence(bill.dueDate, bill.frequency)
          const newBillId = generateId()
          await db.bills.add({
            ...bill, id: newBillId, dueDate: nextDate, paid: false,
            paidDate: undefined, paidTransactionId: undefined, createdAt: new Date().toISOString(),
          })
          if (bill.subscriptionId) await db.subscriptions.update(bill.subscriptionId, { linkedBillId: newBillId, nextRenewal: nextDate })
        })
        generated++
        notifications.push(`Auto-paid ${bill.name} and scheduled next occurrence`)
      }
    }
    return { generated, notifications }
  },

  // ── Savings Goals ──
  async getGoals(): Promise<SavingsGoal[]> { return db.goals.orderBy('createdAt').reverse().toArray() },
  async createGoal(input: Omit<SavingsGoal, 'id' | 'createdAt'>): Promise<SavingsGoal> {
    const goal: SavingsGoal = { ...input, id: generateId(), createdAt: new Date().toISOString() }
    await db.goals.add(goal); return goal
  },
  async updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<void> { await db.goals.update(id, updates) },
  async addToGoal(id: string, amount: number): Promise<void> {
    const goal = await db.goals.get(id)
    if (!goal) return
    const newAmount = goal.currentAmount + amount
    await db.goals.update(id, { currentAmount: newAmount, completed: newAmount >= goal.targetAmount })
  },
  async deleteGoal(id: string): Promise<void> { await db.goals.delete(id) },

  // ── Dashboard ──
  async getDashboard(monthKey?: string): Promise<DashboardData> {
    const today = todayISO()
    const mk = monthKey || today.slice(0, 7)
    const { start: mStart, end: mEnd } = getMonthStartEnd(mk)
    const isCurrentMonth = mk === today.slice(0, 7)
    const cutoff = isCurrentMonth ? today : mEnd

    const [accounts, rawTx, allBills, allSubs] = await Promise.all([
      db.accounts.toArray(), db.transactions.toArray(), db.bills.toArray(), db.subscriptions.toArray(),
    ])
    const activeSubs = allSubs.filter(s => s.active)
    const allTx = rawTx.filter(t => t.date >= mStart && t.date <= mEnd)
    const monthTxs = allTx.filter(t => t.date <= cutoff)
    const futureTxs = isCurrentMonth ? allTx.filter(t => t.date > today) : []
    const scheduledExpenses = futureTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

    const totalAssets = accounts.filter(a => ['bank', 'cash', 'income'].includes(a.type)).reduce((s, a) => s + a.balance, 0)
    const totalDebt = accounts.filter(a => ['credit_card', 'loan'].includes(a.type)).reduce((s, a) => s + a.balance, 0)
    const monthlyIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    let monthlyExpenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    // Subtract refunds from expenses
    const refunds = monthTxs.filter(t => t.type === 'refund').reduce((s, t) => s + t.amount, 0)
    monthlyExpenses = Math.max(0, monthlyExpenses - refunds)

    const categoryBreakdown: Record<string, number> = {}
    for (const tx of monthTxs.filter(t => t.type === 'expense')) {
      if (tx.lineItems?.length) { for (const li of tx.lineItems) categoryBreakdown[li.category] = (categoryBreakdown[li.category] || 0) + li.amount }
      else { categoryBreakdown[tx.category] = (categoryBreakdown[tx.category] || 0) + tx.amount }
    }
    for (const tx of monthTxs.filter(t => t.type === 'refund')) {
      if (categoryBreakdown[tx.category]) categoryBreakdown[tx.category] = Math.max(0, categoryBreakdown[tx.category] - tx.amount)
    }

    const unpaidBills = allBills.filter(b => !b.paid)
    let upcomingCount = 0, dueSoonCount = 0, overdueCount = 0
    for (const b of unpaidBills) {
      if (b.noDueDate) { upcomingCount++; continue }
      const d = daysUntil(b.dueDate)
      if (d < 0) overdueCount++; else if (d <= 7) dueSoonCount++; else upcomingCount++
    }

    const billsDueThisMonth = unpaidBills.filter(b => !b.noDueDate && b.dueDate >= mStart && b.dueDate <= mEnd)
    const billsDue = billsDueThisMonth.reduce((s, b) => s + b.amount, 0)
    const recurringDue = activeSubs.filter(s => s.nextRenewal >= mStart && s.nextRenewal <= mEnd).reduce((s, sub) => s + sub.amount, 0)
    const loanPayments = accounts.filter(a => a.type === 'loan' && a.monthlyPayment).reduce((s, a) => s + (a.monthlyPayment || 0), 0)

    // Total recurring cost (monthly equivalent of all active subscriptions)
    const totalRecurringCost = activeSubs.reduce((s, sub) => {
      if (sub.frequency === 'monthly') return s + sub.amount
      if (sub.frequency === 'quarterly') return s + sub.amount / 3
      return s + sub.amount / 12
    }, 0)

    // Total subscriptions cost (only streaming/software type)
    const subCategories = ['Recurring Payments']
    const totalSubscriptionsCost = activeSubs.filter(s => subCategories.includes(s.category)).reduce((s, sub) => {
      if (sub.frequency === 'monthly') return s + sub.amount
      if (sub.frequency === 'quarterly') return s + sub.amount / 3
      return s + sub.amount / 12
    }, 0)

    return {
      totalAssets, totalDebt, netWorth: totalAssets - totalDebt,
      monthlyIncome, monthlyExpenses, remainingBudget: monthlyIncome - monthlyExpenses,
      categoryBreakdown, scheduledExpenses, upcomingCount, dueSoonCount, overdueCount,
      paidCount: allBills.filter(b => b.paid).length,
      totalDueThisMonth: billsDue + loanPayments,
      totalRecurringCost, totalSubscriptionsCost,
      debtSummary: {
        totalOutstanding: totalDebt, dueThisMonth: billsDue + loanPayments,
        billsDue, recurringDue, loanPaymentsDue: loanPayments,
      },
    }
  },

  // ── Export/Import ──
  async exportAll(): Promise<string> {
    const [accounts, transactions, bills, subscriptions, budgets, reconciliations, goals, settings] = await Promise.all([
      db.accounts.toArray(), db.transactions.toArray(), db.bills.toArray(),
      db.subscriptions.toArray(), db.budgets.toArray(), db.reconciliations.toArray(), db.goals.toArray(), api.getSettings(),
    ])
    return JSON.stringify({ accounts, transactions, bills, subscriptions, budgets, reconciliations, goals, settings })
  },

  async importAll(json: string): Promise<boolean> {
    try {
      const data = JSON.parse(json)
      if (!data.accounts || !data.transactions || !data.bills) return false
      await db.transaction('rw', [db.accounts, db.transactions, db.bills, db.subscriptions, db.budgets, db.reconciliations, db.goals, db.settings], async () => {
        await db.accounts.clear(); await db.transactions.clear(); await db.bills.clear()
        await db.subscriptions.clear(); await db.budgets.clear(); await db.reconciliations.clear(); await db.goals.clear()
        if (data.accounts.length) await db.accounts.bulkAdd(data.accounts)
        if (data.transactions.length) await db.transactions.bulkAdd(data.transactions)
        if (data.bills.length) await db.bills.bulkAdd(data.bills)
        if (data.subscriptions?.length) await db.subscriptions.bulkAdd(data.subscriptions)
        if (data.budgets?.length) await db.budgets.bulkAdd(data.budgets)
        if (data.reconciliations?.length) await db.reconciliations.bulkAdd(data.reconciliations)
        if (data.goals?.length) await db.goals.bulkAdd(data.goals)
        if (data.settings) await db.settings.put({ ...data.settings, id: 'app' })
      })
      return true
    } catch { return false }
  },
}
