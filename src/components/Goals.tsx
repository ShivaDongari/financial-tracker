import { useState } from 'react'
import { Plus, Pencil, Trash2, Target, Check, TrendingUp } from 'lucide-react'
import { useStore } from '../store'
import { formatCurrency, formatDate, daysUntil } from '../utils/helpers'
import { api } from '../utils/api'
import { Modal, FormField } from './Accounts'

const emptyForm = { name: '', targetAmount: '', currentAmount: '', deadline: '', accountId: '', notes: '' }

export default function Goals() {
  const goals = useStore(s => s.goals)
  const accounts = useStore(s => s.accounts)
  const settings = useStore(s => s.settings)
  const refreshGoals = useStore(s => s.refreshGoals)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [addAmountId, setAddAmountId] = useState<string | null>(null)
  const [addAmount, setAddAmount] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const cur = settings.currency

  const active = goals.filter(g => !g.completed)
  const completed = goals.filter(g => g.completed)
  const totalTarget = active.reduce((s, g) => s + g.targetAmount, 0)
  const totalSaved = active.reduce((s, g) => s + g.currentAmount, 0)

  function openAdd() { setEditing(null); setForm(emptyForm); setShowForm(true) }
  function openEdit(g: typeof goals[0]) {
    setEditing(g.id)
    setForm({ name: g.name, targetAmount: String(g.targetAmount), currentAmount: String(g.currentAmount), deadline: g.deadline || '', accountId: g.accountId || '', notes: g.notes || '' })
    setShowForm(true)
  }

  async function save() {
    if (!form.name || !form.targetAmount) return
    const payload = {
      name: form.name.trim(), targetAmount: parseFloat(form.targetAmount),
      currentAmount: parseFloat(form.currentAmount) || 0, deadline: form.deadline || undefined,
      accountId: form.accountId || undefined, notes: form.notes.trim() || undefined, completed: false,
    }
    if (editing) await api.updateGoal(editing, payload)
    else await api.createGoal(payload)
    await refreshGoals(); setShowForm(false)
  }

  async function handleAddAmount() {
    if (!addAmountId || !addAmount) return
    await api.addToGoal(addAmountId, parseFloat(addAmount))
    await refreshGoals(); setAddAmountId(null); setAddAmount('')
  }

  async function handleDelete() {
    if (!deleteId) return
    await api.deleteGoal(deleteId); await refreshGoals(); setDeleteId(null)
  }

  function getMonthlyNeeded(goal: typeof goals[0]): number {
    if (!goal.deadline) return 0
    const remaining = goal.targetAmount - goal.currentAmount
    if (remaining <= 0) return 0
    const months = Math.max(1, daysUntil(goal.deadline) / 30)
    return remaining / months
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold t-primary">Savings Goals</h1>
          <p className="text-xs t-muted">{active.length} active · {formatCurrency(totalSaved, cur)} of {formatCurrency(totalTarget, cur)} saved</p>
        </div>
        <button onClick={openAdd} className="btn-primary self-start"><Plus size={14} className="inline mr-1" />New Goal</button>
      </div>

      {/* Summary */}
      {active.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card !p-3">
            <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Target</p>
            <p className="text-base font-bold t-primary mt-0.5">{formatCurrency(totalTarget, cur)}</p>
          </div>
          <div className="card !p-3">
            <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Saved</p>
            <p className="text-base font-bold text-[var(--success)] mt-0.5">{formatCurrency(totalSaved, cur)}</p>
          </div>
          <div className="card !p-3">
            <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Remaining</p>
            <p className="text-base font-bold t-accent mt-0.5">{formatCurrency(totalTarget - totalSaved, cur)}</p>
          </div>
        </div>
      )}

      {goals.length === 0 && (
        <div className="text-center py-16 t-muted">
          <Target size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium t-secondary text-lg">No goals yet</p>
          <p className="text-sm mt-1">Set a savings target — emergency fund, vacation, new car.</p>
        </div>
      )}

      {/* Active goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {active.map(g => {
          const pct = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0
          const monthly = getMonthlyNeeded(g)
          const daysLeft = g.deadline ? daysUntil(g.deadline) : null
          return (
            <div key={g.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target size={15} className="t-accent" />
                  <p className="text-sm font-semibold t-primary">{g.name}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setAddAmountId(g.id)} className="text-[10px] font-medium px-2 py-1 rounded text-white" style={{ background: 'var(--accent)' }}>+ Add</button>
                  <button onClick={() => openEdit(g)} className="p-1 t-muted hover:t-accent"><Pencil size={12} /></button>
                  <button onClick={() => setDeleteId(g.id)} className="p-1 t-muted hover:text-[var(--danger)]"><Trash2 size={12} /></button>
                </div>
              </div>

              <div className="flex justify-between text-xs mb-1">
                <span className="t-muted">{formatCurrency(g.currentAmount, cur)}</span>
                <span className="t-muted">{formatCurrency(g.targetAmount, cur)}</span>
              </div>
              <div className="w-full h-2.5 rounded-full overflow-hidden mb-2" style={{ background: 'var(--bg-hover)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : 'var(--accent)' }} />
              </div>

              <div className="flex justify-between text-[11px]">
                <span className={`font-medium ${pct >= 100 ? 'text-[var(--success)]' : 't-accent'}`}>{pct.toFixed(0)}% complete</span>
                <span className="t-muted">
                  {daysLeft !== null && daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? 'Due today' : daysLeft !== null ? 'Past deadline' : ''}
                  {monthly > 0 && ` · ${formatCurrency(monthly, cur)}/mo needed`}
                </span>
              </div>
              {g.notes && <p className="text-[10px] t-muted mt-1">{g.notes}</p>}
            </div>
          )
        })}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <p className="text-xs font-semibold t-muted uppercase tracking-wider mb-2">Completed</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {completed.map(g => (
              <div key={g.id} className="card !p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-[var(--success)]" />
                  <div>
                    <p className="text-sm font-medium t-primary line-through">{g.name}</p>
                    <p className="text-[10px] t-muted">{formatCurrency(g.targetAmount, cur)} saved</p>
                  </div>
                </div>
                <button onClick={() => setDeleteId(g.id)} className="p-1 t-muted hover:text-[var(--danger)]"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add amount modal */}
      {addAmountId && (
        <Modal title="Add to Goal" onClose={() => setAddAmountId(null)} onSubmit={handleAddAmount}>
          <FormField label="Amount to add">
            <input className="input" type="number" step="0.01" placeholder="100.00" value={addAmount}
              onChange={e => setAddAmount(e.target.value)} autoFocus />
          </FormField>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setAddAmountId(null)} className="flex-1 btn-secondary">Cancel</button>
            <button type="submit" className="flex-1 btn-primary">Add</button>
          </div>
        </Modal>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <Modal title={editing ? 'Edit Goal' : 'New Savings Goal'} onClose={() => setShowForm(false)} onSubmit={save}>
          <FormField label="Goal Name"><input className="input" placeholder="e.g. Emergency Fund" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Target Amount"><input className="input" type="number" step="0.01" placeholder="5000" value={form.targetAmount} onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))} /></FormField>
            <FormField label="Currently Saved"><input className="input" type="number" step="0.01" placeholder="0" value={form.currentAmount} onChange={e => setForm(f => ({ ...f, currentAmount: e.target.value }))} /></FormField>
          </div>
          <FormField label="Target Date (optional)"><input className="input" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} /></FormField>
          <FormField label="Linked Account (optional)">
            <select className="input" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
              <option value="">None</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </FormField>
          <FormField label="Notes"><input className="input" placeholder="Optional" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></FormField>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-secondary">Cancel</button>
            <button type="submit" className="flex-1 btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete Goal?" onClose={() => setDeleteId(null)}>
          <p className="text-sm t-secondary mb-4">This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteId(null)} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="flex-1 text-white rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--danger)' }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
