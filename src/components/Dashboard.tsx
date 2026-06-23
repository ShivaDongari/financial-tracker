import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Landmark, CreditCard, CalendarClock, ArrowRight, ScanLine, Plus, DollarSign, PiggyBank } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { useStore } from '../store'
import { formatCurrency, formatDateShort, daysUntil } from '../utils/helpers'
import { api } from '../utils/api'
import { DashboardData, CATEGORIES } from '../types'
import { Tab } from '../App'

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']

interface Props {
  onNavigate: (t: Tab) => void
}

export default function Dashboard({ onNavigate }: Props) {
  const { data } = useStore()
  const { bills, settings } = data
  const cur = settings.currency
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)

  useEffect(() => {
    api.getDashboard().then(setDashboard).catch(console.error)
  }, [data.accounts, data.transactions])

  const upcomingBills = bills
    .filter(b => !b.paid && daysUntil(b.dueDate) <= 30)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5)

  const recentTx = data.transactions.slice(0, 5)

  const categoryData = dashboard
    ? CATEGORIES.map((cat, i) => ({
        name: cat,
        value: dashboard.categoryBreakdown[cat] || 0,
        color: COLORS[i],
      })).filter(d => d.value > 0)
    : []

  return (
    <div className="p-4 space-y-5">
      <div className="pt-2">
        <p className="text-sm text-gray-500">{settings.name ? `Hi, ${settings.name}` : 'Your finances'}</p>
        <h1 className="text-2xl font-bold text-gray-900">
          {dashboard ? formatCurrency(dashboard.netWorth, cur) : '—'}
          <span className="text-sm font-normal text-gray-500 ml-2">net worth</span>
        </h1>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard label="Assets" value={dashboard ? formatCurrency(dashboard.totalAssets, cur) : '—'} icon={<Landmark size={16} className="text-green-500" />} color="green" />
        <KPICard label="Debt" value={dashboard ? formatCurrency(dashboard.totalDebt, cur) : '—'} icon={<CreditCard size={16} className="text-red-500" />} color="red" />
        <KPICard label="Income this month" value={dashboard ? formatCurrency(dashboard.monthlyIncome, cur) : '—'} icon={<TrendingUp size={16} className="text-blue-500" />} color="blue" />
        <KPICard label="Flexible Budget" value={dashboard ? formatCurrency(dashboard.remainingBudget, cur) : '—'} icon={<PiggyBank size={16} className="text-orange-500" />} color="orange" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onNavigate('scanner')} className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-3 text-sm font-medium">
          <ScanLine size={18} /> Scan Receipt
        </button>
        <button onClick={() => onNavigate('transactions')} className="flex items-center gap-2 bg-gray-100 text-gray-700 rounded-xl px-4 py-3 text-sm font-medium">
          <Plus size={18} /> Add Transaction
        </button>
      </div>

      {/* Category spending chart */}
      {categoryData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Spending by Category</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" tickFormatter={v => `$${v}`} fontSize={11} />
              <YAxis type="category" dataKey="name" width={110} fontSize={11} />
              <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
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
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {categoryData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Upcoming bills */}
      {upcomingBills.length > 0 && (
        <Section title="Upcoming Bills" action={() => onNavigate('bills')}>
          {upcomingBills.map(bill => {
            const days = daysUntil(bill.dueDate)
            const urgent = days <= 3
            return (
              <div key={bill.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <CalendarClock size={15} className={urgent ? 'text-red-500' : 'text-gray-400'} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{bill.name}</p>
                    <p className={`text-xs ${urgent ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                      {days === 0 ? 'Today' : days < 0 ? `${Math.abs(days)}d overdue` : `In ${days}d — ${formatDateShort(bill.dueDate)}`}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-800">{formatCurrency(bill.amount, cur)}</span>
              </div>
            )
          })}
        </Section>
      )}

      {/* Recent transactions */}
      {recentTx.length > 0 && (
        <Section title="Recent Transactions" action={() => onNavigate('transactions')}>
          {recentTx.map(tx => (
            <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{tx.description || tx.merchant || tx.category}</p>
                <p className="text-xs text-gray-400">{formatDateShort(tx.date)} · {tx.category}</p>
              </div>
              <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, cur)}
              </span>
            </div>
          ))}
        </Section>
      )}

      {data.accounts.length === 0 && !data.loading && (
        <div className="text-center py-10 text-gray-400">
          <Landmark size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No accounts yet</p>
          <p className="text-sm mt-1">Add an account to get started</p>
          <button onClick={() => onNavigate('accounts')} className="mt-3 text-blue-600 text-sm font-medium">Add account →</button>
        </div>
      )}

      <div className="h-4" />
    </div>
  )
}

function KPICard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const bg: Record<string, string> = { green: 'bg-green-50', red: 'bg-red-50', blue: 'bg-blue-50', orange: 'bg-orange-50' }
  return (
    <div className={`${bg[color]} rounded-xl p-3`}>
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <p className="text-base font-bold text-gray-900 truncate">{value}</p>
    </div>
  )
}

function Section({ title, action, children }: { title: string; action: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        <button onClick={action} className="flex items-center gap-0.5 text-xs text-blue-600">See all <ArrowRight size={12} /></button>
      </div>
      {children}
    </div>
  )
}
