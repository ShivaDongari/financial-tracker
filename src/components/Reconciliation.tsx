import { useState } from 'react'
import { Plus, Check, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { formatCurrency, formatDate } from '../utils/helpers'
import { api } from '../utils/api'
import { Modal, FormField } from './Accounts'

export default function Reconciliation() {
  const navigate = useNavigate()
  const accounts = useStore(s => s.accounts)
  const reconciliations = useStore(s => s.reconciliations)
  const settings = useStore(s => s.settings)
  const refreshReconciliations = useStore(s => s.refreshReconciliations)
  const refreshAccounts = useStore(s => s.refreshAccounts)
  const refreshTransactions = useStore(s => s.refreshTransactions)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ accountId: '', actualBalance: '', notes: '' })
  const cur = settings.currency

  const bankAccounts = accounts.filter(a => ['bank', 'cash', 'credit_card'].includes(a.type))
  const pending = reconciliations.filter(r => !r.resolved)
  const resolved = reconciliations.filter(r => r.resolved)

  async function save() {
    if (!form.accountId || !form.actualBalance) return
    await api.createReconciliation(form.accountId, parseFloat(form.actualBalance), form.notes || undefined)
    await refreshReconciliations()
    setShowForm(false)
    setForm({ accountId: '', actualBalance: '', notes: '' })
  }

  async function handleResolve(id: string, adjust: boolean) {
    await api.resolveReconciliation(id, adjust)
    await Promise.all([refreshReconciliations(), refreshAccounts(), refreshTransactions()])
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/accounts')} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] t-secondary">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold t-primary">Reconciliation</h1>
            <p className="text-xs t-muted">Compare tracked balances with actual bank balances</p>
          </div>
        </div>
        <button onClick={() => { setForm({ accountId: bankAccounts[0]?.id || '', actualBalance: '', notes: '' }); setShowForm(true) }} className="btn-primary self-start">
          <Plus size={14} className="inline mr-1" />New Reconciliation
        </button>
      </div>

      {/* Pending reconciliations */}
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-semibold t-muted uppercase tracking-wider mb-2">Needs Attention</p>
          <div className="card !p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Account</th>
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Tracked</th>
                  <th className="table-header text-right">Actual</th>
                  <th className="table-header text-right">Difference</th>
                  <th className="table-header w-32"></th>
                </tr>
              </thead>
              <tbody>
                {pending.map(r => {
                  const acc = accounts.find(a => a.id === r.accountId)
                  const isPos = r.difference >= 0
                  return (
                    <tr key={r.id} className="hover:bg-[var(--bg-hover)]">
                      <td className="table-cell font-medium t-primary">{acc?.name || '—'}</td>
                      <td className="table-cell text-xs t-muted">{formatDate(r.date)}</td>
                      <td className="table-cell text-right text-xs t-secondary">{formatCurrency(r.trackedBalance, cur)}</td>
                      <td className="table-cell text-right text-xs t-secondary">{formatCurrency(r.actualBalance, cur)}</td>
                      <td className={`table-cell text-right font-semibold ${r.difference === 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {isPos ? '+' : ''}{formatCurrency(r.difference, cur)}
                      </td>
                      <td className="table-cell">
                        <div className="flex gap-1 justify-end">
                          {r.difference !== 0 && (
                            <button onClick={() => handleResolve(r.id, true)} className="text-[10px] font-medium px-2 py-1 rounded text-white" style={{ background: 'var(--accent)' }}>
                              Adjust Balance
                            </button>
                          )}
                          <button onClick={() => handleResolve(r.id, false)} className="text-[10px] font-medium px-2 py-1 rounded btn-secondary">
                            {r.difference === 0 ? 'Confirm Match' : 'Dismiss'}
                          </button>
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

      {/* Quick check cards */}
      {bankAccounts.length > 0 && pending.length === 0 && (
        <div>
          <p className="text-xs font-semibold t-muted uppercase tracking-wider mb-2">Quick Balance Check</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bankAccounts.map(a => (
              <div key={a.id} className="card-hover">
                <p className="text-sm font-medium t-primary">{a.name}</p>
                <p className="text-xs t-muted mt-0.5">Tracked: {formatCurrency(a.balance, cur)}</p>
                <button onClick={() => { setForm({ accountId: a.id, actualBalance: '', notes: '' }); setShowForm(true) }}
                  className="mt-2 text-[11px] t-accent font-medium">Reconcile →</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {resolved.length > 0 && (
        <div>
          <p className="text-xs font-semibold t-muted uppercase tracking-wider mb-2">History</p>
          <div className="card !p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Account</th>
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Difference</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {resolved.slice(0, 20).map(r => {
                  const acc = accounts.find(a => a.id === r.accountId)
                  return (
                    <tr key={r.id} className="hover:bg-[var(--bg-hover)]">
                      <td className="table-cell text-sm t-primary">{acc?.name || '—'}</td>
                      <td className="table-cell text-xs t-muted">{formatDate(r.date)}</td>
                      <td className={`table-cell text-right text-xs ${r.difference === 0 ? 'text-[var(--success)]' : 't-secondary'}`}>
                        {r.difference === 0 ? 'Matched' : `${r.difference > 0 ? '+' : ''}${formatCurrency(r.difference, cur)}`}
                      </td>
                      <td className="table-cell"><span className="badge badge-success">Resolved</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <Modal title="Reconcile Account" onClose={() => setShowForm(false)} onSubmit={save}>
          <FormField label="Account">
            <select className="input" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
              <option value="">Select account</option>
              {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name} (tracked: {formatCurrency(a.balance, cur)})</option>)}
            </select>
          </FormField>
          <FormField label="Actual Balance (from bank statement)">
            <input className="input" type="number" step="0.01" placeholder="Enter your actual balance" value={form.actualBalance} onChange={e => setForm(f => ({ ...f, actualBalance: e.target.value }))} />
          </FormField>
          {form.accountId && form.actualBalance && (() => {
            const acc = accounts.find(a => a.id === form.accountId)
            const diff = parseFloat(form.actualBalance) - (acc?.balance || 0)
            return (
              <div className="rounded-lg p-3 mb-3" style={{ background: diff === 0 ? 'var(--success-light)' : 'var(--danger-light)' }}>
                <p className="text-xs font-medium" style={{ color: diff === 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {diff === 0 ? 'Balances match!' : `Difference: ${diff > 0 ? '+' : ''}${formatCurrency(diff, cur)}`}
                </p>
              </div>
            )
          })()}
          <FormField label="Notes (optional)">
            <input className="input" placeholder="e.g. Checked bank statement" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </FormField>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-secondary">Cancel</button>
            <button type="submit" className="flex-1 btn-primary">Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
