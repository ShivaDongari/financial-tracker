import { useMemo } from 'react'
import { ArrowLeft, BadgeDollarSign, CreditCard } from 'lucide-react'
import { useStore } from '../store'
import { formatCurrency } from '../utils/helpers'
import { Account } from '../types'

interface Props { onBack: () => void }

export default function DetailedLoans({ onBack }: Props) {
  const { data } = useStore()
  const cur = data.settings.currency
  const debts = data.accounts.filter(a => a.type === 'loan' || a.type === 'credit_card')
  const totalDebt = debts.reduce((s, a) => s + a.balance, 0)

  const debtTransactions = useMemo(() =>
    data.transactions.filter(t => t.category === 'Loans / Debt Service').sort((a, b) => b.date.localeCompare(a.date)),
    [data.transactions]
  )

  const totalPaid = debtTransactions.reduce((s, t) => s + t.amount, 0)

  function renderCreditCard(a: Account) {
    const limit = a.creditLimit || 0
    const available = Math.max(0, limit - a.balance)
    const usage = limit > 0 ? ((a.balance / limit) * 100) : 0
    const usageColor = usage > 70 ? 'text-rose-500' : usage > 40 ? 'text-amber-500' : 'text-emerald-500'
    const barColor = usage > 70 ? 'bg-rose-500' : usage > 40 ? 'bg-amber-500' : 'bg-emerald-500'

    return (
      <div className="card-hover" key={a.id}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
            <CreditCard size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold t-primary">{a.name}</p>
            {a.statementDueDay && <p className="text-[11px] t-muted">Statement due: Day {a.statementDueDay}</p>}
          </div>
          <p className="text-sm font-bold text-rose-500">{formatCurrency(a.balance, cur)}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="bg-[var(--bg-hover)] rounded-lg p-2 text-center">
            <p className="text-[9px] font-semibold t-muted uppercase">Limit</p>
            <p className="text-xs font-bold t-primary">{formatCurrency(limit, cur)}</p>
          </div>
          <div className="bg-[var(--bg-hover)] rounded-lg p-2 text-center">
            <p className="text-[9px] font-semibold t-muted uppercase">Available</p>
            <p className="text-xs font-bold text-emerald-600">{formatCurrency(available, cur)}</p>
          </div>
          <div className="bg-[var(--bg-hover)] rounded-lg p-2 text-center">
            <p className="text-[9px] font-semibold t-muted uppercase">Usage</p>
            <p className={`text-xs font-bold ${usageColor}`}>{usage.toFixed(1)}%</p>
          </div>
        </div>
        <div className="w-full h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(usage, 100)}%` }} />
        </div>
      </div>
    )
  }

  function renderLoan(a: Account) {
    const payoff = a.originalAmount ? ((1 - a.balance / a.originalAmount) * 100) : 0
    return (
      <div className="card-hover" key={a.id}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white">
            <BadgeDollarSign size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold t-primary">{a.name}</p>
            <div className="flex gap-3 text-[11px] t-muted">
              {a.interestRate != null && <span>{a.interestRate}%/mo</span>}
              {a.maturityDate && <span>Due: {a.maturityDate}</span>}
            </div>
          </div>
          <p className="text-sm font-bold text-rose-500">{formatCurrency(a.balance, cur)}</p>
        </div>
        {a.originalAmount != null && (
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="t-muted">Original: {formatCurrency(a.originalAmount, cur)}</span>
              <span className="text-emerald-600 font-semibold">{payoff.toFixed(0)}% paid off</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${payoff}%` }} />
            </div>
          </div>
        )}
      </div>
    )
  }

  const loans = debts.filter(a => a.type === 'loan')
  const cards = debts.filter(a => a.type === 'credit_card')

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <div className="flex items-center gap-3 pt-2">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors t-secondary">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold t-primary">Loans & Debts</h1>
          <p className="text-xs t-muted">Total outstanding: {formatCurrency(totalDebt, cur)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Total Debt</p>
          <p className="text-lg font-bold text-rose-500 mt-1">{formatCurrency(totalDebt, cur)}</p>
        </div>
        <div className="card">
          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Total Paid</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{formatCurrency(totalPaid, cur)}</p>
        </div>
      </div>

      {cards.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider mb-2">Credit Cards</p>
          <div className="space-y-2">{cards.map(renderCreditCard)}</div>
        </div>
      )}

      {loans.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider mb-2">Loans</p>
          <div className="space-y-2">{loans.map(renderLoan)}</div>
        </div>
      )}

      {debtTransactions.length > 0 && (
        <div className="card">
          <p className="text-sm font-semibold t-primary mb-3">Debt Payments</p>
          {debtTransactions.slice(0, 20).map(tx => (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border-card)' }}>
              <div>
                <p className="text-sm font-medium t-primary">{tx.description || tx.merchant || 'Payment'}</p>
                <p className="text-[11px] t-muted">{tx.date}</p>
              </div>
              <p className="text-sm font-bold text-emerald-600">-{formatCurrency(tx.amount, cur)}</p>
            </div>
          ))}
        </div>
      )}

      {debts.length === 0 && (
        <div className="text-center py-16 t-muted">
          <div className="text-4xl mb-3">🎉</div>
          <p className="font-semibold t-secondary">Debt free!</p>
          <p className="text-sm mt-1">No loans or credit card balances.</p>
        </div>
      )}
    </div>
  )
}
