import { useState, useEffect } from 'react'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { useStore } from '../store'
import { CATEGORIES } from '../types'
import { formatCurrency } from '../utils/helpers'
import { api } from '../utils/api'
import { Modal, FormField } from './Accounts'

interface BudgetStatus {
  category: string
  limit: number
  spent: number
  percent: number
  over: boolean
}

export default function Budgets() {
  const budgets = useStore(s => s.budgets)
  const settings = useStore(s => s.settings)
  const selectedMonth = useStore(s => s.selectedMonth)
  const refreshBudgets = useStore(s => s.refreshBudgets)
  const [statuses, setStatuses] = useState<BudgetStatus[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category: '', limit: '' })
  const cur = settings.currency

  useEffect(() => {
    api.getBudgetStatus(selectedMonth).then(setStatuses).catch(console.error)
  }, [budgets, selectedMonth])

  const unbudgeted = CATEGORIES.filter(c => !budgets.find(b => b.category === c))

  async function save() {
    if (!form.category || !form.limit) return
    await api.setBudget(form.category, parseFloat(form.limit))
    await refreshBudgets()
    setShowForm(false)
    setForm({ category: '', limit: '' })
  }

  async function handleDelete(id: string) {
    await api.deleteBudget(id)
    await refreshBudgets()
  }

  const totalLimit = statuses.reduce((s, b) => s + b.limit, 0)
  const totalSpent = statuses.reduce((s, b) => s + b.spent, 0)
  const overBudgetCount = statuses.filter(s => s.over).length
  const warningCount = statuses.filter(s => s.percent >= 80 && !s.over).length

  function getBarColor(pct: number): string {
    if (pct >= 100) return 'var(--danger)'
    if (pct >= 80) return 'var(--warning)'
    return 'var(--success)'
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold t-primary">Budgets</h1>
          <p className="text-xs t-muted">
            {budgets.length} categories tracked
            {overBudgetCount > 0 && <span className="text-[var(--danger)] font-medium"> · {overBudgetCount} over budget</span>}
            {warningCount > 0 && <span className="text-[var(--warning)] font-medium"> · {warningCount} near limit</span>}
          </p>
        </div>
        <button onClick={() => { setForm({ category: unbudgeted[0] || '', limit: '' }); setShowForm(true) }} className="btn-primary self-start">
          <Plus size={14} className="inline mr-1" />Add Budget
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card !p-3">
          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Total Budget</p>
          <p className="text-base font-bold t-primary mt-0.5">{formatCurrency(totalLimit, cur)}</p>
        </div>
        <div className="card !p-3">
          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Total Spent</p>
          <p className={`text-base font-bold mt-0.5 ${totalSpent > totalLimit ? 'text-[var(--danger)]' : 't-primary'}`}>{formatCurrency(totalSpent, cur)}</p>
        </div>
        <div className="card !p-3">
          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Remaining</p>
          <p className={`text-base font-bold mt-0.5 ${totalLimit - totalSpent < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>{formatCurrency(totalLimit - totalSpent, cur)}</p>
        </div>
      </div>

      {/* Budget cards */}
      {statuses.length === 0 && (
        <div className="text-center py-16 t-muted">
          <p className="font-medium t-secondary text-lg">No budgets set</p>
          <p className="text-sm mt-1">Set monthly spending limits per category to stay on track.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {statuses.map(s => {
          const budget = budgets.find(b => b.category === s.category)
          const remaining = s.limit - s.spent
          return (
            <div key={s.category} className="card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {s.percent >= 80 && <AlertTriangle size={13} style={{ color: s.over ? 'var(--danger)' : 'var(--warning)' }} />}
                  <p className="text-sm font-medium t-primary">{s.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${s.over ? 'badge-danger' : s.percent >= 80 ? 'badge-warning' : 'badge-success'}`}>
                    {s.percent.toFixed(0)}%
                  </span>
                  {budget && <button onClick={() => handleDelete(budget.id)} className="p-1 t-muted hover:text-[var(--danger)]"><Trash2 size={12} /></button>}
                </div>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--bg-hover)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(s.percent, 100)}%`, background: getBarColor(s.percent) }} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="t-muted">{formatCurrency(s.spent, cur)} spent</span>
                <span className={remaining < 0 ? 'text-[var(--danger)] font-medium' : 't-muted'}>
                  {remaining >= 0 ? `${formatCurrency(remaining, cur)} left` : `${formatCurrency(Math.abs(remaining), cur)} over`}
                </span>
              </div>
              <p className="text-[10px] t-muted mt-1">Limit: {formatCurrency(s.limit, cur)}/mo</p>
            </div>
          )
        })}
      </div>

      {showForm && (
        <Modal title="Set Category Budget" onClose={() => setShowForm(false)} onSubmit={save}>
          <FormField label="Category">
            <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="">Select category</option>
              {unbudgeted.map(c => <option key={c}>{c}</option>)}
              {budgets.map(b => <option key={b.category}>{b.category} (update)</option>)}
            </select>
          </FormField>
          <FormField label="Monthly Limit">
            <input className="input" type="number" step="0.01" placeholder="500.00" value={form.limit} onChange={e => setForm(f => ({ ...f, limit: e.target.value }))} />
          </FormField>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-secondary">Cancel</button>
            <button type="submit" className="flex-1 btn-primary">Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function BudgetSummaryWidget() {
  const budgets = useStore(s => s.budgets)
  const selectedMonth = useStore(s => s.selectedMonth)
  const settings = useStore(s => s.settings)
  const [statuses, setStatuses] = useState<BudgetStatus[]>([])
  const cur = settings.currency

  useEffect(() => {
    if (budgets.length) api.getBudgetStatus(selectedMonth).then(setStatuses).catch(console.error)
  }, [budgets, selectedMonth])

  if (!statuses.length) return null

  const warnings = statuses.filter(s => s.percent >= 80)
  if (!warnings.length) return null

  return (
    <div className="card">
      <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider mb-3">Budget Alerts</h2>
      <div className="space-y-2.5">
        {warnings.map(s => (
          <div key={s.category}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium t-primary">{s.category}</span>
              <span className={s.over ? 'text-[var(--danger)] font-medium' : 'text-[var(--warning)]'}>
                {s.percent.toFixed(0)}% — {s.over ? `${formatCurrency(s.spent - s.limit, cur)} over` : `${formatCurrency(s.limit - s.spent, cur)} left`}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(s.percent, 100)}%`, background: s.over ? 'var(--danger)' : 'var(--warning)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
