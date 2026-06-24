import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, CalendarClock, Check, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useStore } from '../store'
import { Bill, BillFrequency, BillType, CATEGORIES, Category } from '../types'
import { formatCurrency, formatDate, daysUntil, todayISO } from '../utils/helpers'
import { api } from '../utils/api'
import { Modal, FormField } from './Accounts'

const FREQ_LABELS: Record<BillFrequency, string> = {
  once: 'One-time', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly',
}

const emptyForm = {
  name: '', amount: '', dueDate: todayISO(), noDueDate: false, frequency: 'monthly' as BillFrequency,
  billType: 'fixed' as BillType, accountId: '', category: 'Household' as Category, paid: false, notes: '',
}

export default function Bills() {
  const { data, refreshBills } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showPaid, setShowPaid] = useState(false)
  const [viewTab, setViewTab] = useState<'all' | 'fixed' | 'variable'>('all')
  const cur = data.settings.currency

  const filteredBills = useMemo(() => {
    if (viewTab === 'all') return data.bills
    return data.bills.filter(b => (b.billType || 'fixed') === viewTab)
  }, [data.bills, viewTab])

  const overdue = filteredBills.filter(b => !b.paid && !b.noDueDate && daysUntil(b.dueDate) < 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const dueSoon = filteredBills.filter(b => !b.paid && !b.noDueDate && daysUntil(b.dueDate) >= 0 && daysUntil(b.dueDate) <= 7).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const upcoming = filteredBills.filter(b => !b.paid && !b.noDueDate && daysUntil(b.dueDate) > 7).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const noDueDateBills = filteredBills.filter(b => !b.paid && b.noDueDate)
  const paid = filteredBills.filter(b => b.paid).sort((a, b) => b.dueDate.localeCompare(a.dueDate))

  // Variable bill trend data
  const variableBills = data.bills.filter(b => (b.billType || 'fixed') === 'variable' && b.paid)
  const trendData = useMemo(() => {
    const byName: Record<string, { name: string; amounts: number[] }> = {}
    for (const b of variableBills) {
      if (!byName[b.name]) byName[b.name] = { name: b.name, amounts: [] }
      byName[b.name].amounts.push(b.amount)
    }
    return Object.values(byName).filter(v => v.amounts.length >= 2).map(v => ({
      name: v.name,
      avg: v.amounts.reduce((s, a) => s + a, 0) / v.amounts.length,
      min: Math.min(...v.amounts),
      max: Math.max(...v.amounts),
      last: v.amounts[v.amounts.length - 1],
    }))
  }, [variableBills])

  function openAdd() { setEditing(null); setForm(emptyForm); setShowForm(true) }

  function openEdit(b: Bill) {
    setEditing(b)
    setForm({ name: b.name, amount: String(b.amount), dueDate: b.dueDate, noDueDate: !!b.noDueDate, frequency: b.frequency, billType: b.billType || 'fixed', accountId: b.accountId || '', category: b.category, paid: b.paid, notes: b.notes || '' })
    setShowForm(true)
  }

  async function save() {
    const payload: any = {
      name: form.name.trim(), amount: parseFloat(form.amount) || 0,
      dueDate: form.noDueDate ? '' : form.dueDate, noDueDate: form.noDueDate,
      frequency: form.noDueDate ? 'once' : form.frequency, billType: form.billType,
      accountId: form.accountId || undefined, category: form.category,
      paid: form.paid, notes: form.notes.trim(),
    }
    if (!payload.name) return
    if (editing) await api.updateBill(editing.id, payload)
    else await api.createBill(payload)
    await refreshBills()
    setShowForm(false)
  }

  async function togglePaid(b: Bill) {
    await api.updateBill(b.id, { paid: !b.paid })
    await refreshBills()
  }

  async function handleDelete() {
    if (!deleteId) return
    await api.deleteBill(deleteId)
    await refreshBills()
    setDeleteId(null)
  }

  const totalUpcoming = [...overdue, ...dueSoon, ...upcoming, ...noDueDateBills].reduce((s, b) => s + b.amount, 0)

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 pt-2 lg:pt-0">
        <div>
          <h1 className="text-xl font-extrabold t-primary">Bills & Payments</h1>
          <p className="text-xs t-muted">{overdue.length + dueSoon.length + upcoming.length + noDueDateBills.length} pending · {formatCurrency(totalUpcoming, cur)} total</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl px-3.5 py-2 text-sm font-semibold shadow-sm self-start">
          <Plus size={16} /> Add Bill
        </button>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-2">
        {(['all', 'fixed', 'variable'] as const).map(t => (
          <button key={t} onClick={() => setViewTab(t)} className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${viewTab === t ? 'bg-violet-600 text-white' : 'card t-secondary'}`}>
            {t === 'all' ? 'All Bills' : t === 'fixed' ? '📌 Fixed' : '📊 Variable'}
          </button>
        ))}
      </div>

      {data.bills.length === 0 && (
        <div className="text-center py-16 t-muted">
          <div className="text-4xl mb-3">🧾</div>
          <p className="font-semibold t-secondary">No bills yet</p>
          <p className="text-sm mt-1 max-w-sm mx-auto">Add fixed bills (rent, Netflix) or variable bills (electricity, groceries) to track payments.</p>
        </div>
      )}

      {/* Variable bill trend analysis */}
      {viewTab === 'variable' && trendData.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-violet-500" />
            <h2 className="text-sm font-semibold t-primary">Variable Expense Trends</h2>
          </div>
          <div className="space-y-3">
            {trendData.map(t => (
              <div key={t.name} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border-card)' }}>
                <div>
                  <p className="text-sm font-medium t-primary">{t.name}</p>
                  <p className="text-[11px] t-muted">Range: {formatCurrency(t.min, cur)} – {formatCurrency(t.max, cur)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold t-primary">Avg: {formatCurrency(t.avg, cur)}</p>
                  <p className="text-[11px] t-muted">Last: {formatCurrency(t.last, cur)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          {/* Overdue */}
          {overdue.length > 0 && (
            <BillSection title="🔴 Overdue" bills={overdue} cur={cur} onEdit={openEdit} onDelete={setDeleteId} onToggle={togglePaid} />
          )}

          {/* Due soon */}
          {dueSoon.length > 0 && (
            <BillSection title="🟡 Due Soon (within 7 days)" bills={dueSoon} cur={cur} onEdit={openEdit} onDelete={setDeleteId} onToggle={togglePaid} />
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <BillSection title="🟢 Upcoming" bills={upcoming} cur={cur} onEdit={openEdit} onDelete={setDeleteId} onToggle={togglePaid} />
          )}
        </div>

        <div className="space-y-4">
          {/* No due date */}
          {noDueDateBills.length > 0 && (
            <div className="card">
              <p className="text-sm font-semibold t-primary mb-3">📋 No Due Date</p>
              <div className="space-y-2">
                {noDueDateBills.map(b => (
                  <div key={b.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border-card)' }}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => togglePaid(b)} className="w-6 h-6 rounded-full border-2 flex items-center justify-center" style={{ borderColor: 'var(--border)' }} />
                      <div>
                        <p className="text-sm font-medium t-primary">{b.name}</p>
                        <p className="text-[11px] t-muted">{b.category} · {(b.billType || 'fixed') === 'variable' ? 'Variable' : 'Fixed'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold t-primary">{formatCurrency(b.amount, cur)}</p>
                      <button onClick={() => openEdit(b)} className="p-1 t-muted hover:text-violet-600"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteId(b.id)} className="p-1 t-muted hover:text-rose-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Paid */}
          {paid.length > 0 && (
            <div className="card">
              <button onClick={() => setShowPaid(!showPaid)} className="text-sm font-semibold t-primary flex items-center gap-1 w-full">
                ✅ Paid ({paid.length}) {showPaid ? '▲' : '▼'}
              </button>
              {showPaid && (
                <div className="mt-3 space-y-2">
                  {paid.map(b => <BillRow key={b.id} bill={b} cur={cur} onEdit={openEdit} onDelete={setDeleteId} onToggle={togglePaid} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <Modal title={editing ? 'Edit Bill' : 'Add Bill'} onClose={() => setShowForm(false)} onSubmit={save}>
          <FormField label="Bill Name">
            <input className="input" placeholder="e.g. Netflix, Electricity" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="Bill Type">
            <div className="flex gap-2">
              {(['fixed', 'variable'] as BillType[]).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, billType: t }))}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold capitalize border transition-colors ${form.billType === t ? 'bg-violet-600 text-white border-violet-600' : 'border-theme t-secondary'}`}>
                  {t === 'fixed' ? '📌 Fixed' : '📊 Variable'}
                </button>
              ))}
            </div>
            <p className="text-[10px] t-muted mt-1">{form.billType === 'fixed' ? 'Same amount each cycle (rent, Netflix, insurance)' : 'Amount varies each cycle (electricity, gas, groceries)'}</p>
          </FormField>
          <FormField label="Amount">
            <input className="input" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </FormField>
          <div className="flex items-center gap-2 mb-3">
            <input type="checkbox" id="noDueDate" checked={form.noDueDate} onChange={e => setForm(f => ({ ...f, noDueDate: e.target.checked }))} className="rounded" />
            <label htmlFor="noDueDate" className="text-sm t-secondary">No due date</label>
          </div>
          {!form.noDueDate && (
            <>
              <FormField label="Due Date">
                <input className="input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </FormField>
              <FormField label="Frequency">
                <select className="input" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as BillFrequency }))}>
                  {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </FormField>
            </>
          )}
          <FormField label="Category">
            <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Pay from (optional)">
            <select className="input" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
              <option value="">None</option>
              {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </FormField>
          <FormField label="Notes (optional)">
            <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </FormField>
          <div className="flex items-center gap-2 mb-4">
            <input type="checkbox" id="paid" checked={form.paid} onChange={e => setForm(f => ({ ...f, paid: e.target.checked }))} className="rounded" />
            <label htmlFor="paid" className="text-sm t-secondary">Mark as paid</label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-secondary">Cancel</button>
            <button type="submit" className="flex-1 btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete Bill?" onClose={() => setDeleteId(null)}>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setDeleteId(null)} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="flex-1 bg-rose-500 text-white rounded-2xl py-3 text-sm font-semibold">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function BillSection({ title, bills, cur, onEdit, onDelete, onToggle }: { title: string; bills: Bill[]; cur: string; onEdit: (b: Bill) => void; onDelete: (id: string) => void; onToggle: (b: Bill) => void }) {
  return (
    <div className="card">
      <p className="text-sm font-semibold t-primary mb-3">{title}</p>
      <div className="space-y-2">
        {bills.map(b => <BillRow key={b.id} bill={b} cur={cur} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />)}
      </div>
    </div>
  )
}

