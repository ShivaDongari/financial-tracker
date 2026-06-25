import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { api } from '../utils/api'
import { todayISO } from '../utils/helpers'

beforeEach(async () => {
  await db.accounts.clear()
  await db.transactions.clear()
  await db.bills.clear()
  await db.subscriptions.clear()
  await db.budgets.clear()
  await db.reconciliations.clear()
  await db.goals.clear()
  await db.settings.clear()
})

describe('Accounts', () => {
  it('creates and retrieves an account', async () => {
    const acc = await api.createAccount({ name: 'Checking', type: 'bank', balance: 1000, currency: 'USD' })
    expect(acc.id).toBeTruthy()
    expect(acc.name).toBe('Checking')

    const all = await api.getAccounts()
    expect(all).toHaveLength(1)
    expect(all[0].balance).toBe(1000)
  })

  it('updates account balance', async () => {
    const acc = await api.createAccount({ name: 'Savings', type: 'bank', balance: 500, currency: 'USD' })
    await api.updateAccount(acc.id, { balance: 750 })
    const all = await api.getAccounts()
    expect(all[0].balance).toBe(750)
  })

  it('deletes account and its transactions', async () => {
    const acc = await api.createAccount({ name: 'Test', type: 'cash', balance: 100, currency: 'USD' })
    await api.createTransaction({ type: 'expense', amount: 50, category: 'Other', description: 'test', accountId: acc.id, date: '2026-06-01' })
    await api.deleteAccount(acc.id)

    expect(await api.getAccounts()).toHaveLength(0)
    expect(await api.getTransactions()).toHaveLength(0)
  })
})

describe('Transactions', () => {
  it('creates a transaction with line items', async () => {
    const acc = await api.createAccount({ name: 'Bank', type: 'bank', balance: 1000, currency: 'USD' })
    const tx = await api.createTransaction({
      type: 'expense', amount: 100, category: 'Food & Dining', description: 'Grocery',
      accountId: acc.id, date: '2026-06-15',
      lineItems: [
        { description: 'Milk', amount: 5, category: 'Food & Dining', quantity: 2 },
        { description: 'Bread', amount: 3, category: 'Food & Dining', quantity: 1 },
      ],
    })
    expect(tx.lineItems).toHaveLength(2)
    expect(tx.lineItems[0].id).toBeTruthy()
  })
})

describe('Bill Pay/Unpay Workflow', () => {
  it('paying a bill creates transaction and adjusts balance', async () => {
    const acc = await api.createAccount({ name: 'Checking', type: 'bank', balance: 1000, currency: 'USD' })
    const bill = await api.createBill({ name: 'Electric', amount: 150, dueDate: '2026-06-20', frequency: 'monthly', billType: 'variable', category: 'Utilities', paid: false })

    await api.payBill(bill.id, acc.id)

    const bills = await api.getBills()
    expect(bills[0].paid).toBe(true)
    expect(bills[0].paidTransactionId).toBeTruthy()

    const txs = await api.getTransactions()
    expect(txs).toHaveLength(1)
    expect(txs[0].amount).toBe(150)
    expect(txs[0].description).toContain('Electric')

    const accounts = await api.getAccounts()
    expect(accounts[0].balance).toBe(850) // 1000 - 150
  })

  it('unpaying a bill reverses transaction and restores balance', async () => {
    const acc = await api.createAccount({ name: 'Checking', type: 'bank', balance: 1000, currency: 'USD' })
    const bill = await api.createBill({ name: 'Water', amount: 80, dueDate: '2026-06-20', frequency: 'monthly', billType: 'variable', category: 'Utilities', paid: false })

    await api.payBill(bill.id, acc.id)
    await api.unpayBill(bill.id)

    const bills = await api.getBills()
    expect(bills[0].paid).toBe(false)
    expect(bills[0].paidTransactionId).toBeUndefined()

    const txs = await api.getTransactions()
    expect(txs).toHaveLength(0) // transaction removed

    const accounts = await api.getAccounts()
    expect(accounts[0].balance).toBe(1000) // balance restored
  })

  it('paying a credit card bill increases card balance', async () => {
    const card = await api.createAccount({ name: 'Visa', type: 'credit_card', balance: 500, currency: 'USD', creditLimit: 5000 })
    const bill = await api.createBill({ name: 'Netflix', amount: 15, dueDate: '2026-06-15', frequency: 'monthly', billType: 'fixed', category: 'Subscriptions', paid: false })

    await api.payBill(bill.id, card.id)

    const accounts = await api.getAccounts()
    expect(accounts[0].balance).toBe(515) // credit card balance goes up
  })
})

