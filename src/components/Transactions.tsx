import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, ArrowLeftRight, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '../store'
import { Transaction, TransactionType, CATEGORIES, Category } from '../types'
import { formatCurrency, formatDate, todayISO } from '../utils/helpers'
import { api } from '../utils/api'
import { Modal, FormField } from './Accounts'

const emptyForm = {
  type: 'expense' as TransactionType,
  amount: '',
  category: 'Household' as Category,
  description: '',
  accountId: '',
  date: todayISO(),
  merchant: '',
  notes: '',
}

export default function Transactions() {
  const { data, refreshTransactions } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [filter, setFilter] = useState<TransactionType | 'all'>('all')
  const [showFilter, setShowFilter] = useState(false)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const cur = data.settings.currency

  const filtered = useMemo(() => {
    if (filter === 'all') return data.transactions
    return data.transactions.filter(t => t.type === filter)
  }, [data.transactions, filter])

  function openAdd() {
    setEditing(null)
    setForm({ ...emptyForm, date: todayISO(), accountId: data.accounts[0]?.id || '' })
    setShowForm(true)
  }

  function openEdit(t: Transaction) {
    setEditing(t)
    setForm({
      type: t.type, amount: String(t.amount), category: t.category,
      description: t.description, accountId: t.accountId, date: t.date,
      merchant: t.merchant || '', notes: t.notes || '',
    })
    setShowForm(true)
  }

  async function save() {
    const payload = {
      type: form.type,
      amount: parseFloat(form.amount) || 0,
      category: form.category,
      description: form.description.trim(),
      accountId: form.accountId,
      date: form.date,
      merchant: form.merchant.trim(),
      notes: form.notes.trim(),
    }
    if (!payload.amount || !payload.accountId) return
    if (editing) {
      await api.updateTransaction(editing.id, payload)
    } else {
      await api.createTransaction(payload)
    }
    await refreshTransactions()
    setShowForm(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    await api.deleteTransaction(deleteId)
    await refreshTransactions()
    setDeleteId(null)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold text-gray-900">Transactions</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border ${showFilter ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-600'}`}>
            <Filter size={14} /> Filter
          </button>
          <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium">
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {showFilter && (
        <div className="flex gap-2">
          {(['all', 'income', 'expense', 'transfer'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{f}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <ArrowLeftRight size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No transactions yet</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(tx => {
          const account = data.accounts.find(a => a.id === tx.accountId)
          const hasLineItems = tx.lineItems && tx.lineItems.length > 0
          const expanded = expandedTx === tx.id
          return (
            <div key={tx.id} className="bg-white border border-gray-100 rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      tx.type === 'income' ? 'bg-green-50 text-green-700' :
                      tx.type === 'expense' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
                    }`}>{tx.type}</span>
                    {tx.scanned && <span className="text-xs text-blue-500">· scanned</span>}
                    {hasLineItems && (
                      <button onClick={() => setExpandedTx(expanded ? null : tx.id)} className="text-xs text-purple-500 flex items-center gap-0.5">
                        {tx.lineItems.length} items {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{tx.description || tx.merchant || tx.category}</p>
                  <p className="text-xs text-gray-400">{formatDate(tx.date)} · {tx.category}{account ? ` · ${account.name}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <p className={`text-sm font-bold whitespace-nowrap ${tx.type === 'income' ? 'text-green-600' : tx.type === 'expense' ? 'text-red-500' : 'text-gray-700'}`}>
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(tx.amount, cur)}
                  </p>
                  <div className="flex gap-0.5">
                    <button onClick={() => openEdit(tx)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteId(tx.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>

              {expanded && hasLineItems && (
                <div className="mt-2 pt-2 border-t border-gray-50 space-y-1">
                  {tx.lineItems.map((li, i) => (
                    <div key={li.id || i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{li.description}</span>
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{li.category}</span>
                      </div>
                      <span className="text-gray-700 font-medium">{formatCurrency(li.amount, cur)}{li.quantity > 1 ? ` x${li.quantity}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showForm && (
        <Modal title={editing ? 'Edit Transaction' : 'Add Transaction'} onClose={() => setShowForm(false)}>
          <div className="flex gap-2 mb-4">
            {(['expense', 'income', 'transfer'] as TransactionType[]).map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize border ${form.type === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500'}`}>{t}</button>
            ))}
          </div>
          <FormField label="Amount">
            <input className="input" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </FormField>
          <FormField label="Description">
            <input className="input" placeholder="What was this for?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FormField label="Category">
            <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Account">
            <select className="input" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
              <option value="">Select account</option>
              {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </FormField>
          <FormField label="Date">
            <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </FormField>
          <FormField label="Merchant (optional)">
            <input className="input" placeholder="Merchant name" value={form.merchant} onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} />
          </FormField>
          <FormField label="Notes (optional)">
            <textarea className="input resize-none" rows={2} placeholder="Any notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </FormField>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={save} className="flex-1 btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete Transaction?" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-500 mb-4">This action cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteId(null)} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium">Delete</button>
          </div>
        </Modal>
      )}

      <div className="h-4" />
    </div>
  )
}
