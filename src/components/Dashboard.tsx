import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, TrendingDown, Landmark, CreditCard, CalendarClock, ArrowRight, ScanLine, Plus, PiggyBank, Sparkles, Calendar, Zap } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useStore } from '../store'
import { formatCurrency, formatDateShort, daysUntil, getWeekRange, getMonthRange, getSpendingEmoji, getFunInsight } from '../utils/helpers'
import { api } from '../utils/api'
import { DashboardData, CATEGORIES } from '../types'
import { Tab } from '../App'

const COLORS = ['#8b5cf6', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#ec4899']

interface Props {
  onNavigate: (t: Tab) => void
}

export default function Dashboard({ onNavigate }: Props) {
  const { data } = useStore()
  const { bills, settings, transactions } = data
  const cur = settings.currency
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)

  useEffect(() => {
    api.getDashboard().then(setDashboard).catch(console.error)
  }, [data.accounts, data.transactions])

  const weekRange = getWeekRange()
  const monthRange = getMonthRange()

  const weeklyExpenses = useMemo(() =>
    transactions.filter(t => t.type === 'expense' && t.date >= weekRange.start && t.date <= weekRange.end)
      .reduce((s, t) => s + t.amount, 0),
    [transactions, weekRange.start, weekRange.end]
  )

  const weeklyIncome = useMemo(() =>
    transactions.filter(t => t.type === 'income' && t.date >= weekRange.start && t.date <= weekRange.end)
      .reduce((s, t) => s + t.amount, 0),
    [transactions, weekRange.start, weekRange.end]
  )

  const monthDays = new Date().getDate()
  const dailyAvg = dashboard ? (dashboard.monthlyExpenses / Math.max(monthDays, 1)) : 0

  const topCategory = useMemo(() => {
    if (!dashboard) return ''
    let max = 0, top = ''
    for (const [cat, val] of Object.entries(dashboard.categoryBreakdown)) {
      if (val > max) { max = val; top = cat }
    }
    return top
  }, [dashboard])

  const insights = useMemo(() =>
    dashboard ? getFunInsight(weeklyExpenses, dashboard.monthlyExpenses, topCategory, dailyAvg, cur) : [],
    [dashboard, weeklyExpenses, topCategory, dailyAvg, cur]
  )

  const upcomingBills = bills
    .filter(b => !b.paid && daysUntil(b.dueDate) <= 30)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5)

  const recentTx = transactions.slice(0, 5)

  const categoryData = dashboard
    ? CATEGORIES.map((cat, i) => ({
        name: cat,
        value: dashboard.categoryBreakdown[cat] || 0,
        color: COLORS[i],
      })).filter(d => d.value > 0)
    : []

  const spendEmoji = dashboard ? getSpendingEmoji(dashboard.monthlyExpenses, dashboard.monthlyIncome) : ''

  return (
    <div className="p-4 space-y-4">
      {/* Greeting */}
      <div className="pt-2">
        <p className="text-sm text-slate-500">
          {settings.name ? `Hey ${settings.name}` : 'Your finances'} {spendEmoji}
        </p>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {dashboard ? formatCurrency(dashboard.netWorth, cur) : '—'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">net worth</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard label="Assets" value={dashboard ? formatCurrency(dashboard.totalAssets, cur) : '—'} icon={<Landmark size={15} />} gradient="from-emerald-500 to-green-600" />
        <KPICard label="Debt" value={dashboard ? formatCurrency(dashboard.totalDebt, cur) : '—'} icon={<CreditCard size={15} />} gradient="from-rose-500 to-pink-600" />
        <KPICard label="Monthly Income" value={dashboard ? formatCurrency(dashboard.monthlyIncome, cur) : '—'} icon={<TrendingUp size={15} />} gradient="from-blue-500 to-indigo-600" />
        <KPICard label="Flexible Budget" value={dashboard ? formatCurrency(dashboard.remainingBudget, cur) : '—'} icon={<PiggyBank size={15} />} gradient="from-amber-500 to-orange-600" />
      </div>

      {/* Weekly / Monthly snapshot */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={15} className="text-violet-500" />
          <h2 className="text-sm font-semibold text-slate-700">Quick Snapshot</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-violet-50 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">This Week</p>
            <p className="text-lg font-bold text-violet-700 mt-1">{formatCurrency(weeklyExpenses, cur)}</p>
            <p className="text-[10px] text-violet-400">spent · {formatCurrency(weeklyIncome, cur)} earned</p>
          </div>
          <div className="bg-indigo-50 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">This Month</p>
            <p className="text-lg font-bold text-indigo-700 mt-1">{dashboard ? formatCurrency(dashboard.monthlyExpenses, cur) : '—'}</p>
            <p className="text-[10px] text-indigo-400">spent · ~{formatCurrency(dailyAvg, cur)}/day</p>
          </div>
        </div>
      </div>

      {/* Fun insights */}
      {insights.length > 0 && (
        <div className="card bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-100">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={15} className="text-violet-500" />
            <h2 className="text-sm font-semibold text-violet-700">Insights</h2>
          </div>
          <div className="space-y-2">
            {insights.map((text, i) => (
              <p key={i} className="text-xs text-violet-600 leading-relaxed">{text}</p>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onNavigate('scanner')} className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl px-4 py-3.5 text-sm font-semibold shadow-sm">
          <ScanLine size={18} /> Scan Receipt
        </button>
        <button onClick={() => onNavigate('transactions')} className="flex items-center gap-2 bg-white text-slate-700 rounded-2xl px-4 py-3.5 text-sm font-semibold border border-slate-200 shadow-sm">
          <Plus size={18} /> Add Entry
        </button>
      </div>

      {/* Category spending chart */}
      {categoryData.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Where your money goes</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 5, right: 5 }}>
              <XAxis type="number" tickFormatter={v => `$${v}`} fontSize={10} stroke="#94a3b8" />
              <YAxis type="category" dataKey="name" width={100} fontSize={10} stroke="#94a3b8" />
              <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {categoryData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pie chart */}
      {categoryData.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                {categoryData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Upcoming bills */}
      {upcomingBills.length > 0 && (
        <Section title="Upcoming Bills" emoji="📅" action={() => onNavigate('bills')}>
          {upcomingBills.map(bill => {
            const days = daysUntil(bill.dueDate)
            const urgent = days <= 3
            return (
              <div key={bill.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <CalendarClock size={14} className={urgent ? 'text-rose-500' : 'text-slate-400'} />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{bill.name}</p>
                    <p className={`text-[11px] ${urgent ? 'text-rose-500 font-medium' : 'text-slate-400'}`}>
                      {days === 0 ? 'Due today!' : days < 0 ? `${Math.abs(days)}d overdue` : `In ${days}d — ${formatDateShort(bill.dueDate)}`}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-700">{formatCurrency(bill.amount, cur)}</span>
              </div>
            )
          })}
        </Section>
      )}

      {/* Recent transactions */}
      {recentTx.length > 0 && (
        <Section title="Recent Transactions" emoji="💸" action={() => onNavigate('transactions')}>
          {recentTx.map(tx => (
            <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-700">{tx.description || tx.merchant || tx.category}</p>
                <p className="text-[11px] text-slate-400">{formatDateShort(tx.date)} · {tx.category}</p>
              </div>
              <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, cur)}
              </span>
            </div>
          ))}
        </Section>
      )}

      {data.accounts.length === 0 && !data.loading && (
        <div className="text-center py-12 text-slate-400">
          <div className="text-4xl mb-3">🏦</div>
          <p className="font-semibold text-slate-600">No accounts yet</p>
          <p className="text-sm mt-1">Add one to start tracking your money</p>
          <button onClick={() => onNavigate('accounts')} className="mt-4 text-violet-600 text-sm font-semibold">Add account →</button>
        </div>
      )}

      <div className="h-4" />
    </div>
  )
}

function KPICard({ label, value, icon, gradient }: { label: string; value: string; icon: React.ReactNode; gradient: string }) {
  return (
    <div className="card !p-3.5">
      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-2`}>
        {icon}
      </div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-base font-bold text-slate-800 mt-0.5 truncate">{value}</p>
    </div>
  )
}

function Section({ title, emoji, action, children }: { title: string; emoji: string; action: () => void; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-700">{emoji} {title}</h2>
        <button onClick={action} className="flex items-center gap-0.5 text-xs text-violet-600 font-medium">See all <ArrowRight size={12} /></button>
      </div>
      {children}
    </div>
  )
}
