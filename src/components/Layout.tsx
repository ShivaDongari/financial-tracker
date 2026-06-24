import { ReactNode } from 'react'
import { LayoutDashboard, Wallet, ArrowLeftRight, CalendarClock, ScanLine, Settings, RefreshCw, TrendingUp, LucideIcon } from 'lucide-react'
import { Tab } from '../App'
import { useStore } from '../store'
import MonthSelector from './MonthSelector'

const navItems: { id: Tab; label: string; Icon: LucideIcon; group: string }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, group: 'main' },
  { id: 'accounts', label: 'Accounts', Icon: Wallet, group: 'main' },
  { id: 'transactions', label: 'Transactions', Icon: ArrowLeftRight, group: 'main' },
  { id: 'bills', label: 'Bills & Payments', Icon: CalendarClock, group: 'main' },
  { id: 'subscriptions', label: 'Subscriptions', Icon: RefreshCw, group: 'main' },
  { id: 'scanner', label: 'Scan Receipt', Icon: ScanLine, group: 'tools' },
  { id: 'settings', label: 'Settings', Icon: Settings, group: 'system' },
]

const mobileItems: Tab[] = ['dashboard', 'accounts', 'transactions', 'bills', 'subscriptions', 'settings']

interface Props { tab: Tab; onTabChange: (t: Tab) => void; children: ReactNode }

export default function Layout({ tab, onTabChange, children }: Props) {
  const { data } = useStore()
  const drillTabs = ['detailed-assets', 'all-months-income', 'detailed-loans']
  const activeMainTab = drillTabs.includes(tab) ? 'dashboard' : tab

  return (
    <div className="flex h-screen w-full bg-page">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-theme bg-nav shrink-0">
        <div className="px-4 py-4 border-b border-theme">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <TrendingUp size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold t-primary">FinTracker</span>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <SidebarGroup label="Overview" items={navItems.filter(n => n.group === 'main')} active={activeMainTab} onSelect={onTabChange} />
          <SidebarGroup label="Tools" items={navItems.filter(n => n.group === 'tools')} active={activeMainTab} onSelect={onTabChange} />
          <SidebarGroup label="System" items={navItems.filter(n => n.group === 'system')} active={activeMainTab} onSelect={onTabChange} />
        </nav>

        {data.settings.name && (
          <div className="px-4 py-3 border-t border-theme">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: 'var(--accent)' }}>
                {data.settings.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-medium t-primary truncate">{data.settings.name}</p>
                <p className="text-[10px] t-muted">Personal</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="hidden lg:flex items-center justify-between px-6 py-3 border-b border-theme bg-nav shrink-0">
          <MonthSelector />
          <div className="flex items-center gap-3">
            <button onClick={() => onTabChange('scanner')} className="btn-primary text-xs !py-1.5 !px-3">
              <ScanLine size={13} className="inline mr-1" />Scan
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-theme bg-nav pb-safe z-40">
        <div className="flex">
          {mobileItems.map(id => {
            const item = navItems.find(n => n.id === id)!
            const Icon = item.Icon
            return (
              <button key={id} onClick={() => onTabChange(id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${activeMainTab === id ? 't-accent' : 't-muted'}`}>
                <Icon size={18} />
                {item.label.split(' ')[0]}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function SidebarGroup({ label, items, active, onSelect }: { label: string; items: typeof navItems; active: string; onSelect: (t: Tab) => void }) {
  return (
    <div className="pt-3 first:pt-1">
      <p className="text-[10px] font-semibold t-muted uppercase tracking-wider px-3 mb-1">{label}</p>
      {items.map(({ id, label, Icon }) => (
        <button key={id} onClick={() => onSelect(id)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
            active === id ? 'text-white' : 't-secondary hover:bg-[var(--bg-hover)]'
          }`}
          style={active === id ? { background: 'var(--accent)' } : undefined}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </div>
  )
}
