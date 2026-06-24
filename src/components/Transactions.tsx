import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '../store'
import { Transaction, TransactionType, CATEGORIES, Category } from '../types'
import { formatCurrency, formatDate, todayISO, getMonthStartEnd } from '../utils/helpers'
import { api } from '../utils/api'
import { Modal, FormField } from './Accounts'

const emptyForm = {
  type: 'expense' as TransactionType, amount: '', category: 'Household' as Category,
  description: '', accountId: '', date: todayISO(), merchant: '', notes: '',
}

export default function Transactions() {
  const { data, refreshTransactions } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [filter, setFilter] = useState<TransactionType | 'all'>('all')
  const [catFilter, setCatFilter] = useState<Category | 'all'>('all')
  const [search, setSearch] = useState('')
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const cur = data.settings.currency
  const { start: mStart, end: mEnd } = getMonthStartEnd(data.selectedMonth)

  const filtered = useMemo(() => {
    let list = data.transactions
    if (filter !== 'all') list = list.filter(t => t.type === filter)
    if (catFilter !== 'all') list = list.filter(t => t.category === catFilter)
    if (search) list = list.filter(t => (t.description + t.merchant + t.category).toLowerCase().includes(search.toLowerCase()))
    list = [...list].sort((a, b) => {
      const cmp = sortBy === 'date' ? a.date.localeCompare(b.date) : a.amount - b.amount
      return sortDir === 'desc' ? -cmp : cmp
    })
    return list
  }, [data.transactions, filter, catFilter, search, sortBy, sortDir])

  const monthTxs = filtered.filter(t => t.date >= mStart && t.date <= mEnd)
  const monthIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  function openAdd() {
    setEditing(null); setForm({ ...emptyForm, date: todayISO(), accountId: data.accounts[0]?.id || '' }); setShowForm(true)
  }
  function openEdit(t: Transaction) {
    setEditing(t)
    setForm({ type: t.type, amount: String(t.amount), category: t.category, description: t.description, accountId: t.accountId, date: t.date, merchant: t.merchant || '', notes: t.notes || '' })
    setShowForm(true)
  }

  async function save() {
    const payload = { type: form.type, amount: parseFloat(form.amount) || 0, category: form.category, description: form.description.trim(), accountId: form.accountId, date: form.date, merchant: form.merchant.trim(), notes: form.notes.trim() }
    if (!payload.amount || !payload.accountId) return
    if (editing) await api.updateTransaction(editing.id, payload)
    else await api.createTransaction(payload)
    await refreshTransactions(); setShowForm(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    await api.deleteTransaction(deleteId); await refreshTransactions(); setDeleteId(null)
  }

  function toggleSort(col: 'date' | 'amount') {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }
  const SortIcon = ({ col }: { col: 'date' | 'amount' }) => sortBy === col ? (sortDir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />) : null

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold t-primary">Transactions</h1>
          <p className="text-xs t-muted">{filtered.length} records · Income: <span className="text-[var(--success)]">{formatCurrency(monthIncome, cur)}</span> · Expenses: <span className="text-[var(--danger)]">{formatCurrency(monthExpense, cur)}</span></p>
        </div>
        <button onClick={openAdd} className="btn-primary self-start"><Plus size={14} className="inline mr-1" />Add</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg overflow-hidden border border-theme">
          {(['all', 'income', 'expense', 'transfer'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium capitalize ${filter === f ? 'text-white' : 't-secondary'}`}
              style={filter === f ? { background: 'var(--accent)' } : undefined}>{f}</button>
          ))}
        </div>
        <select className="input !w-auto !py-1.5 text-xs" value={catFilter} onChange={e => setCatFilter(e.target.value as any)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 t-muted" />
          <input className="input !pl-8 !py-1.5 text-xs" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header cursor-pointer select-none" onClick={() => toggleSort('date')}>
                  Date <SortIcon col="date" />
                </th>
                <th className="table-header">Type</th>
                <th className="table-header">Description</th>
                <th className="table-header hidden md:table-cell">Category</th>
                <th className="table-header hidden lg:table-cell">Account</th>
                <th className="table-header text-right cursor-pointer select-none" onClick={() => toggleSort('amount')}>
                  Amount <SortIcon col="amount" />
                </th>
                <th className="table-header w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="table-cell text-center t-muted py-8">No transactions found.</td></tr>
              )}
              {filtered.map(tx => {
                const account = data.accounts.find(a => a.id === tx.accountId)
                const hasItems = tx.lineItems?.length > 0
                const expanded = expandedTx === tx.id
                return (
                  <>
                    <tr key={tx.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="table-cell whitespace-nowrap text-xs t-muted">{formatDate(tx.date)}</td>
                      <td className="table-cell">
                        <span className={`badge ${tx.type === 'income' ? 'badge-success' : tx.type === 'expense' ? 'badge-danger' : 'badge-accent'}`}>{tx.type}</span>
                        {tx.scanned && <span className="badge badge-accent ml-1">OCR</span>}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{tx.description || tx.merchant || '—'}</span>
                          {hasItems && (
                            <button onClick={() => setExpandedTx(expanded ? null : tx.id)} className="t-accent text-[10px] font-medium">
                              {tx.lineItems.length} items {expanded ? <ChevronUp size={10} className="inline" /> : <ChevronDown size={10} className="inline" />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="table-cell hidden md:table-cell text-xs t-secondary">{tx.category}</td>
                      <td className="table-cell hidden lg:table-cell text-xs t-secondary">{account?.name || '—'}</td>
                      <td className={`table-cell text-right font-semibold ${tx.type === 'income' ? 'text-[var(--success)]' : tx.type === 'expense' ? 'text-[var(--danger)]' : 't-primary'}`}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(tx.amount, cur)}
                      </td>
                      <td className="table-cell">
                        <div className="flex gap-0.5 justify-end">
                          <button onClick={() => openEdit(tx)} className="p-1 t-muted hover:t-accent"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteId(tx.id)} className="p-1 t-muted hover:text-[var(--danger)]"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                    {expanded && hasItems && (
                      <tr key={tx.id + '-items'}>
                        <td colSpan={7} className="px-3 py-2" style={{ background: 'var(--bg-hover)' }}>
                          <div className="flex flex-wrap gap-3">
                            {tx.lineItems.map((li, i) => (
                              <div key={li.id || i} className="text-xs flex items-center gap-2">
                                <span className="t-secondary">{li.description}</span>
                                <span className="badge badge-accent">{li.category}</span>
                                <span className="font-medium t-primary">{formatCurrency(li.amount, cur)}{li.quantity > 1 ? ` ×${li.quantity}` : ''}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal title={editing ? 'Edit Transaction' : 'Add Transaction'} onClose={() => setShowForm(false)} onSubmit={save}>
          <div className="flex gap-2 mb-3">
            {(['expense', 'income', 'transfer'] as TransactionType[]).map(t => (
              <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize border transition-colors ${form.type === t ? 'text-white border-transparent' : 'border-theme t-secondary'}`}
                style={form.type === t ? { background: 'var(--accent)' } : undefined}>{t}</button>
            ))}
          </div>
          <FormField label="Amount"><input className="input" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></FormField>
          <FormField label="Description"><input className="input" placeholder="What for?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Category">
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
            </FormField>
            <FormField label="Account">
              <select className="input" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
                <option value="">Select</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date"><input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></FormField>
            <FormField label="Merchant"><input className="input" placeholder="Optional" value={form.merchant} onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} /></FormField>
          </div>
          <FormField label="Notes"><textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></FormField>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-secondary">Cancel</button>
            <button type="submit" className="flex-1 btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete Transaction?" onClose={() => setDeleteId(null)}>
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
