import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, Landmark, CreditCard, CalendarClock, ArrowRight, ScanLine, Plus, PiggyBank, Sparkles, Zap, AlertTriangle, Clock, CheckCircle2, Calendar } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useStore } from '../store'
import { formatCurrency, formatDateShort, daysUntil, getWeekRange, getSpendingEmoji, getFunInsight, currentMonthName, todayFormatted } from '../utils/helpers'
import { api } from '../utils/api'
import { DashboardData, CATEGORIES } from '../types'
import { Tab } from '../App'

const COLORS = ['#8b5cf6', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#06b6d4']

interface Props { onNavigate: (t: Tab) => void }

export default function Dashboard({ onNavigate }: Props) {
  const { data } = useStore()
  const { bills, settings, transactions } = data
  const cur = settings.currency
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)

  useEffect(() => {
    api.getDashboard().then(setDashboard).catch(console.error)
  }, [data.accounts, data.transactions, data.bills])

  const weekRange = getWeekRange()
  const weeklyExpenses = useMemo(() =>
    transactions.filter(t => t.type === 'expense' && t.date >= weekRange.start && t.date <= weekRange.end).reduce((s, t) => s + t.amount, 0),
    [transactions, weekRange.start, weekRange.end])
  const weeklyIncome = useMemo(() =>
    transactions.filter(t => t.type === 'income' && t.date >= weekRange.start && t.date <= weekRange.end).reduce((s, t) => s + t.amount, 0),
    [transactions, weekRange.start, weekRange.end])

  const monthDays = new Date().getDate()
  const dailyAvg = dashboard ? (dashboard.monthlyExpenses / Math.max(monthDays, 1)) : 0
  const topCategory = useMemo(() => {
    if (!dashboard) return ''
    let max = 0, top = ''
    for (const [cat, val] of Object.entries(dashboard.categoryBreakdown)) { if (val > max) { max = val; top = cat } }
    return top
  }, [dashboard])
  const insights = useMemo(() => dashboard ? getFunInsight(weeklyExpenses, dashboard.monthlyExpenses, topCategory, dailyAvg, cur) : [], [dashboard, weeklyExpenses, topCategory, dailyAvg, cur])

  const upcomingBills = bills.filter(b => !b.paid && !b.noDueDate && daysUntil(b.dueDate) <= 30 && daysUntil(b.dueDate) >= 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5)
  const recentTx = transactions.slice(0, 8)
  const categoryData = dashboard ? CATEGORIES.map((cat, i) => ({ name: cat, value: dashboard.categoryBreakdown[cat] || 0, color: COLORS[i % COLORS.length] })).filter(d => d.value > 0) : []
  const spendEmoji = dashboard ? getSpendingEmoji(dashboard.monthlyExpenses, dashboard.monthlyIncome) : ''

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 pt-2 lg:pt-0">
        <div>
          <p className="text-sm t-secondary">{settings.name ? `Welcome back, ${settings.name}` : 'Financial Overview'} {spendEmoji}</p>
          <h1 className="text-3xl lg:text-4xl font-extrabold t-primary tracking-tight mt-1">
            {dashboard ? formatCurrency(dashboard.netWorth, cur) : '—'}
          </h1>
          <p className="text-xs t-muted mt-0.5">Net Worth · As of {todayFormatted()}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium t-muted bg-[var(--bg-hover)] px-3 py-1.5 rounded-lg">
            <Calendar size={12} className="inline mr-1" />{currentMonthName()}
          </span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Total Assets" value={dashboard ? formatCurrency(dashboard.totalAssets, cur) : '—'} icon={<Landmark size={16} />} gradient="from-emerald-500 to-green-600" onClick={() => onNavigate('detailed-assets')} />
        <KPICard label="Total Debt" value={dashboard ? formatCurrency(dashboard.totalDebt, cur) : '—'} icon={<CreditCard size={16} />} gradient="from-rose-500 to-pink-600" onClick={() => onNavigate('detailed-loans')} />
        <KPICard label="Monthly Income" value={dashboard ? formatCurrency(dashboard.monthlyIncome, cur) : '—'} icon={<TrendingUp size={16} />} gradient="from-blue-500 to-indigo-600" onClick={() => onNavigate('all-months-income')} />
        <KPICard label="Flexible Budget" value={dashboard ? formatCurrency(dashboard.remainingBudget, cur) : '—'} icon={<PiggyBank size={16} />} gradient="from-amber-500 to-orange-600" />
      </div>

      {/* Financial Position — scheduled vs current */}
      {dashboard && (dashboard.scheduledExpenses > 0 || dashboard.overdueCount > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat label="Current Cash" value={formatCurrency(dashboard.totalAssets, cur)} icon={<CheckCircle2 size={14} />} color="text-emerald-600" />
          <MiniStat label="Scheduled" value={formatCurrency(dashboard.scheduledExpenses, cur)} icon={<Clock size={14} />} color="text-blue-500" />
          <MiniStat label="Due Soon" value={String(dashboard.dueSoonCount)} icon={<AlertTriangle size={14} />} color="text-amber-500" />
          <MiniStat label="Overdue" value={String(dashboard.overdueCount)} icon={<AlertTriangle size={14} />} color="text-rose-500" />
        </div>
      )}

      {/* Two column desktop layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-5">
          {/* Weekly / Monthly snapshot */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={15} className="text-violet-500" />
              <h2 className="text-sm font-semibold t-primary">Spending Snapshot</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ background: 'rgba(139,92,246,.08)' }}>
                <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">This Week</p>
                <p className="text-lg font-bold text-violet-600 mt-1">{formatCurrency(weeklyExpenses, cur)}</p>
                <p className="text-[10px] text-violet-400">spent · {formatCurrency(weeklyIncome, cur)} earned</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(99,102,241,.08)' }}>
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">This Month</p>
                <p className="text-lg font-bold text-indigo-600 mt-1">{dashboard ? formatCurrency(dashboard.monthlyExpenses, cur) : '—'}</p>
                <p className="text-[10px] text-indigo-400">spent · ~{formatCurrency(dailyAvg, cur)}/day</p>
              </div>
            </div>
          </div>

          {/* Category chart */}
          {categoryData.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold t-primary mb-3">Spending by Category</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 5, right: 5 }}>
                  <XAxis type="number" tickFormatter={v => `$${v}`} fontSize={10} stroke="var(--text-muted)" />
                  <YAxis type="category" dataKey="name" width={110} fontSize={10} stroke="var(--text-muted)" />
                  <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.08)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pie chart */}
          {categoryData.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold t-primary mb-3">Distribution</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                    {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.08)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Insights */}
          {insights.length > 0 && (
            <div className="card" style={{ background: 'rgba(139,92,246,.06)', borderColor: 'rgba(139,92,246,.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={15} className="text-violet-500" />
                <h2 className="text-sm font-semibold text-violet-600">Insights</h2>
              </div>
              {insights.map((text, i) => <p key={i} className="text-xs text-violet-500 leading-relaxed mb-1">{text}</p>)}
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onNavigate('scanner')} className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl px-4 py-3.5 text-sm font-semibold shadow-sm">
              <ScanLine size={18} /> Scan Receipt
            </button>
            <button onClick={() => onNavigate('transactions')} className="flex items-center gap-2 card rounded-2xl px-4 py-3.5 text-sm font-semibold t-primary">
              <Plus size={18} /> Add Entry
            </button>
          </div>

          {/* Upcoming bills */}
          {upcomingBills.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold t-primary">📅 Upcoming Bills</h2>
                <button onClick={() => onNavigate('bills')} className="flex items-center gap-0.5 text-xs text-violet-600 font-medium">See all <ArrowRight size={12} /></button>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-card)' }}>
                {upcomingBills.map(bill => {
                  const days = daysUntil(bill.dueDate)
                  const urgent = days <= 3
                  return (
                    <div key={bill.id} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2.5">
                        <CalendarClock size={14} className={urgent ? 'text-rose-500' : 't-muted'} />
                        <div>
                          <p className="text-sm font-medium t-primary">{bill.name}</p>
                          <p className={`text-[11px] ${urgent ? 'text-rose-500 font-medium' : 't-muted'}`}>
                            {days === 0 ? 'Due today!' : `In ${days}d — ${formatDateShort(bill.dueDate)}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold t-primary">{formatCurrency(bill.amount, cur)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent transactions */}
          {recentTx.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold t-primary">💸 Recent Transactions</h2>
                <button onClick={() => onNavigate('transactions')} className="flex items-center gap-0.5 text-xs text-violet-600 font-medium">See all <ArrowRight size={12} /></button>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-card)' }}>
                {recentTx.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium t-primary">{tx.description || tx.merchant || tx.category}</p>
                      <p className="text-[11px] t-muted">{formatDateShort(tx.date)} · {tx.category}</p>
                    </div>
                    <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, cur)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {data.accounts.length === 0 && !data.loading && (
        <div className="text-center py-16 t-muted">
          <div className="text-5xl mb-4">🏦</div>
          <p className="font-semibold t-secondary text-lg">Get Started</p>
          <p className="text-sm mt-1 max-w-sm mx-auto">Add your first account to start tracking income, expenses, and financial goals.</p>
          <button onClick={() => onNavigate('accounts')} className="mt-5 btn-primary px-8 py-3 inline-block">Add Your First Account</button>
        </div>
      )}
    </div>
  )
}

function KPICard({ label, value, icon, gradient, onClick }: { label: string; value: string; icon: React.ReactNode; gradient: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`card !p-4 w-full text-left ${onClick ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-2.5`}>{icon}</div>
      <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold t-primary mt-0.5 truncate">{value}</p>
      {onClick && <p className="text-[9px] text-violet-500 mt-1.5">View details →</p>}
    </button>
  )
}

function MiniStat({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="card !p-3 flex items-center gap-3">
      <span className={color}>{icon}</span>
      <div>
        <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
      </div>
    </div>
  )
}
