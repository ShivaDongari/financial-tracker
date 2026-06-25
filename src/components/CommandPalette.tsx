import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LayoutDashboard, Wallet, ArrowLeftRight, CalendarClock, RefreshCw, PiggyBank, BarChart3, ScanLine, FileUp, Scale, Settings, Plus, Moon, Sun, LucideIcon } from 'lucide-react'
import { useStore } from '../store'

interface Command {
  id: string
  label: string
  description?: string
  Icon: LucideIcon
  action: () => void
  keywords: string
}

export default function CommandPalette() {
  const navigate = useNavigate()
  const settings = useStore(s => s.settings)
  const updateSettings = useStore(s => s.updateSettings)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands: Command[] = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, action: () => navigate('/'), keywords: 'home overview' },
    { id: 'accounts', label: 'Accounts', Icon: Wallet, action: () => navigate('/accounts'), keywords: 'bank cash card' },
    { id: 'transactions', label: 'Transactions', Icon: ArrowLeftRight, action: () => navigate('/transactions'), keywords: 'activity expense income' },
    { id: 'bills', label: 'Bills & Payments', Icon: CalendarClock, action: () => navigate('/bills'), keywords: 'bill pay due' },
    { id: 'subscriptions', label: 'Subscriptions', Icon: RefreshCw, action: () => navigate('/subscriptions'), keywords: 'recurring netflix' },
    { id: 'budgets', label: 'Budgets', Icon: PiggyBank, action: () => navigate('/budgets'), keywords: 'limit spending' },
    { id: 'reports', label: 'Reports & Analytics', Icon: BarChart3, action: () => navigate('/reports'), keywords: 'chart trend tax forecast' },
    { id: 'scan', label: 'Scan Receipt', Icon: ScanLine, action: () => navigate('/scan'), keywords: 'ocr camera photo' },
    { id: 'import', label: 'Import Data', Icon: FileUp, action: () => navigate('/import'), keywords: 'csv ofx bank statement' },
    { id: 'reconcile', label: 'Reconcile', Icon: Scale, action: () => navigate('/reconciliation'), keywords: 'balance check match' },
    { id: 'settings', label: 'Settings', Icon: Settings, action: () => navigate('/settings'), keywords: 'profile currency' },
    { id: 'assets', label: 'Detailed Assets', Icon: Wallet, action: () => navigate('/assets'), keywords: 'asset detail' },
    { id: 'income-history', label: 'Income History', Icon: BarChart3, action: () => navigate('/income-history'), keywords: 'income months all' },
    { id: 'loans', label: 'Loans & Debts', Icon: CalendarClock, action: () => navigate('/loans'), keywords: 'debt loan credit' },
    { id: 'add-tx', label: 'Add Transaction', description: 'Open quick add', Icon: Plus, action: () => { setOpen(false); document.querySelector<HTMLButtonElement>('[title="Quick add (Ctrl+N)"]')?.click() }, keywords: 'new add transaction quick' },
    { id: 'dark-mode', label: settings.darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode', Icon: settings.darkMode ? Sun : Moon, action: () => updateSettings({ darkMode: !settings.darkMode }), keywords: 'dark light theme toggle' },
  ], [navigate, settings.darkMode, updateSettings])

  const filtered = useMemo(() => {
    if (!query) return commands
    const lower = query.toLowerCase()
    return commands.filter(c => (c.label + ' ' + c.keywords + ' ' + (c.description || '')).toLowerCase().includes(lower))
  }, [commands, query])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); document.querySelector<HTMLButtonElement>('[title="Quick add (Ctrl+N)"]')?.click() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (open) { setQuery(''); setSelected(0); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open])

  useEffect(() => { setSelected(0) }, [query])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && filtered[selected]) { filtered[selected].action(); setOpen(false) }
    if (e.key === 'Escape') setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-xl overflow-hidden shadow-2xl" style={{ background: 'var(--bg-card)' }}
        onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-theme">
          <Search size={16} className="t-muted shrink-0" />
          <input ref={inputRef} className="flex-1 text-sm bg-transparent outline-none t-primary" placeholder="Search pages, actions, settings..."
            value={query} onChange={e => setQuery(e.target.value)} />
          <kbd className="text-[10px] t-muted px-1.5 py-0.5 rounded border border-theme">ESC</kbd>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1.5">
          {filtered.length === 0 && <p className="text-xs t-muted text-center py-6">No results for "{query}"</p>}
          {filtered.map((cmd, i) => {
            const Icon = cmd.Icon
            return (
              <button key={cmd.id} onClick={() => { cmd.action(); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${i === selected ? 'bg-[var(--bg-hover)]' : ''}`}
                onMouseEnter={() => setSelected(i)}>
                <Icon size={16} className="t-muted shrink-0" />
                <div className="text-left flex-1 min-w-0">
                  <p className="t-primary font-medium truncate">{cmd.label}</p>
                  {cmd.description && <p className="text-[10px] t-muted">{cmd.description}</p>}
                </div>
                {i === selected && <span className="text-[10px] t-muted">↵</span>}
              </button>
            )
          })}
        </div>
        <div className="px-4 py-2 border-t border-theme flex items-center gap-4 text-[10px] t-muted">
          <span><kbd className="px-1 py-0.5 rounded border border-theme mr-0.5">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 py-0.5 rounded border border-theme mr-0.5">↵</kbd> select</span>
          <span><kbd className="px-1 py-0.5 rounded border border-theme mr-0.5">Ctrl+N</kbd> quick add</span>
        </div>
      </div>
    </div>
  )
}
