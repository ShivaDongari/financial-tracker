import { ArrowLeft, Landmark, Wallet, TrendingUp } from 'lucide-react'
import { useStore } from '../store'
import { formatCurrency } from '../utils/helpers'

interface Props { onBack: () => void }

export default function DetailedAssets({ onBack }: Props) {
  const { data } = useStore()
  const cur = data.settings.currency
  const assets = data.accounts.filter(a => a.type === 'bank' || a.type === 'cash' || a.type === 'income')
  const total = assets.reduce((s, a) => s + a.balance, 0)

  const icons = { bank: Landmark, cash: Wallet, income: TrendingUp } as const

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 pt-2">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors t-secondary">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold t-primary">Detailed Assets</h1>
          <p className="text-xs t-muted">Total: {formatCurrency(total, cur)}</p>
        </div>
      </div>

      {assets.length === 0 && (
        <div className="text-center py-16 t-muted">
          <div className="text-4xl mb-3">🏦</div>
          <p className="font-semibold t-secondary">No asset accounts</p>
        </div>
      )}

      {(['bank', 'cash', 'income'] as const).map(type => {
        const list = assets.filter(a => a.type === type)
        if (!list.length) return null
        const Icon = icons[type]
        const subtotal = list.reduce((s, a) => s + a.balance, 0)
        const labels = { bank: 'Bank Accounts', cash: 'Cash', income: 'Income Sources' }
        return (
          <div key={type}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">{labels[type]}</p>
              <p className="text-xs font-bold text-emerald-600">{formatCurrency(subtotal, cur)}</p>
            </div>
            <div className="space-y-2">
              {list.map(a => (
                <div key={a.id} className="card-hover">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white">
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold t-primary">{a.name}</p>
                        {a.notes && <p className="text-[11px] t-muted truncate max-w-[200px]">{a.notes}</p>}
                      </div>
                    </div>
                    <p className="text-sm font-bold t-primary">{formatCurrency(a.balance, a.currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {total > 0 && (
        <div className="card bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2">Asset Breakdown</p>
          {(['bank', 'cash', 'income'] as const).map(type => {
            const sub = assets.filter(a => a.type === type).reduce((s, a) => s + a.balance, 0)
            if (!sub) return null
            const pct = ((sub / total) * 100).toFixed(1)
            const labels = { bank: 'Bank', cash: 'Cash', income: 'Income' }
            return (
              <div key={type} className="flex items-center justify-between py-1.5">
                <span className="text-xs text-emerald-600 dark:text-emerald-400">{labels[type]}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-emerald-200 dark:bg-emerald-900 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 w-12 text-right">{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
