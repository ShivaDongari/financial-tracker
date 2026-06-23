import { useState } from 'react'
import { Plus, Pencil, Trash2, CalendarClock, Check } from 'lucide-react'
import { useStore } from '../store'
import { Bill, BillFrequency, CATEGORIES, Category } from '../types'
import { formatCurrency, formatDate, daysUntil, todayISO } from '../utils/helpers'
import { api } from '../utils/api'
import { Modal, FormField } from './Accounts'

const FREQ_LABELS: Record<BillFrequency, string> = {
  once: 'One-time', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly',
}

const emptyForm = {
  name: '', amount: '', dueDate: todayISO(), frequency: 'monthly' as BillFrequency,
  accountId: '', category: 'Household' as Category, paid: false, notes: '',
}

export default function Bills() {
  const { data, refreshBills } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showPaid, setShowPaid] = useState(false)
  const cur = data.settings.currency

  const upcoming = data.bills.filter(b => !b.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const paid = data.bills.filter(b => b.paid).sort((a, b) => b.dueDate.localeCompare(a.dueDate))

  function openAdd() { setEditing(null); setForm(emptyForm); setShowForm(true) }

  function openEdit(b: Bill) {
    setEditing(b)
    setForm({ name: b.name, amount: String(b.amount), dueDate: b.dueDate, frequency: b.frequency, accountId: b.accountId || '', category: b.category, paid: b.paid, notes: b.notes || '' })
    setShowForm(true)
  }

  async function save() {
    const payload = {
      name: form.name.trim(), amount: parseFloat(form.amount) || 0, dueDate: form.dueDate,
      frequency: form.frequency, accountId: form.accountId || undefined, category: form.category,
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

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Bills</h1>
          <p className="text-xs text-slate-400">{upcoming.length} upcoming · {paid.length} paid</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl px-3.5 py-2 text-sm font-semibold shadow-sm">
          <Plus size={16} /> Add
        </button>
      </div>

      {data.bills.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">🧾</div>
          <p className="font-semibold text-slate-600">No bills yet</p>
          <p className="text-sm mt-1">Add recurring bills to never miss a due date</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Upcoming</p>
          {upcoming.map(b => <BillRow key={b.id} bill={b} cur={cur} onEdit={openEdit} onDelete={setDeleteId} onToggle={togglePaid} />)}
        </div>
      )}

      {paid.length > 0 && (
        <div className="space-y-2">
          <button onClick={() => setShowPaid(!showPaid)} className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            Paid ({paid.length}) {showPaid ? '▲' : '▼'}
          </button>
          {showPaid && paid.map(b => <BillRow key={b.id} bill={b} cur={cur} onEdit={openEdit} onDelete={setDeleteId} onToggle={togglePaid} />)}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Bill' : 'Add Bill'} onClose={() => setShowForm(false)}>
          <FormField label="Bill Name">
            <input className="input" placeholder="e.g. Electricity" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="Amount">
            <input className="input" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </FormField>
          <FormField label="Due Date">
            <input className="input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          </FormField>
          <FormField label="Frequency">
            <select className="input" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as BillFrequency }))}>
              {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </FormField>
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
            <label htmlFor="paid" className="text-sm text-slate-600">Mark as paid</label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={save} className="flex-1 btn-primary">Save</button>
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
      <div className="h-4" />
    </div>
  )
}

function BillRow({ bill, cur, onEdit, onDelete, onToggle }: { bill: Bill; cur: string; onEdit: (b: Bill) => void; onDelete: (id: string) => void; onToggle: (b: Bill) => void }) {
  const days = daysUntil(bill.dueDate)
  const overdue = days < 0
  const urgent = days >= 0 && days <= 3
  return (
    <div className={`card-hover flex items-center justify-between ${overdue ? '!border-rose-200' : ''}`}>
      <div className="flex items-center gap-3">
        <button onClick={() => onToggle(bill)} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${bill.paid ? 'bg-emerald-500 border-emerald-500' : overdue ? 'border-rose-400' : urgent ? 'border-amber-400' : 'border-slate-300'}`}>
          {bill.paid && <Check size={14} className="text-white" />}
        </button>
        <div>
          <p className={`text-sm font-semibold ${bill.paid ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{bill.name}</p>
          <p className={`text-[11px] ${overdue ? 'text-rose-500 font-medium' : urgent ? 'text-amber-500' : 'text-slate-400'}`}>
            {bill.paid ? 'Paid' : overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today!' : `Due in ${days}d`} · {formatDate(bill.dueDate)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold text-slate-800">{formatCurrency(bill.amount, cur)}</p>
        <button onClick={() => onEdit(bill)} className="p-1.5 text-slate-400 hover:text-violet-600 rounded-lg"><Pencil size={13} /></button>
        <button onClick={() => onDelete(bill.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}