function BillRow({ bill, cur, onEdit, onDelete, onToggle }: { bill: Bill; cur: string; onEdit: (b: Bill) => void; onDelete: (id: string) => void; onToggle: (b: Bill) => void }) {
  const days = bill.noDueDate ? null : daysUntil(bill.dueDate)
  const overdue = days !== null && days < 0
  const urgent = days !== null && days >= 0 && days <= 3
  const isVariable = (bill.billType || 'fixed') === 'variable'
  return (
    <div className={`flex items-center justify-between py-2.5 border-b last:border-0 ${overdue ? '' : ''}`} style={{ borderColor: 'var(--border-card)' }}>
      <div className="flex items-center gap-3">
        <button onClick={() => onToggle(bill)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${bill.paid ? 'bg-emerald-500 border-emerald-500' : overdue ? 'border-rose-400' : urgent ? 'border-amber-400' : 'border-[var(--border)]'}`}>
          {bill.paid && <Check size={12} className="text-white" />}
        </button>
        <div>
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-medium ${bill.paid ? 't-muted line-through' : 't-primary'}`}>{bill.name}</p>
            {isVariable && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">VAR</span>}
          </div>
          <p className={`text-[11px] ${overdue ? 'text-rose-500 font-medium' : urgent ? 'text-amber-500' : 't-muted'}`}>
            {bill.paid ? 'Paid' : bill.noDueDate ? 'No deadline' : overdue ? `${Math.abs(days!)}d overdue` : days === 0 ? 'Due today!' : `Due in ${days}d`}
            {!bill.noDueDate && bill.dueDate ? ` · ${formatDate(bill.dueDate)}` : ''} · {bill.category}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold t-primary">{formatCurrency(bill.amount, cur)}</p>
        <button onClick={() => onEdit(bill)} className="p-1 t-muted hover:text-violet-600 rounded-lg"><Pencil size={13} /></button>
        <button onClick={() => onDelete(bill.id)} className="p-1 t-muted hover:text-rose-500 rounded-lg"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}
