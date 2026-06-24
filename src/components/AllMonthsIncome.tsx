import { useMemo } from 'react'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useStore } from '../store'
import { formatCurrency, getMonthlyBreakdown } from '../utils/helpers'

interface Props { onBack: () => void }

export default function AllMonthsIncome({ onBack }: Props) {
  const { data } = useStore()
  const cur = data.settings.currency

  const monthlyIncome = useMemo(() =>
    getMonthlyBreakdown(data.transactions, 'income'),
    [data.transactions]
  )

  const monthlyExpenses = useMemo(() =>
    getMonthlyBreakdown(data.transactions, 'expense'),
    [data.transactions]
  )

  const totalAllTime = monthlyIncome.reduce((s, m) => s + m.total, 0)
  const avgMonthly = monthlyIncome.length ? totalAllTime / monthlyIncome.length : 0

  const chartData = monthlyIncome.slice(0, 12).reverse().map(m => ({
    name: m.month.split(' ')[0].slice(0, 3),
    income: m.total,
  }))

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 pt-2">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors t-secondary">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold t-primary">Income History</h1>
          <p className="text-xs t-muted">All months overview</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">All-Time Income</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{formatCurrency(totalAllTime, cur)}</p>
        </div>
        <div className="card">
          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Monthly Average</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{formatCurrency(avgMonthly, cur)}</p>
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="card">
          <p className="text-sm font-semibold t-primary mb-3">Income Trend</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" fontSize={10} stroke="var(--text-muted)" />
              <YAxis fontSize={10} stroke="var(--text-muted)" tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v), cur)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.08)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
              <Bar dataKey="income" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill="#10b981" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <p className="text-sm font-semibold t-primary mb-3">Month by Month</p>
        {monthlyIncome.length === 0 && <p className="text-xs t-muted text-center py-4">No income recorded yet.</p>}
        {monthlyIncome.map((m, i) => {
          const exp = monthlyExpenses.find(e => e.month === m.month)
          const net = m.total - (exp?.total || 0)
          return (
            <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: 'var(--border-card)' }}>
              <div>
                <p className="text-sm font-medium t-primary">{m.month}</p>
                {exp && <p className="text-[11px] t-muted">Expenses: {formatCurrency(exp.total, cur)}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-600">+{formatCurrency(m.total, cur)}</p>
                <p className={`text-[11px] font-medium ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  Net: {net >= 0 ? '+' : ''}{formatCurrency(net, cur)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
