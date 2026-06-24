import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Check, CreditCard, TrendingUp, Search, Undo2 } from 'lucide-react'
import { useStore } from '../store'
import { Bill, BillFrequency, BillType, CATEGORIES } from '../types'
import CategoryPicker from './CategoryPicker'
import { formatCurrency, formatDate, daysUntil, todayISO } from '../utils/helpers'
import { api } from '../utils/api'
import { Modal, FormField } from './Accounts'

const FREQ_LABELS: Record<BillFrequency, string> = {
  once: 'One-time', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly',
}

const emptyForm = {
  name: '', amount: '', dueDate: todayISO(), noDueDate: false, frequency: 'monthly' as BillFrequency,
  billType: 'fixed' as BillType, accountId: '', category: 'Household' as string, paid: false, notes: '',
}

export default function Bills() {
  const { data, refreshBills, refreshTransactions, refreshAccounts } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [payBill, setPayBill] = useState<Bill | null>(null)
  const [payAccountId, setPayAccountId] = useState('')
  const [viewTab, setViewTab] = useState<'pending' | 'paid' | 'all'>('pending')
  const [typeFilter, setTypeFilter] = useState<'all' | 'fixed' | 'variable'>('all')
  const [search, setSearch] = useState('')
  const cur = data.settings.currency

  const filtered = useMemo(() => {
    let list = data.bills
    if (viewTab === 'pending') list = list.filter(b => !b.paid)
    else if (viewTab === 'paid') list = list.filter(b => b.paid)
    if (typeFilter !== 'all') list = list.filter(b => (b.billType || 'fixed') === typeFilter)
    if (search) list = list.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    return list.sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? 1 : -1
      if (a.noDueDate && !b.noDueDate) return 1
      if (!a.noDueDate && b.noDueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })
  }, [data.bills, viewTab, typeFilter, search])

  // Variable bill trends
  const trends = useMemo(() => {
    const byName: Record<string, number[]> = {}
    for (const b of data.bills.filter(b => (b.billType || 'fixed') === 'variable' && b.paid)) {
      if (!byName[b.name]) byName[b.name] = []
      byName[b.name].push(b.amount)
    }
    return Object.entries(byName).filter(([, a]) => a.length >= 2).map(([name, amounts]) => ({
      name, avg: amounts.reduce((s, a) => s + a, 0) / amounts.length,
      min: Math.min(...amounts), max: Math.max(...amounts),
    }))
  }, [data.bills])

  const overdueCount = data.bills.filter(b => !b.paid && !b.noDueDate && daysUntil(b.dueDate) < 0).length
  const dueSoonCount = data.bills.filter(b => !b.paid && !b.noDueDate && daysUntil(b.dueDate) >= 0 && daysUntil(b.dueDate) <= 7).length
  const totalPending = data.bills.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0)

  function openAdd() { setEditing(null); setForm(emptyForm); setShowForm(true) }
  function openEdit(b: Bill) {
    setEditing(b)
    setForm({ name: b.name, amount: String(b.amount), dueDate: b.dueDate || todayISO(), noDueDate: !!b.noDueDate, frequency: b.frequency, billType: b.billType || 'fixed', accountId: b.accountId || '', category: b.category, paid: b.paid, notes: b.notes || '' })
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

  async function handlePay() {
    if (!payBill || !payAccountId) return
    await api.payBill(payBill.id, payAccountId)
    await Promise.all([refreshBills(), refreshTransactions(), refreshAccounts()])
    setPayBill(null); setPayAccountId('')
  }

  async function handleUnpay(b: Bill) {
    await api.unpayBill(b.id)
    await Promise.all([refreshBills(), refreshTransactions(), refreshAccounts()])
  }

  async function handleDelete() {
    if (!deleteId) return
    await api.deleteBill(deleteId)
    await refreshBills()
    setDeleteId(null)
  }

  function getBillStatus(b: Bill): { label: string; cls: string } {
    if (b.paid) return { label: 'Paid', cls: 'badge-success' }
    if (b.noDueDate) return { label: 'No deadline', cls: 'badge-accent' }
    const d = daysUntil(b.dueDate)
    if (d < 0) return { label: `${Math.abs(d)}d overdue`, cls: 'badge-danger' }
    if (d <= 7) return { label: d === 0 ? 'Due today' : `${d}d left`, cls: 'badge-warning' }
    return { label: `${d}d`, cls: 'badge-accent' }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold t-primary">Bills & Payments</h1>
          <p className="text-xs t-muted">
            {overdueCount > 0 && <span className="text-[var(--danger)] font-medium">{overdueCount} overdue · </span>}
            {dueSoonCount > 0 && <span className="text-[var(--warning)] font-medium">{dueSoonCount} due soon · </span>}
            {formatCurrency(totalPending, cur)} pending
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary self-start"><Plus size={14} className="inline mr-1" />Add Bill</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg overflow-hidden border border-theme">
          {(['pending', 'paid', 'all'] as const).map(t => (
            <button key={t} onClick={() => setViewTab(t)} className={`px-3 py-1.5 text-xs font-medium capitalize ${viewTab === t ? 'text-white' : 't-secondary'}`}
              style={viewTab === t ? { background: 'var(--accent)' } : undefined}>{t}</button>
          ))}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-theme">
          {(['all', 'fixed', 'variable'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 text-xs font-medium capitalize ${typeFilter === t ? 'text-white' : 't-secondary'}`}
              style={typeFilter === t ? { background: 'var(--accent)' } : undefined}>{t}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 t-muted" />
          <input className="input !pl-8 !py-1.5 text-xs" placeholder="Search bills..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Variable trends */}
      {typeFilter === 'variable' && trends.length > 0 && (
        <div className="card">
          <h2 className="text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Variable Expense Trends</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {trends.map(t => (
              <div key={t.name} className="rounded-lg p-2.5 border border-theme">
                <p className="text-sm font-medium t-primary">{t.name}</p>
                <p className="text-xs t-muted mt-0.5">Avg: {formatCurrency(t.avg, cur)} · Range: {formatCurrency(t.min, cur)}–{formatCurrency(t.max, cur)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header w-8"></th>
                <th className="table-header">Name</th>
                <th className="table-header hidden sm:table-cell">Type</th>
                <th className="table-header hidden md:table-cell">Category</th>
                <th className="table-header">Due</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="table-cell text-center t-muted py-8">No bills match your filters.</td></tr>
              )}
              {filtered.map(b => {
                const status = getBillStatus(b)
                const isVar = (b.billType || 'fixed') === 'variable'
                return (
                  <tr key={b.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="table-cell">
                      {!b.paid && (
                        <button onClick={() => { setPayBill(b); setPayAccountId(b.accountId || data.accounts[0]?.id || '') }}
                          className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors" style={{ borderColor: 'var(--border)' }}>
                        </button>
                      )}
                      {b.paid && <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'var(--success)' }}><Check size={12} className="text-white" /></div>}
                    </td>
                    <td className="table-cell">
                      <p className={`font-medium ${b.paid ? 't-muted line-through' : 't-primary'}`}>{b.name}</p>
                      {b.notes && <p className="text-[10px] t-muted truncate max-w-[180px]">{b.notes}</p>}
                    </td>
                    <td className="table-cell hidden sm:table-cell">
                      <span className={`badge ${isVar ? 'badge-warning' : 'badge-accent'}`}>{isVar ? 'Variable' : 'Fixed'}</span>
                    </td>
                    <td className="table-cell hidden md:table-cell text-xs t-secondary">{b.category}</td>
                    <td className="table-cell text-xs t-secondary whitespace-nowrap">{b.noDueDate ? '—' : formatDate(b.dueDate)}</td>
                    <td className="table-cell"><span className={`badge ${status.cls}`}>{status.label}</span></td>
                    <td className="table-cell text-right font-semibold t-primary">{formatCurrency(b.amount, cur)}</td>
                    <td className="table-cell">
                      <div className="flex gap-0.5 justify-end">
                        {!b.paid && <button onClick={() => { setPayBill(b); setPayAccountId(b.accountId || data.accounts[0]?.id || '') }} className="p-1 t-muted hover:text-[var(--success)]" title="Pay"><CreditCard size={13} /></button>}
                        {b.paid && <button onClick={() => handleUnpay(b)} className="p-1 t-muted hover:text-[var(--warning)]" title="Revert payment"><Undo2 size={13} /></button>}
                        <button onClick={() => openEdit(b)} className="p-1 t-muted hover:t-accent"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteId(b.id)} className="p-1 t-muted hover:text-[var(--danger)]"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay bill modal */}
      {payBill && (
        <Modal title={`Pay "${payBill.name}"`} onClose={() => setPayBill(null)} onSubmit={handlePay}>
          <p className="text-sm t-secondary mb-3">Amount: <span className="font-semibold t-primary">{formatCurrency(payBill.amount, cur)}</span></p>
          <FormField label="Pay from account">
            <select className="input" value={payAccountId} onChange={e => setPayAccountId(e.target.value)}>
              <option value="">Select account</option>
              {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, cur)})</option>)}
            </select>
          </FormField>
          <p className="text-[11px] t-muted mb-4">This will mark the bill as paid, create an expense transaction, and deduct from the selected account.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPayBill(null)} className="flex-1 btn-secondary">Cancel</button>
            <button type="submit" className="flex-1 btn-primary" disabled={!payAccountId}>Confirm Payment</button>
          </div>
        </Modal>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <Modal title={editing ? 'Edit Bill' : 'Add Bill'} onClose={() => setShowForm(false)} onSubmit={save}>
          <FormField label="Bill Name">
            <input className="input" placeholder="e.g. Netflix, Electricity" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="Bill Type">
            <div className="flex gap-2">
              {(['fixed', 'variable'] as BillType[]).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, billType: t }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize border transition-colors ${form.billType === t ? 'text-white border-transparent' : 'border-theme t-secondary'}`}
                  style={form.billType === t ? { background: 'var(--accent)' } : undefined}>
                  {t}
                </button>
              ))}
            </div>
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
              <FormField label="Due Date"><input className="input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></FormField>
              <FormField label="Frequency">
                <select className="input" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as BillFrequency }))}>
                  {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </FormField>
            </>
          )}
          <FormField label="Category">
            <CategoryPicker category={form.category} subcategory={(form as any).subcategory || ''}
              onCategoryChange={c => setForm(f => ({ ...f, category: c }))}
              onSubcategoryChange={s => setForm(f => ({ ...f, subcategory: s } as any))} />
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
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-secondary">Cancel</button>
            <button type="submit" className="flex-1 btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete Bill?" onClose={() => setDeleteId(null)}>
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