describe('Budgets', () => {
  it('sets and retrieves budget status', async () => {
    const acc = await api.createAccount({ name: 'Bank', type: 'bank', balance: 5000, currency: 'USD' })
    await api.setBudget('Food & Dining', 500)
    await api.createTransaction({ type: 'expense', amount: 200, category: 'Food & Dining', description: 'Groceries', accountId: acc.id, date: todayISO() })

    const statuses = await api.getBudgetStatus()
    expect(statuses).toHaveLength(1)
    expect(statuses[0].spent).toBe(200)
    expect(statuses[0].percent).toBeCloseTo(40)
    expect(statuses[0].over).toBe(false)
  })

  it('detects over-budget', async () => {
    const acc = await api.createAccount({ name: 'Bank', type: 'bank', balance: 5000, currency: 'USD' })
    await api.setBudget('Entertainment', 100)
    await api.createTransaction({ type: 'expense', amount: 150, category: 'Entertainment', description: 'Concert', accountId: acc.id, date: todayISO() })

    const statuses = await api.getBudgetStatus()
    expect(statuses[0].over).toBe(true)
    expect(statuses[0].percent).toBeCloseTo(150)
  })
})

describe('Savings Goals', () => {
  it('creates a goal and adds to it', async () => {
    const goal = await api.createGoal({ name: 'Emergency Fund', targetAmount: 5000, currentAmount: 0, completed: false })
    expect(goal.id).toBeTruthy()

    await api.addToGoal(goal.id, 1000)
    const goals = await api.getGoals()
    expect(goals[0].currentAmount).toBe(1000)
    expect(goals[0].completed).toBe(false)
  })

  it('marks goal completed when target reached', async () => {
    const goal = await api.createGoal({ name: 'Vacation', targetAmount: 2000, currentAmount: 1800, completed: false })
    await api.addToGoal(goal.id, 300)
    const goals = await api.getGoals()
    expect(goals[0].currentAmount).toBe(2100)
    expect(goals[0].completed).toBe(true)
  })
})

describe('Subscription-Bill Sync', () => {
  it('creating a subscription creates a linked bill', async () => {
    const sub = await api.createSubscription({ name: 'Netflix', amount: 15.99, frequency: 'monthly', nextRenewal: '2026-07-01', category: 'Subscriptions', active: true })
    expect(sub.linkedBillId).toBeTruthy()

    const bills = await api.getBills()
    expect(bills).toHaveLength(1)
    expect(bills[0].name).toBe('Netflix')
    expect(bills[0].subscriptionId).toBe(sub.id)
  })

  it('deleting a subscription deletes its linked bill', async () => {
    const sub = await api.createSubscription({ name: 'Spotify', amount: 9.99, frequency: 'monthly', nextRenewal: '2026-07-01', category: 'Subscriptions', active: true })
    await api.deleteSubscription(sub.id)

    expect(await api.getSubscriptions()).toHaveLength(0)
    expect(await api.getBills()).toHaveLength(0)
  })
})

describe('Reconciliation', () => {
  it('creates reconciliation and adjusts balance', async () => {
    const acc = await api.createAccount({ name: 'Checking', type: 'bank', balance: 1000, currency: 'USD' })
    const recon = await api.createReconciliation(acc.id, 1050)
    expect(recon.difference).toBe(50)

    await api.resolveReconciliation(recon.id, true)

    const accounts = await api.getAccounts()
    expect(accounts[0].balance).toBe(1050)

    const txs = await api.getTransactions()
    expect(txs).toHaveLength(1)
    expect(txs[0].amount).toBe(50)
    expect(txs[0].type).toBe('income')
  })
})

describe('Dashboard', () => {
  it('calculates net worth correctly', async () => {
    await api.createAccount({ name: 'Checking', type: 'bank', balance: 5000, currency: 'USD' })
    await api.createAccount({ name: 'Visa', type: 'credit_card', balance: 1200, currency: 'USD' })

    const dash = await api.getDashboard()
    expect(dash.totalAssets).toBe(5000)
    expect(dash.totalDebt).toBe(1200)
    expect(dash.netWorth).toBe(3800)
  })

  it('only counts past transactions for current month', async () => {
    const acc = await api.createAccount({ name: 'Bank', type: 'bank', balance: 10000, currency: 'USD' })
    const today = todayISO()
    await api.createTransaction({ type: 'income', amount: 3000, category: 'Income', description: 'Salary', accountId: acc.id, date: today })
    await api.createTransaction({ type: 'expense', amount: 500, category: 'Housing', description: 'Rent', accountId: acc.id, date: today })

    const dash = await api.getDashboard()
    expect(dash.monthlyIncome).toBe(3000)
    expect(dash.monthlyExpenses).toBe(500)
    expect(dash.remainingBudget).toBe(2500)
  })
})
