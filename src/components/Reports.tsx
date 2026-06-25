import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, ArrowLeft } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Area, AreaChart } from 'recharts'
import { useStore } from '../store'
import { formatCurrency, getMonthlyBreakdown, monthKeyToLabel } from '../utils/helpers'
import { CATEGORIES } from '../types'

type ReportTab = 'overview' | 'categories' | 'networth' | 'forecast' | 'tax'

export default function Reports() {
  const navigate = useNavigate()
  const transactions = useStore(s => s.transactions)
  const accounts = useStore(s => s.accounts)
  const bills = useStore(s => s.bills)
  const subscriptions = useStore(s => s.subscriptions)
  const settings = useStore(s => s.settings)
  const cur = settings.currency
  const [tab, setTab] = useState<ReportTab>('overview')
  const [taxYear, setTaxYear] = useState(new Date().getFullYear())

  // Monthly income/expense data (last 12 months)
  const monthlyData = useMemo(() => {
    const incomeMap: Record<string, number> = {}
    const expenseMap: Record<string, number> = {}
    for (const t of transactions) {
      const key = t.date.slice(0, 7)
      if (t.type === 'income') incomeMap[key] = (incomeMap[key] || 0) + t.amount
      if (t.type === 'expense') expenseMap[key] = (expenseMap[key] || 0) + t.amount
    }
    const allKeys = [...new Set([...Object.keys(incomeMap), ...Object.keys(expenseMap)])].sort().slice(-12)
    return allKeys.map(k => ({
      month: monthKeyToLabel(k).split(' ')[0].slice(0, 3),
      key: k,
      income: incomeMap[k] || 0,
      expense: expenseMap[k] || 0,
      net: (incomeMap[k] || 0) - (expenseMap[k] || 0),
    }))
  }, [transactions])

  // Category month-over-month
  const categoryMonthly = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const t of transactions.filter(t => t.type === 'expense')) {
      const mk = t.date.slice(0, 7)
      if (!map[mk]) map[mk] = {}
      const cat = t.category
      if (t.lineItems?.length) {
        for (const li of t.lineItems) map[mk][li.category] = (map[mk][li.category] || 0) + li.amount
      } else {
        map[mk][cat] = (map[mk][cat] || 0) + t.amount
      }
    }
    const months = Object.keys(map).sort().slice(-6)
    return months.map(mk => {
      const row: Record<string, any> = { month: monthKeyToLabel(mk).split(' ')[0].slice(0, 3) }
      for (const cat of CATEGORIES) row[cat] = map[mk]?.[cat] || 0
      return row
    })
  }, [transactions])

  // Net worth over time (cumulative)
  const netWorthData = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
    const map: Record<string, number> = {}
    let running = 0
    for (const t of sorted) {
      const mk = t.date.slice(0, 7)
      if (t.type === 'income') running += t.amount
      else if (t.type === 'expense') running -= t.amount
      map[mk] = running
    }
    const totalDebt = accounts.filter(a => ['credit_card', 'loan'].includes(a.type)).reduce((s, a) => s + a.balance, 0)
    const baseAssets = accounts.filter(a => ['bank', 'cash', 'income'].includes(a.type)).reduce((s, a) => s + a.balance, 0)
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([mk, cumNet]) => ({
      month: monthKeyToLabel(mk).split(' ')[0].slice(0, 3),
      netWorth: baseAssets - totalDebt + cumNet - (map[Object.keys(map).sort().pop()!] || 0),
    }))
  }, [transactions, accounts])

  // Cash flow forecast (3 months ahead)
  const forecastData = useMemo(() => {
    if (monthlyData.length < 3) return []
    const last3Income = monthlyData.slice(-3).map(m => m.income)
    const last3Expense = monthlyData.slice(-3).map(m => m.expense)
    const avgIncome = last3Income.reduce((s, v) => s + v, 0) / 3
    const avgExpense = last3Expense.reduce((s, v) => s + v, 0) / 3

    const now = new Date()
    const result = []
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1)
      result.push({
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        projectedIncome: Math.round(avgIncome),
        projectedExpense: Math.round(avgExpense),
        projectedNet: Math.round(avgIncome - avgExpense),
      })
    }
    return result
  }, [monthlyData])

  // Tax summary by year
  const taxData = useMemo(() => {
    const yearTxs = transactions.filter(t => t.date.startsWith(String(taxYear)))
    const incomeByCategory: Record<string, number> = {}
    const expenseByCategory: Record<string, number> = {}

    for (const t of yearTxs) {
      const cat = t.category
      if (t.type === 'income') incomeByCategory[cat] = (incomeByCategory[cat] || 0) + t.amount
      if (t.type === 'expense') {
        if (t.lineItems?.length) {
          for (const li of t.lineItems) expenseByCategory[li.category] = (expenseByCategory[li.category] || 0) + li.amount
        } else {
          expenseByCategory[cat] = (expenseByCategory[cat] || 0) + t.amount
        }
      }
    }

    const totalIncome = Object.values(incomeByCategory).reduce((s, v) => s + v, 0)
    const totalExpense = Object.values(expenseByCategory).reduce((s, v) => s + v, 0)

    return { incomeByCategory, expenseByCategory, totalIncome, totalExpense, net: totalIncome - totalExpense }
  }, [transactions, taxYear])

  function exportTaxCsv() {
    let csv = `Tax Report ${taxYear}\n\nINCOME\nCategory,Amount\n`
    for (const [cat, amt] of Object.entries(taxData.incomeByCategory)) csv += `${cat},${amt.toFixed(2)}\n`
    csv += `Total Income,${taxData.totalIncome.toFixed(2)}\n\nEXPENSES\nCategory,Amount\n`
    for (const [cat, amt] of Object.entries(taxData.expenseByCategory)) csv += `${cat},${amt.toFixed(2)}\n`
    csv += `Total Expenses,${taxData.totalExpense.toFixed(2)}\nNet,${taxData.net.toFixed(2)}\n`

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `tax-report-${taxYear}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const chartStyle = { borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }
  const CHART_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#06b6d4', '#8b5cf6', '#14b8a6', '#f97316', '#64748b', '#a855f7']

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] t-secondary"><ArrowLeft size={18} /></button>
        <h1 className="text-xl font-bold t-primary">Reports & Analytics</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg overflow-hidden border border-theme w-fit">
        {([['overview', 'Overview'], ['categories', 'Categories'], ['networth', 'Net Worth'], ['forecast', 'Forecast'], ['tax', 'Tax Export']] as [ReportTab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 text-xs font-medium ${tab === id ? 'text-white' : 't-secondary'}`}
            style={tab === id ? { background: 'var(--accent)' } : undefined}>{label}</button>
        ))}
      </div>

      {/* Overview — Income vs Expenses line chart */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider mb-3">Income vs Expenses (12 months)</h2>
            {monthlyData.length > 1 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" fontSize={11} stroke="var(--text-muted)" />
                  <YAxis fontSize={11} stroke="var(--text-muted)" tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} contentStyle={chartStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} name="Income" dot={false} />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} name="Expenses" dot={false} />
                  <Line type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" name="Net" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm t-muted text-center py-8">Need at least 2 months of data for trend charts.</p>}
          </div>

          {/* Monthly breakdown table */}
          {monthlyData.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <table className="w-full">
                <thead><tr>
                  <th className="table-header">Month</th>
                  <th className="table-header text-right">Income</th>
                  <th className="table-header text-right">Expenses</th>
                  <th className="table-header text-right">Net</th>
                </tr></thead>
                <tbody>
                  {[...monthlyData].reverse().map(m => (
                    <tr key={m.key} className="hover:bg-[var(--bg-hover)]">
                      <td className="table-cell font-medium">{monthKeyToLabel(m.key)}</td>
                      <td className="table-cell text-right text-[var(--success)]">{formatCurrency(m.income, cur)}</td>
                      <td className="table-cell text-right text-[var(--danger)]">{formatCurrency(m.expense, cur)}</td>
                      <td className={`table-cell text-right font-semibold ${m.net >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{formatCurrency(m.net, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Categories — stacked bar chart */}
      {tab === 'categories' && (
        <div className="card">
          <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider mb-3">Category Spending (6 months)</h2>
          {categoryMonthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryMonthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" fontSize={11} stroke="var(--text-muted)" />
                <YAxis fontSize={11} stroke="var(--text-muted)" tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} contentStyle={chartStyle} />
                <Legend />
                {CATEGORIES.filter(c => categoryMonthly.some(m => m[c] > 0)).map((cat, i) => (
                  <Bar key={cat} dataKey={cat} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm t-muted text-center py-8">No expense data to display.</p>}
        </div>
      )}

      {/* Net Worth */}
      {tab === 'networth' && (
        <div className="card">
          <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider mb-3">Net Worth Over Time</h2>
          {netWorthData.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={netWorthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" fontSize={11} stroke="var(--text-muted)" />
                <YAxis fontSize={11} stroke="var(--text-muted)" tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} contentStyle={chartStyle} />
                <Area type="monotone" dataKey="netWorth" stroke="#6366f1" fill="#6366f140" name="Net Worth" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-sm t-muted text-center py-8">Need transaction history to plot net worth growth.</p>}
        </div>
      )}

      {/* Forecast */}
      {tab === 'forecast' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider mb-3">3-Month Cash Flow Forecast</h2>
            <p className="text-xs t-muted mb-3">Based on your last 3 months average income and expenses.</p>
            {forecastData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" fontSize={11} stroke="var(--text-muted)" />
                  <YAxis fontSize={11} stroke="var(--text-muted)" tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} contentStyle={chartStyle} />
                  <Legend />
                  <Bar dataKey="projectedIncome" fill="#22c55e" name="Projected Income" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="projectedExpense" fill="#ef4444" name="Projected Expense" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm t-muted text-center py-8">Need at least 3 months of data to generate forecasts.</p>}
          </div>

          {forecastData.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <table className="w-full">
                <thead><tr>
                  <th className="table-header">Month</th>
                  <th className="table-header text-right">Projected Income</th>
                  <th className="table-header text-right">Projected Expenses</th>
                  <th className="table-header text-right">Projected Net</th>
                </tr></thead>
                <tbody>
                  {forecastData.map(f => (
                    <tr key={f.month}>
                      <td className="table-cell font-medium">{f.month}</td>
                      <td className="table-cell text-right text-[var(--success)]">{formatCurrency(f.projectedIncome, cur)}</td>
                      <td className="table-cell text-right text-[var(--danger)]">{formatCurrency(f.projectedExpense, cur)}</td>
                      <td className={`table-cell text-right font-semibold ${f.projectedNet >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{formatCurrency(f.projectedNet, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tax Export */}
      {tab === 'tax' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider">Tax Summary</h2>
              <div className="flex items-center gap-2">
                <select className="input !w-auto !py-1.5 text-xs" value={taxYear} onChange={e => setTaxYear(parseInt(e.target.value))}>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={exportTaxCsv} className="btn-primary !py-1.5 text-xs"><Download size={13} className="inline mr-1" />Export CSV</button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg p-3" style={{ background: 'var(--success-light)' }}>
                <p className="text-[10px] font-medium t-muted">Total Income</p>
                <p className="text-base font-bold text-[var(--success)]">{formatCurrency(taxData.totalIncome, cur)}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--danger-light)' }}>
                <p className="text-[10px] font-medium t-muted">Total Expenses</p>
                <p className="text-base font-bold text-[var(--danger)]">{formatCurrency(taxData.totalExpense, cur)}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-accent)' }}>
                <p className="text-[10px] font-medium t-muted">Net</p>
                <p className={`text-base font-bold ${taxData.net >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{formatCurrency(taxData.net, cur)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card !p-0 overflow-hidden">
              <p className="px-4 py-2.5 text-xs font-semibold t-secondary uppercase tracking-wider border-b border-theme">Income Breakdown</p>
              <table className="w-full">
                <tbody>
                  {Object.entries(taxData.incomeByCategory).sort(([, a], [, b]) => b - a).map(([cat, amt]) => (
                    <tr key={cat} className="hover:bg-[var(--bg-hover)]">
                      <td className="table-cell text-sm">{cat}</td>
                      <td className="table-cell text-right font-semibold text-[var(--success)]">{formatCurrency(amt, cur)}</td>
                    </tr>
                  ))}
                  {Object.keys(taxData.incomeByCategory).length === 0 && (
                    <tr><td colSpan={2} className="table-cell text-center t-muted py-4">No income recorded for {taxYear}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="card !p-0 overflow-hidden">
              <p className="px-4 py-2.5 text-xs font-semibold t-secondary uppercase tracking-wider border-b border-theme">Expense Breakdown</p>
              <table className="w-full">
                <tbody>
                  {Object.entries(taxData.expenseByCategory).sort(([, a], [, b]) => b - a).map(([cat, amt]) => (
                    <tr key={cat} className="hover:bg-[var(--bg-hover)]">
                      <td className="table-cell text-sm">{cat}</td>
                      <td className="table-cell text-right font-semibold text-[var(--danger)]">{formatCurrency(amt, cur)}</td>
                    </tr>
                  ))}
                  {Object.keys(taxData.expenseByCategory).length === 0 && (
                    <tr><td colSpan={2} className="table-cell text-center t-muted py-4">No expenses recorded for {taxYear}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
