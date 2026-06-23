import { useState } from 'react'
import { Plus, Pencil, Trash2, Landmark, Wallet, CreditCard, BadgeDollarSign, TrendingUp, X, LucideIcon } from 'lucide-react'
import { useStore } from '../store'
import { Account, AccountType } from '../types'
import { formatCurrency } from '../utils/helpers'
import { api } from '../utils/api'

const TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bank Account', cash: 'Cash', credit_card: 'Credit Card', loan: 'Loan', income: 'Income Source',
}

const TYPE_ICONS: Record<AccountType, LucideIcon> = {
  bank: Landmark, cash: Wallet, credit_card: CreditCard, loan: BadgeDollarSign, income: TrendingUp,
}

const TYPE_GRADIENTS: Record<AccountType, string> = {
  bank: 'from-blue-500 to-indigo-600',
  cash: 'from-emerald-500 to-green-600',
  credit_card: 'from-violet-500 to-purple-600',
  loan: 'from-rose-500 to-pink-600',
  income: 'from-teal-500 to-emerald-600',
}

const emptyForm = {
  name: '', type: 'bank' as AccountType, balance: '', currency: 'USD', notes: '',
  interestRate: '', maturityDate: '', originalAmount: '', creditLimit: '', statementDueDay: '',
}

export default function Accounts() {
  const { data, refreshAccounts } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const cur = data.settings.currency

  function openAdd() {
    setEditing(null)
    setForm({ ...emptyForm, currency: cur })
    setShowForm(true)
  }

  function openEdit(a: Account) {
    setEditing(a)
    setForm({
      name: a.name, type: a.type, balance: String(a.balance), currency: a.currency, notes: a.notes || '',
      interestRate: a.interestRate != null ? String(a.interestRate) : '',
      maturityDate: a.maturityDate || '',
      originalAmount: a.originalAmount != null ? String(a.originalAmount) : '',
      creditLimit: a.creditLimit != null ? String(a.creditLimit) : '',
      statementDueDay: a.statementDueDay != null ? String(a.statementDueDay) : '',
    })
    setShowForm(true)
  }

  async function save() {
    const payload: any = {
      name: form.name.trim(), type: form.type, balance: parseFloat(form.balance) || 0,
      currency: form.currency, notes: form.notes || null,
    }
    if (form.type === 'loan') {
      payload.interestRate = form.interestRate ? parseFloat(form.interestRate) : null
      payload.maturityDate = form.maturityDate || null
      payload.originalAmount = form.originalAmount ? parseFloat(form.originalAmount) : null
    }
    if (form.type === 'credit_card') {
      payload.creditLimit = form.creditLimit ? parseFloat(form.creditLimit) : null
      payload.statementDueDay = form.statementDueDay ? parseInt(form.statementDueDay) : null
    }
    if (!payload.name) return
    if (editing) await api.updateAccount(editing.id, payload)
    else await api.createAccount(payload)
    await refreshAccounts()
    setShowForm(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    await api.deleteAccount(deleteId)
    await refreshAccounts()
    setDeleteId(null)
  }

  const grouped = Object.fromEntries(
    (['bank', 'cash', 'income', 'credit_card', 'loan'] as AccountType[]).map(t => [t, data.accounts.filter(a => a.type === t)])
  ) as Record<AccountType, Account[]>

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Accounts</h1>
          <p className="text-xs text-slate-400">Your money lives here</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl px-3.5 py-2 text-sm font-semibold shadow-sm">
          <Plus size={16} /> Add
        </button>
      </div>

      {data.accounts.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">🏦</div>
          <p className="font-semibold text-slate-600">No accounts yet</p>
          <p className="text-sm mt-1">Add bank accounts, cards, loans & more</p>
        </div>
      )}

      {(['bank', 'cash', 'income', 'credit_card', 'loan'] as AccountType[]).map(type => {
        const list = grouped[type]
        if (!list.length) return null
        const Icon = TYPE_ICONS[type]
        const isDebt = type === 'credit_card' || type === 'loan'
        const total = list.reduce((s, a) => s + a.balance, 0)
        return (
          <div key={type}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{TYPE_LABELS[type]}</p>
              <p className={`text-xs font-bold ${isDebt ? 'text-rose-500' : 'text-emerald-600'}`}>{formatCurrency(total, cur)}</p>
            </div>
            <div className="space-y-2">
              {list.map(a => {
                const utilization = a.type === 'credit_card' && a.creditLimit ? ((a.balance / a.creditLimit) * 100).toFixed(1) : null
                return (
                  <div key={a.id} className="card-hover">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${TYPE_GRADIENTS[type]} flex items-center justify-center text-white`}>
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{a.name}</p>
                          {a.notes && <p className="text-[11px] text-slate-400 truncate max-w-[140px]">{a.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-bold ${isDebt ? 'text-rose-500' : 'text-slate-800'}`}>{formatCurrency(a.balance, a.currency)}</p>
                        <div className="flex gap-0.5">
                          <button onClick={() => openEdit(a)} className="p-1.5 text-slate-400 hover:text-violet-600 rounded-lg"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteId(a.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                    {a.type === 'loan' && (a.interestRate != null || a.maturityDate) && (
                      <div className="mt-2 flex gap-3 text-[11px] text-slate-500">
                        {a.interestRate != null && <span>Rate: {a.interestRate}%/mo</span>}
                        {a.maturityDate && <span>Maturity: {a.maturityDate}</span>}
                        {a.originalAmount != null && (
                          <span className="text-emerald-600 font-medium">{((1 - a.balance / a.originalAmount) * 100).toFixed(0)}% paid off</span>
                        )}
                      </div>
                    )}
                    {a.type === 'credit_card' && (
                      <div className="mt-2 flex gap-3 text-[11px] text-slate-500">
                        {a.creditLimit != null && <span>Limit: {formatCurrency(a.creditLimit, cur)}</span>}
                        {utilization && <span className={parseFloat(utilization) > 70 ? 'text-rose-500 font-medium' : ''}>Util: {utilization}%</span>}
                        {a.statementDueDay && <span>Due: Day {a.statementDueDay}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {showForm && (
        <Modal title={editing ? 'Edit Account' : 'Add Account'} onClose={() => setShowForm(false)}>
          <FormField label="Account Name">
            <input className="input" placeholder="e.g. Chase Checking" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </FormField>
          <FormField label="Type">
            <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </FormField>
          <FormField label="Current Balance">
            <input className="input" type="number" step="0.01" placeholder="0.00" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
          </FormField>
          {form.type === 'loan' && (
            <>
              <FormField label="Monthly Interest Rate (%)">
                <input className="input" type="number" step="0.01" placeholder="1.5" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} />
              </FormField>
              <FormField label="Maturity Date">
                <input className="input" type="date" value={form.maturityDate} onChange={e => setForm(f => ({ ...f, maturityDate: e.target.value }))} />
              </FormField>
              <FormField label="Original Loan Amount">
                <input className="input" type="number" step="0.01" placeholder="10000" value={form.originalAmount} onChange={e => setForm(f => ({ ...f, originalAmount: e.target.value }))} />
              </FormField>
            </>
          )}
          {form.type === 'credit_card' && (
            <>
              <FormField label="Credit Limit">
                <input className="input" type="number" step="0.01" placeholder="5000" value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))} />
              </FormField>
              <FormField label="Statement Due Day (1-31)">
                <input className="input" type="number" min="1" max="31" placeholder="15" value={form.statementDueDay} onChange={e => setForm(f => ({ ...f, statementDueDay: e.target.value }))} />
              </FormField>
            </>
          )}
          <FormField label="Notes (optional)">
            <input className="input" placeholder="Any notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </FormField>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={save} className="flex-1 btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete Account?" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-slate-500 mb-4">This will also delete all transactions for this account.</p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteId(null)} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="flex-1 bg-rose-500 text-white rounded-2xl py-3 text-sm font-semibold">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}
