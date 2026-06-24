import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Landmark, CreditCard, CalendarClock, ArrowRight, Plus, PiggyBank, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useStore } from '../store'
import { formatCurrency, formatDateShort, daysUntil, getWeekRange, getFunInsight, todayFormatted, monthKeyToLabel, getMonthStartEnd } from '../utils/helpers'
import { api } from '../utils/api'
import { DashboardData, CATEGORIES } from '../types'
import MonthSelector from './MonthSelector'
import { BudgetSummaryWidget } from './Budgets'

const COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#06b6d4', '#8b5cf6', '#14b8a6', '#f97316', '#64748b', '#a855f7']

export default function Dashboard() {
  const navigate = useNavigate()
  const bills = useStore(s => s.bills)
  const settings = useStore(s => s.settings)
  const transactions = useStore(s => s.transactions)
  const accounts = useStore(s => s.accounts)
  const selectedMonth = useStore(s => s.selectedMonth)
  const loading = useStore(s => s.loading)
  const cur = settings.currency
  const [dash, setDash] = useState<DashboardData | null>(null)

  useEffect(() => {
    api.getDashboard(selectedMonth).then(setDash).catch(console.error)
  }, [accounts, transactions, bills, selectedMonth])

  const { start: mStart, end: mEnd } = getMonthStartEnd(selectedMonth)
  const weekRange = getWeekRange()

  const weeklyExpenses = useMemo(() =>
    transactions.filter(t => t.type === 'expense' && t.date >= weekRange.start && t.date <= weekRange.end).reduce((s, t) => s + t.amount, 0),
    [transactions, weekRange.start, weekRange.end])

  const monthDays = new Date().getDate()
  const dailyAvg = dash ? (dash.monthlyExpenses / Math.max(monthDays, 1)) : 0
  const topCategory = useMemo(() => {
    if (!dash) return ''
    let max = 0, top = ''
    for (const [cat, val] of Object.entries(dash.categoryBreakdown)) { if (val > max) { max = val; top = cat } }
    return top
  }, [dash])
  const insights = useMemo(() => dash ? getFunInsight(weeklyExpenses, dash.monthlyExpenses, topCategory, dailyAvg, cur) : [], [dash, weeklyExpenses, topCategory, dailyAvg, cur])

  const upcomingBills = bills.filter(b => !b.paid && !b.noDueDate && daysUntil(b.dueDate) >= 0 && daysUntil(b.dueDate) <= 30).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6)
  const recentTx = transactions.filter(t => t.date >= mStart && t.date <= mEnd).slice(0, 8)
  const categoryData = dash ? CATEGORIES.map((cat, i) => ({ name: cat, value: dash.categoryBreakdown[cat] || 0, color: COLORS[i % COLORS.length] })).filter(d => d.value > 0) : []

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p className="text-xs t-muted">As of {todayFormatted()}</p>
          <h1 className="text-2xl lg:text-3xl font-bold t-primary mt-0.5">{dash ? formatCurrency(dash.netWorth, cur) : '—'}</h1>
          <p className="text-xs t-secondary mt-0.5">Net Worth</p>
        </div>
        <div className="lg:hidden"><MonthSelector /></div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Assets" value={dash ? formatCurrency(dash.totalAssets, cur) : '—'} icon={<Landmark size={15} />} color="var(--success)" onClick={() => navigate('/assets')} />
        <KPI label="Liabilities" value={dash ? formatCurrency(dash.totalDebt, cur) : '—'} icon={<CreditCard size={15} />} color="var(--danger)" onClick={() => navigate('/loans')} />
        <KPI label="Income" value={dash ? formatCurrency(dash.monthlyIncome, cur) : '—'} icon={<TrendingUp size={15} />} color="var(--accent)" onClick={() => navigate('/income-history')} sub={monthKeyToLabel(selectedMonth)} />
        <KPI label="Budget Left" value={dash ? formatCurrency(dash.remainingBudget, cur) : '—'} icon={<PiggyBank size={15} />} color="var(--warning)" sub={`of ${dash ? formatCurrency(dash.monthlyIncome, cur) : '—'} income`} />
      </div>

      {/* Financial Position */}
      {dash && (dash.scheduledExpenses > 0 || dash.overdueCount > 0 || dash.dueSoonCount > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Available" val={formatCurrency(dash.totalAssets, cur)} icon={<CheckCircle2 size={13} />} cls="text-[var(--success)]" />
          <Stat label="Scheduled" val={formatCurrency(dash.scheduledExpenses, cur)} icon={<Clock size={13} />} cls="t-accent" />
          <Stat label="Due Soon" val={String(dash.dueSoonCount)} icon={<AlertTriangle size={13} />} cls="text-[var(--warning)]" />
          <Stat label="Overdue" val={String(dash.overdueCount)} icon={<AlertTriangle size={13} />} cls="text-[var(--danger)]" />
        </div>
      )}

      {/* Monthly Obligations */}
      {dash && (dash.debtSummary.totalOutstanding > 0 || dash.totalDueThisMonth > 0) && (
        <div className="card">
          <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider mb-3">Monthly Obligations</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <MiniCard label="Total Debt" value={formatCurrency(dash.debtSummary.totalOutstanding, cur)} bg="var(--danger-light)" color="var(--danger)" />
            <MiniCard label="Due This Month" value={formatCurrency(dash.debtSummary.dueThisMonth, cur)} bg="var(--warning-light)" color="var(--warning)" />
            <MiniCard label="Bills" value={formatCurrency(dash.debtSummary.billsDue, cur)} bg="var(--bg-accent)" color="var(--accent)" />
            <MiniCard label="Subscriptions" value={formatCurrency(dash.debtSummary.subscriptionsDue, cur)} bg="var(--bg-accent)" color="var(--accent)" />
            <MiniCard label="Loan Payments" value={formatCurrency(dash.debtSummary.loanPaymentsDue, cur)} bg="var(--bg-accent)" color="var(--accent)" />
          </div>
        </div>
      )}

      {/* Two-col desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-5">
          {/* Spending snapshot */}
          <div className="card">
            <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider mb-3">Spending Overview</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-accent)' }}>
                <p className="text-[10px] font-medium t-muted">This Week</p>
                <p className="text-base font-bold t-primary mt-0.5">{formatCurrency(weeklyExpenses, cur)}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-accent)' }}>
                <p className="text-[10px] font-medium t-muted">This Month</p>
                <p className="text-base font-bold t-primary mt-0.5">{dash ? formatCurrency(dash.monthlyExpenses, cur) : '—'}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-accent)' }}>
                <p className="text-[10px] font-medium t-muted">Daily Avg</p>
                <p className="text-base font-bold t-primary mt-0.5">{formatCurrency(dailyAvg, cur)}</p>
              </div>
            </div>
          </div>

          {/* Category bar chart */}
          {categoryData.length > 0 && (
            <div className="card">
              <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider mb-3">Expenses by Category</h2>
              <ResponsiveContainer width="100%" height={Math.max(160, categoryData.length * 32)}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 0 }}>
                  <XAxis type="number" tickFormatter={v => `$${v}`} fontSize={10} stroke="var(--text-muted)" />
                  <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="var(--text-muted)" />
                  <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent transactions table */}
          {recentTx.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
                <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider">Recent Transactions</h2>
                <button onClick={() => navigate('/transactions')} className="text-[11px] t-accent font-medium flex items-center gap-0.5">View all <ArrowRight size={11} /></button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr>
                    <th className="table-header">Date</th><th className="table-header">Description</th>
                    <th className="table-header">Category</th><th className="table-header text-right">Amount</th>
                  </tr></thead>
                  <tbody>
                    {recentTx.map(tx => (
                      <tr key={tx.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="table-cell whitespace-nowrap text-xs t-muted">{formatDateShort(tx.date)}</td>
                        <td className="table-cell font-medium">{tx.description || tx.merchant || '—'}</td>
                        <td className="table-cell"><span className="badge badge-accent">{tx.category}</span></td>
                        <td className={`table-cell text-right font-semibold ${tx.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, cur)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-5">
          {categoryData.length > 0 && (
            <div className="card">
              <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider mb-3">Distribution</h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} fontSize={9}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <BudgetSummaryWidget />

          {insights.length > 0 && (
            <div className="card">
              <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Insights</h2>
              {insights.map((t, i) => <p key={i} className="text-xs t-secondary leading-relaxed mb-1">{t}</p>)}
            </div>
          )}

          {upcomingBills.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
                <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider">Upcoming Bills</h2>
                <button onClick={() => navigate('/bills')} className="text-[11px] t-accent font-medium flex items-center gap-0.5">View all <ArrowRight size={11} /></button>
              </div>
              {upcomingBills.map(bill => {
                const days = daysUntil(bill.dueDate)
                return (
                  <div key={bill.id} className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 border-theme hover:bg-[var(--bg-hover)]">
                    <div className="flex items-center gap-2">
                      <CalendarClock size={13} className={days <= 3 ? 'text-[var(--danger)]' : 't-muted'} />
                      <div>
                        <p className="text-sm font-medium t-primary">{bill.name}</p>
                        <p className="text-[11px] t-muted">{days === 0 ? 'Due today' : `${days}d — ${formatDateShort(bill.dueDate)}`}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold t-primary">{formatCurrency(bill.amount, cur)}</span>
                  </div>
                )
              })}
            </div>
          )}

          <button onClick={() => navigate('/transactions')} className="w-full card-hover flex items-center justify-center gap-2 py-3 t-accent font-medium text-sm">
            <Plus size={16} /> Add Transaction
          </button>
        </div>
      </div>

      {accounts.length === 0 && !loading && (
        <div className="text-center py-16">
          <p className="t-secondary font-medium text-lg">Welcome to FinTracker</p>
          <p className="text-sm t-muted mt-1">Add your first account to begin.</p>
          <button onClick={() => navigate('/accounts')} className="mt-4 btn-primary">Add Account</button>
        </div>
      )}
    </div>
  )
}

function KPI({ label, value, icon, color, onClick, sub }: { label: string; value: string; icon: React.ReactNode; color: string; onClick?: () => void; sub?: string }) {
  return (
    <button onClick={onClick} className={`card !p-3.5 w-full text-left ${onClick ? 'card-hover cursor-pointer' : ''}`}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white mb-2" style={{ background: color }}>{icon}</div>
      <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">{label}</p>
      <p className="text-base font-bold t-primary mt-0.5 truncate">{value}</p>
      {sub && <p className="text-[10px] t-muted mt-0.5 truncate">{sub}</p>}
      {onClick && <p className="text-[10px] t-accent mt-1">View details →</p>}
    </button>
  )
}

function Stat({ label, val, icon, cls }: { label: string; val: string; icon: React.ReactNode; cls: string }) {
  return (
    <div className="card !p-3 flex items-center gap-2.5">
      <span className={cls}>{icon}</span>
      <div>
        <p className="text-[10px] font-medium t-muted uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-bold ${cls}`}>{val}</p>
      </div>
    </div>
  )
}

function MiniCard({ label, value, bg, color }: { label: string; value: string; bg: string; color: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: bg }}>
      <p className="text-[10px] font-medium t-muted">{label}</p>
      <p className="text-sm font-bold" style={{ color }}>{value}</p>
    </div>
  )
}
