import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(__dirname, '..', 'dev.db')
const adapter = new PrismaLibSql({ url: `file:${dbPath}` })

const app = express()
const prisma = new PrismaClient({ adapter })

app.use(cors())
app.use(express.json({ limit: '10mb' }))

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch(e => {
      console.error(`${req.method} ${req.path} error:`, e)
      res.status(500).json({ error: String(e) })
    })
  }
}

// ── Settings ──

app.get('/api/settings', wrap(async (_req, res) => {
  let settings = await prisma.setting.findUnique({ where: { id: 'app' } })
  if (!settings) settings = await prisma.setting.create({ data: { id: 'app' } })
  res.json(settings)
}))

app.put('/api/settings', wrap(async (req, res) => {
  const { currency, name } = req.body
  const settings = await prisma.setting.upsert({
    where: { id: 'app' },
    update: { currency, name },
    create: { id: 'app', currency, name },
  })
  res.json(settings)
}))

// ── Accounts ──

app.get('/api/accounts', wrap(async (_req, res) => {
  const accounts = await prisma.account.findMany({ orderBy: { createdAt: 'desc' } })
  res.json(accounts)
}))

app.post('/api/accounts', wrap(async (req, res) => {
  const account = await prisma.account.create({ data: req.body })
  res.json(account)
}))

app.put('/api/accounts/:id', wrap(async (req, res) => {
  const account = await prisma.account.update({ where: { id: req.params.id }, data: req.body })
  res.json(account)
}))

app.delete('/api/accounts/:id', wrap(async (req, res) => {
  await prisma.account.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
}))

// ── Transactions ──

app.get('/api/transactions', wrap(async (_req, res) => {
  const txs = await prisma.transaction.findMany({
    include: { lineItems: true },
    orderBy: { date: 'desc' },
  })
  res.json(txs)
}))

app.post('/api/transactions', wrap(async (req, res) => {
  const { lineItems, ...txData } = req.body
  const tx = await prisma.transaction.create({
    data: {
      ...txData,
      lineItems: lineItems?.length ? { create: lineItems } : undefined,
    },
    include: { lineItems: true },
  })
  res.json(tx)
}))

app.put('/api/transactions/:id', wrap(async (req, res) => {
  const { id } = req.params
  const { lineItems, ...txData } = req.body
  await prisma.transactionLineItem.deleteMany({ where: { transactionId: id } })
  const tx = await prisma.transaction.update({
    where: { id },
    data: {
      ...txData,
      lineItems: lineItems?.length ? { create: lineItems } : undefined,
    },
    include: { lineItems: true },
  })
  res.json(tx)
}))

app.delete('/api/transactions/:id', wrap(async (req, res) => {
  await prisma.transaction.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
}))

// ── Bills ──

app.get('/api/bills', wrap(async (_req, res) => {
  const bills = await prisma.bill.findMany({ orderBy: { dueDate: 'asc' } })
  res.json(bills)
}))

app.post('/api/bills', wrap(async (req, res) => {
  const bill = await prisma.bill.create({ data: req.body })
  res.json(bill)
}))

app.put('/api/bills/:id', wrap(async (req, res) => {
  const bill = await prisma.bill.update({ where: { id: req.params.id }, data: req.body })
  res.json(bill)
}))

app.delete('/api/bills/:id', wrap(async (req, res) => {
  await prisma.bill.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
}))

// ── Dashboard aggregates ──

app.get('/api/dashboard', wrap(async (_req, res) => {
  const accounts = await prisma.account.findMany()
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: monthStart, lt: monthEnd } },
    include: { lineItems: true },
  })

  const totalAssets = accounts
    .filter(a => a.type === 'bank' || a.type === 'cash' || a.type === 'income')
    .reduce((s, a) => s + a.balance, 0)
  const totalDebt = accounts
    .filter(a => a.type === 'credit_card' || a.type === 'loan')
    .reduce((s, a) => s + a.balance, 0)

  const monthlyIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0)
  const monthlyExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0)

  const categoryBreakdown: Record<string, number> = {}
  for (const tx of transactions.filter(t => t.type === 'expense')) {
    if (tx.lineItems.length) {
      for (const li of tx.lineItems) {
        categoryBreakdown[li.category] = (categoryBreakdown[li.category] || 0) + li.amount
      }
    } else {
      categoryBreakdown[tx.category] = (categoryBreakdown[tx.category] || 0) + tx.amount
    }
  }

  res.json({
    totalAssets,
    totalDebt,
    netWorth: totalAssets - totalDebt,
    monthlyIncome,
    monthlyExpenses,
    remainingBudget: monthlyIncome - monthlyExpenses,
    categoryBreakdown,
  })
}))

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`API server on http://localhost:${PORT}`))
