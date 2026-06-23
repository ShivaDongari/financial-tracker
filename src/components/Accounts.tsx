import { useState } from 'react'
import { Plus, Pencil, Trash2, Landmark, Wallet, CreditCard, BadgeDollarSign, TrendingUp, X, Check, LucideIcon } from 'lucide-react'
import { useStore } from '../store'
import { Account, AccountType } from '../types'
import { formatCurrency, todayISO } from '../utils/helpers'
import { api } from '../utils/api'

const TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bank Account',
  cash: 'Cash',
  credit_card: 'Credit Card',
  loan: 'Loan',
  income: 'Income Source',
}

const TYPE_ICONS: Record<AccountType, LucideIcon> = {
  bank: Landmark,
  cash: Wallet,
  credit_card: CreditCard,
  loan: BadgeDollarSign,
  income: TrendingUp,
}

const TYPE_COLORS: Record<AccountType, string> = {
  bank: 'bg-blue-50 text-blue-600',
  cash: 'bg-green-50 text-green-600',
  credit_card: 'bg-purple-50 text-purple-600',
  loan: 'bg-red-50 text-red-600',
  income: 'bg-emerald-50 text-emerald-600',
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
      name: form.name.trim(),
      type: form.type,
      balance: parseFloat(form.balance) || 0,
      currency: form.currency,
      notes: form.notes || null,
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
    if (editing) {
      await api.updateAccount(editing.id, payload)
    } else {
      await api.createAccount(payload)
    }
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
        <h1 className="text-xl font-bold text-gray-900">Accounts</h1>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium">
          <Plus size={16} /> Add
        </button>
      </div>

      {data.accounts.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Landmark size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No accounts yet</p>
          <p className="text-sm mt-1">Add bank accounts, credit cards, loans, and income sources</p>
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
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{TYPE_LABELS[type]}</p>
              <p className={`text-xs font-semibold ${isDebt ? 'text-red-500' : 'text-green-600'}`}>{formatCurrency(total, cur)}</p>
            </div>
            <div className="space-y-2">
              {list.map(a => {
                const utilization = a.type === 'credit_card' && a.creditLimit ? ((a.balance / a.creditLimit) * 100).toFixed(1) : null
                return (
                  <div key={a.id} className="bg-white border border-gray-100 rounded-xl p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${TYPE_COLORS[type]}`}>
                          <Icon size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{a.name}</p>
                          {a.notes && <p className="text-xs text-gray-400 truncate max-w-[160px]">{a.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={`text-sm font-bold ${isDebt ? 'text-red-500' : 'text-gray-900'}`}>{formatCurrency(a.balance, a.currency)}</p>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg"><Pencil size={14} /></button>
                          <button onClick={() => setDeleteId(a.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                    {/* Extra details for loans and credit cards */}
                    {a.type === 'loan' && (a.interestRate != null || a.maturityDate) && (
                      <div className="mt-2 flex gap-3 text-xs text-gray-500">
                        {a.interestRate != null && <span>Rate: {a.interestRate}%/mo</span>}
                        {a.maturityDate && <span>Maturity: {a.maturityDate}</span>}
                        {a.originalAmount != null && <span>Payoff: {((1 - a.balance / a.originalAmount) * 100).toFixed(0)}%</span>}
                      </div>
                    )}
                    {a.type === 'credit_card' && (
                      <div className="mt-2 flex gap-3 text-xs text-gray-500">
                        {a.creditLimit != null && <span>Limit: {formatCurrency(a.creditLimit, cur)}</span>}
                        {utilization && <span className={parseFloat(utilization) > 70 ? 'text-red-500 font-medium' : ''}>Util: {utilization}%</span>}
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
          <p className="text-sm text-gray-500 mb-4">This will also delete all transactions for this account.</p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteId(null)} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
