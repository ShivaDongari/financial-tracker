import { useState, KeyboardEvent } from 'react'
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

  function openAdd() { setEditing(null); setForm({ ...emptyForm, currency: cur }); setShowForm(true) }
  function openEdit(a: Account) {
    setEditing(a)
    setForm({ name: a.name, type: a.type, balance: String(a.balance), currency: a.currency, notes: a.notes || '', interestRate: a.interestRate != null ? String(a.interestRate) : '', maturityDate: a.maturityDate || '', originalAmount: a.originalAmount != null ? String(a.originalAmount) : '', creditLimit: a.creditLimit != null ? String(a.creditLimit) : '', statementDueDay: a.statementDueDay != null ? String(a.statementDueDay) : '' })
    setShowForm(true)
  }

  async function save() {
    const payload: any = { name: form.name.trim(), type: form.type, balance: parseFloat(form.balance) || 0, currency: form.currency, notes: form.notes || null }
    if (form.type === 'loan') { payload.interestRate = form.interestRate ? parseFloat(form.interestRate) : null; payload.maturityDate = form.maturityDate || null; payload.originalAmount = form.originalAmount ? parseFloat(form.originalAmount) : null }
    if (form.type === 'credit_card') { payload.creditLimit = form.creditLimit ? parseFloat(form.creditLimit) : null; payload.statementDueDay = form.statementDueDay ? parseInt(form.statementDueDay) : null }
    if (!payload.name) return
    if (editing) await api.updateAccount(editing.id, payload); else await api.createAccount(payload)
    await refreshAccounts(); setShowForm(false)
  }

  async function handleDelete() { if (!deleteId) return; await api.deleteAccount(deleteId); await refreshAccounts(); setDeleteId(null) }

  const totalAssets = data.accounts.filter(a => ['bank', 'cash', 'income'].includes(a.type)).reduce((s, a) => s + a.balance, 0)
  const totalDebt = data.accounts.filter(a => ['credit_card', 'loan'].includes(a.type)).reduce((s, a) => s + a.balance, 0)

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold t-primary">Accounts</h1>
          <p className="text-xs t-muted">Assets: <span className="text-[var(--success)]">{formatCurrency(totalAssets, cur)}</span> · Debt: <span className="text-[var(--danger)]">{formatCurrency(totalDebt, cur)}</span></p>
        </div>
        <button onClick={openAdd} className="btn-primary self-start"><Plus size={14} className="inline mr-1" />Add Account</button>
      </div>

      {data.accounts.length === 0 && (
        <div className="text-center py-16 t-muted">
          <p className="font-medium t-secondary text-lg">No accounts yet</p>
          <p className="text-sm mt-1">Add your bank accounts, cards, and loans to begin tracking.</p>
        </div>
      )}

      {/* Table view */}
      {data.accounts.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Account</th>
                  <th className="table-header">Type</th>
                  <th className="table-header hidden md:table-cell">Details</th>
                  <th className="table-header text-right">Balance</th>
                  <th className="table-header w-16"></th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map(a => {
                  const Icon = TYPE_ICONS[a.type]
                  const isDebt = a.type === 'credit_card' || a.type === 'loan'
                  const limit = a.creditLimit || 0
                  const usage = limit > 0 ? (a.balance / limit * 100) : 0
                  const available = Math.max(0, limit - a.balance)

                  return (
                    <tr key={a.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: 'var(--accent)' }}>
                            <Icon size={14} />
                          </div>
                          <div>
                            <p className="font-medium t-primary">{a.name}</p>
                            {a.notes && <p className="text-[10px] t-muted truncate max-w-[150px]">{a.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell"><span className="badge badge-accent">{TYPE_LABELS[a.type]}</span></td>
                      <td className="table-cell hidden md:table-cell text-xs t-secondary">
                        {a.type === 'credit_card' && limit > 0 && (
                          <div className="space-y-1">
                            <span>Limit: {formatCurrency(limit, cur)} · Available: {formatCurrency(available, cur)} · Usage: <span className={usage > 70 ? 'text-[var(--danger)] font-medium' : ''}>{usage.toFixed(0)}%</span></span>
                            <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(usage, 100)}%`, background: usage > 70 ? 'var(--danger)' : usage > 40 ? 'var(--warning)' : 'var(--success)' }} />
                            </div>
                          </div>
                        )}
                        {a.type === 'loan' && a.originalAmount && (
                          <span>Paid off: {((1 - a.balance / a.originalAmount) * 100).toFixed(0)}%{a.interestRate != null ? ` · ${a.interestRate}%/mo` : ''}</span>
                        )}
                        {a.type === 'credit_card' && a.statementDueDay && !limit && <span>Due: Day {a.statementDueDay}</span>}
                      </td>
                      <td className={`table-cell text-right font-semibold ${isDebt ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                        {formatCurrency(a.balance, a.currency)}
                      </td>
                      <td className="table-cell">
                        <div className="flex gap-0.5 justify-end">
                          <button onClick={() => openEdit(a)} className="p-1 t-muted hover:t-accent"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteId(a.id)} className="p-1 t-muted hover:text-[var(--danger)]"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Account' : 'Add Account'} onClose={() => setShowForm(false)} onSubmit={save}>
          <FormField label="Name"><input className="input" placeholder="e.g. Chase Checking" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type">
              <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}>{Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </FormField>
            <FormField label="Balance"><input className="input" type="number" step="0.01" placeholder="0.00" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} /></FormField>
          </div>
          {form.type === 'loan' && (<>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Interest Rate (%/mo)"><input className="input" type="number" step="0.01" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} /></FormField>
              <FormField label="Original Amount"><input className="input" type="number" step="0.01" value={form.originalAmount} onChange={e => setForm(f => ({ ...f, originalAmount: e.target.value }))} /></FormField>
            </div>
            <FormField label="Maturity Date"><input className="input" type="date" value={form.maturityDate} onChange={e => setForm(f => ({ ...f, maturityDate: e.target.value }))} /></FormField>
          </>)}
          {form.type === 'credit_card' && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Credit Limit"><input className="input" type="number" step="0.01" value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))} /></FormField>
              <FormField label="Due Day (1-31)"><input className="input" type="number" min="1" max="31" value={form.statementDueDay} onChange={e => setForm(f => ({ ...f, statementDueDay: e.target.value }))} /></FormField>
            </div>
          )}
          <FormField label="Notes"><input className="input" placeholder="Optional" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></FormField>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-secondary">Cancel</button>
            <button type="submit" className="flex-1 btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete Account?" onClose={() => setDeleteId(null)}>
          <p className="text-sm t-secondary mb-4">All linked transactions will also be deleted.</p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteId(null)} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="flex-1 text-white rounded-lg py-2 text-sm font-medium" style={{ background: 'var(--danger)' }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function Modal({ title, onClose, onSubmit, children }: { title: string; onClose: () => void; onSubmit?: () => void; children: React.ReactNode }) {
  const Tag = onSubmit ? 'form' : 'div'
  const formProps = onSubmit ? {
    onSubmit: (e: React.FormEvent) => { e.preventDefault(); onSubmit() },
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' && e.target instanceof HTMLInputElement && onSubmit) { e.preventDefault(); onSubmit() } },
  } : {}
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <Tag {...(formProps as any)}
        className="rounded-t-2xl sm:rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', boxShadow: '0 8px 32px rgba(0,0,0,.12)' }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold t-primary">{title}</h2>
          <button type="button" onClick={onClose} className="t-muted hover:t-secondary"><X size={18} /></button>
        </div>
        {children}
      </Tag>
    </div>
  )
}

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-medium t-secondary mb-1">{label}</label>
      {children}
    </div>
  )
}
