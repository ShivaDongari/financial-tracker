import { useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { useStore } from '../store'
import { Subscription, CATEGORIES } from '../types'
import CategoryPicker from './CategoryPicker'
import { formatCurrency, formatDate, daysUntil, todayISO } from '../utils/helpers'
import { api } from '../utils/api'
import { Modal, FormField } from './Accounts'

const emptyForm = {
  name: '', amount: '', frequency: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
  nextRenewal: todayISO(), category: 'Subscriptions', subcategory: '', accountId: '', active: true, notes: '',
}

export default function Subscriptions() {
  const { data, refreshSubscriptions } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Subscription | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const cur = data.settings.currency

  const active = data.subscriptions.filter(s => s.active).sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal))
  const inactive = data.subscriptions.filter(s => !s.active)
  const totalMonthly = active.reduce((s, sub) => {
    if (sub.frequency === 'monthly') return s + sub.amount
    if (sub.frequency === 'quarterly') return s + sub.amount / 3
    return s + sub.amount / 12
  }, 0)
  const totalYearly = totalMonthly * 12

  function openAdd() { setEditing(null); setForm(emptyForm); setShowForm(true) }
  function openEdit(s: Subscription) {
    setEditing(s)
    setForm({ name: s.name, amount: String(s.amount), frequency: s.frequency, nextRenewal: s.nextRenewal, category: s.category, subcategory: s.subcategory || '', accountId: s.accountId || '', active: s.active, notes: s.notes || '' })
    setShowForm(true)
  }

  async function save() {
    const payload = {
      name: form.name.trim(), amount: parseFloat(form.amount) || 0, frequency: form.frequency,
      nextRenewal: form.nextRenewal, category: form.category, subcategory: form.subcategory || undefined,
      accountId: form.accountId || undefined, active: form.active, notes: form.notes.trim(),
    }
    if (!payload.name) return
    if (editing) await api.updateSubscription(editing.id, payload)
    else await api.createSubscription(payload)
    await refreshSubscriptions(); setShowForm(false)
  }

  async function toggleActive(s: Subscription) {
    await api.updateSubscription(s.id, { active: !s.active })
    await refreshSubscriptions()
  }

  async function handleDelete() {
    if (!deleteId) return
    await api.deleteSubscription(deleteId); await refreshSubscriptions(); setDeleteId(null)
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold t-primary">Subscriptions</h1>
          <p className="text-xs t-muted">{active.length} active · {formatCurrency(totalMonthly, cur)}/mo · {formatCurrency(totalYearly, cur)}/yr</p>
        </div>
        <button onClick={openAdd} className="btn-primary self-start"><Plus size={14} className="inline mr-1" />Add</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card !p-3">
          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Monthly Cost</p>
          <p className="text-base font-bold t-primary mt-0.5">{formatCurrency(totalMonthly, cur)}</p>
        </div>
        <div className="card !p-3">
          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Yearly Cost</p>
          <p className="text-base font-bold t-primary mt-0.5">{formatCurrency(totalYearly, cur)}</p>
        </div>
        <div className="card !p-3">
          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Active</p>
          <p className="text-base font-bold t-primary mt-0.5">{active.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Frequency</th>
                <th className="table-header hidden md:table-cell">Category</th>
                <th className="table-header">Next Renewal</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header w-20"></th>
              </tr>
            </thead>
            <tbody>
              {data.subscriptions.length === 0 && (
                <tr><td colSpan={7} className="table-cell text-center t-muted py-8">No subscriptions yet. Add your first one.</td></tr>
              )}
              {[...active, ...inactive].map(sub => {
                const days = daysUntil(sub.nextRenewal)
                const renewSoon = days >= 0 && days <= 7
                return (
                  <tr key={sub.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="table-cell">
                      <p className={`font-medium ${!sub.active ? 't-muted line-through' : 't-primary'}`}>{sub.name}</p>
                      {sub.notes && <p className="text-[10px] t-muted truncate max-w-[150px]">{sub.notes}</p>}
                    </td>
                    <td className="table-cell text-xs t-secondary capitalize">{sub.frequency}</td>
                    <td className="table-cell hidden md:table-cell text-xs t-secondary">{sub.category}</td>
                    <td className="table-cell text-xs">
                      <span className={renewSoon && sub.active ? 'text-[var(--warning)] font-medium' : 't-secondary'}>
                        {formatDate(sub.nextRenewal)}
                        {renewSoon && sub.active && ` (${days}d)`}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${sub.active ? 'badge-success' : 'badge-accent'}`}>{sub.active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="table-cell text-right font-semibold t-primary">{formatCurrency(sub.amount, cur)}</td>
                    <td className="table-cell">
                      <div className="flex gap-0.5 justify-end">
                        <button onClick={() => toggleActive(sub)} className="p-1 t-muted hover:t-accent" title={sub.active ? 'Deactivate' : 'Activate'}><RefreshCw size={13} /></button>
                        <button onClick={() => openEdit(sub)} className="p-1 t-muted hover:t-accent"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteId(sub.id)} className="p-1 t-muted hover:text-[var(--danger)]"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal title={editing ? 'Edit Subscription' : 'Add Subscription'} onClose={() => setShowForm(false)} onSubmit={save}>
          <FormField label="Name"><input className="input" placeholder="e.g. Netflix, Spotify" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount"><input className="input" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></FormField>
            <FormField label="Frequency">
              <select className="input" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as any }))}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Next Renewal"><input className="input" type="date" value={form.nextRenewal} onChange={e => setForm(f => ({ ...f, nextRenewal: e.target.value }))} /></FormField>
            <FormField label="Category">
              <CategoryPicker category={form.category} subcategory={form.subcategory}
                onCategoryChange={c => setForm(f => ({ ...f, category: c }))}
                onSubcategoryChange={s => setForm(f => ({ ...f, subcategory: s }))} />
            </FormField>
          </div>
          <FormField label="Pay from (optional)">
            <select className="input" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
              <option value="">None</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </FormField>
          <FormField label="Notes"><input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></FormField>
          <div className="flex items-center gap-2 mb-3">
            <input type="checkbox" id="subActive" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
            <label htmlFor="subActive" className="text-sm t-secondary">Active</label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-secondary">Cancel</button>
            <button type="submit" className="flex-1 btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete Subscription?" onClose={() => setDeleteId(null)}>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setDeleteId(null)} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="flex-1 text-white rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--danger)' }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
