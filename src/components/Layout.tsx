import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Wallet, ArrowLeftRight, CalendarClock, ScanLine, Settings, RefreshCw, TrendingUp, PiggyBank, Scale, BarChart3, FileUp, Search, Target, LucideIcon } from 'lucide-react'
import { useStore } from '../store'
import MonthSelector from './MonthSelector'
import QuickAdd from './QuickAdd'
import CommandPalette from './CommandPalette'

interface NavItem { path: string; label: string; Icon: LucideIcon; group: string }

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', Icon: LayoutDashboard, group: 'main' },
  { path: '/accounts', label: 'Accounts', Icon: Wallet, group: 'main' },
  { path: '/transactions', label: 'Transactions', Icon: ArrowLeftRight, group: 'main' },
  { path: '/bills', label: 'Bills & Payments', Icon: CalendarClock, group: 'main' },
  { path: '/subscriptions', label: 'Subscriptions', Icon: RefreshCw, group: 'main' },
  { path: '/budgets', label: 'Budgets', Icon: PiggyBank, group: 'main' },
  { path: '/goals', label: 'Goals', Icon: Target, group: 'main' },
  { path: '/reports', label: 'Reports', Icon: BarChart3, group: 'main' },
  { path: '/scan', label: 'Scan Receipt', Icon: ScanLine, group: 'tools' },
  { path: '/import', label: 'Import Data', Icon: FileUp, group: 'tools' },
  { path: '/reconciliation', label: 'Reconcile', Icon: Scale, group: 'tools' },
  { path: '/settings', label: 'Settings', Icon: Settings, group: 'system' },
]

const mobileItems = ['/', '/accounts', '/transactions', '/bills', '/subscriptions', '/settings']

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const settings = useStore(s => s.settings)

  const drillPaths = ['/assets', '/income-history', '/loans', '/reconciliation', '/import']
  const activePath = drillPaths.includes(pathname) ? '/' : pathname

  function openCommandPalette() {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
  }

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

        {/* Search trigger */}
        <button onClick={openCommandPalette} className="mx-2 mt-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs t-muted hover:bg-[var(--bg-hover)] transition-colors border border-theme">
          <Search size={13} />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="text-[9px] px-1 py-0.5 rounded border border-theme">⌘K</kbd>
        </button>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <SidebarGroup label="Overview" items={navItems.filter(n => n.group === 'main')} active={activePath} onNav={navigate} />
          <SidebarGroup label="Tools" items={navItems.filter(n => n.group === 'tools')} active={activePath} onNav={navigate} />
          <SidebarGroup label="System" items={navItems.filter(n => n.group === 'system')} active={activePath} onNav={navigate} />
        </nav>

        {settings.name && (
          <div className="px-4 py-3 border-t border-theme">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: 'var(--accent)' }}>
                {settings.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-medium t-primary truncate">{settings.name}</p>
                <p className="text-[10px] t-muted">Personal</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden lg:flex items-center justify-between px-6 py-2.5 border-b border-theme bg-nav shrink-0">
          <MonthSelector />
          <div className="flex items-center gap-2">
            <button onClick={openCommandPalette} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs t-muted hover:bg-[var(--bg-hover)] border border-theme transition-colors">
              <Search size={12} /> Search <kbd className="text-[9px] px-1 rounded border border-theme ml-1">⌘K</kbd>
            </button>
            <button onClick={() => navigate('/scan')} className="btn-primary text-xs !py-1.5 !px-3">
              <ScanLine size={13} className="inline mr-1" />Scan
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-theme bg-nav pb-safe z-40">
        <div className="flex">
          {mobileItems.map(path => {
            const item = navItems.find(n => n.path === path)!
            const Icon = item.Icon
            return (
              <button key={path} onClick={() => navigate(path)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${activePath === path ? 't-accent' : 't-muted'}`}>
                <Icon size={18} />
                {item.label.split(' ')[0]}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Global overlays */}
      <QuickAdd />
      <CommandPalette />
    </div>
  )
}

function SidebarGroup({ label, items, active, onNav }: { label: string; items: NavItem[]; active: string; onNav: (path: string) => void }) {
  return (
    <div className="pt-3 first:pt-1">
      <p className="text-[10px] font-semibold t-muted uppercase tracking-wider px-3 mb-1">{label}</p>
      {items.map(({ path, label, Icon }) => (
        <button key={path} onClick={() => onNav(path)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
            active === path ? 'text-white' : 't-secondary hover:bg-[var(--bg-hover)]'
          }`}
          style={active === path ? { background: 'var(--accent)' } : undefined}>
          <Icon size={16} />
          {label}
        </button>
      ))}
    </div>
  )
}
