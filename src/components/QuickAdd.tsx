import { useState, useEffect, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '../store'
import { CATEGORIES } from '../types'
import { todayISO } from '../utils/helpers'
import { getSuggestions } from '../utils/smartDefaults'
import { api } from '../utils/api'

export default function QuickAdd() {
  const accounts = useStore(s => s.accounts)
  const refreshTransactions = useStore(s => s.refreshTransactions)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ amount: '', description: '', category: 'Other', accountId: '', type: 'expense' as 'income' | 'expense' })
  const [saving, setSaving] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setForm({ amount: '', description: '', category: 'Other', accountId: accounts[0]?.id || '', type: 'expense' })
      setTimeout(() => amountRef.current?.focus(), 100)
    }
  }, [open, accounts])

  // Smart suggestions when description changes
  useEffect(() => {
    if (!form.description || form.description.length < 3) return
    const timeout = setTimeout(async () => {
      const suggestion = await getSuggestions(form.description)
      if (suggestion) {
        setForm(f => ({
          ...f,
          category: suggestion.category,
          type: suggestion.type,
          ...(suggestion.accountId && !f.accountId ? { accountId: suggestion.accountId } : {}),
        }))
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [form.description])

  async function save() {
    const amount = parseFloat(form.amount)
    if (!amount || !form.accountId) return
    setSaving(true)
    await api.createTransaction({
      type: form.type, amount, category: form.category,
      description: form.description.trim() || form.category,
      accountId: form.accountId, date: todayISO(),
    })
    await refreshTransactions()
    setSaving(false)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); save() }
    if (e.key === 'Escape') setOpen(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg z-50 transition-transform hover:scale-105"
        style={{ background: 'var(--accent)' }} title="Quick add (Ctrl+N)">
        <Plus size={22} />
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="rounded-t-2xl sm:rounded-xl w-full max-w-sm p-4" style={{ background: 'var(--bg-card)', boxShadow: '0 8px 32px rgba(0,0,0,.12)' }}
        onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold t-primary">Quick Add</p>
          <button onClick={() => setOpen(false)} className="t-muted"><X size={16} /></button>
        </div>

        {/* Type toggle */}
        <div className="flex gap-1 mb-3 rounded-lg overflow-hidden border border-theme">
          {(['expense', 'income'] as const).map(t => (
            <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
              className={`flex-1 py-1.5 text-xs font-medium capitalize ${form.type === t ? 'text-white' : 't-secondary'}`}
              style={form.type === t ? { background: 'var(--accent)' } : undefined}>{t}</button>
          ))}
        </div>

        {/* Amount — large input */}
        <input ref={amountRef} className="w-full text-2xl font-bold t-primary bg-transparent border-none outline-none mb-3 text-center"
          type="number" step="0.01" placeholder="0.00" value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />

        {/* Description with smart suggest */}
        <input className="input mb-2 text-xs" placeholder="Description (auto-suggests category)"
          value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

        <div className="grid grid-cols-2 gap-2 mb-3">
          <select className="input text-xs" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="input text-xs" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
            <option value="">Account</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <button onClick={save} disabled={saving || !form.amount || !form.accountId}
          className="w-full btn-primary disabled:opacity-50 text-xs">
          {saving ? 'Saving...' : 'Save (Enter)'}
        </button>
      </div>
    </div>
  )
}
