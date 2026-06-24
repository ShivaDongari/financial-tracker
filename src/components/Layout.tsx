import { ReactNode } from 'react'
import { LayoutDashboard, Wallet, ArrowLeftRight, CalendarClock, ScanLine, Settings, LucideIcon, TrendingUp } from 'lucide-react'
import { Tab } from '../App'
import { useStore } from '../store'
import { currentMonthName } from '../utils/helpers'

const navItems: { id: Tab; label: string; Icon: LucideIcon; group: string }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard, group: 'main' },
  { id: 'accounts', label: 'Accounts', Icon: Wallet, group: 'main' },
  { id: 'transactions', label: 'Transactions', Icon: ArrowLeftRight, group: 'main' },
  { id: 'bills', label: 'Bills & Payments', Icon: CalendarClock, group: 'main' },
  { id: 'scanner', label: 'Scan Receipt', Icon: ScanLine, group: 'tools' },
  { id: 'settings', label: 'Settings', Icon: Settings, group: 'system' },
]

const mobileItems: Tab[] = ['dashboard', 'accounts', 'transactions', 'bills', 'scanner', 'settings']

interface Props {
  tab: Tab
  onTabChange: (t: Tab) => void
  children: ReactNode
}

export default function Layout({ tab, onTabChange, children }: Props) {
  const { data } = useStore()
  const activeMainTab = ['detailed-assets', 'all-months-income', 'detailed-loans'].includes(tab) ? 'dashboard' : tab

  return (
    <div className="flex h-screen w-full bg-page">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-theme bg-nav shrink-0">
        <div className="p-5 border-b border-theme">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <TrendingUp size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold t-primary">Finance Tracker</h1>
              <p className="text-[10px] t-muted">{currentMonthName()}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider px-3 pt-2 pb-1">Overview</p>
          {navItems.filter(n => n.group === 'main').map(({ id, label, Icon }) => (
            <SidebarItem key={id} active={activeMainTab === id} Icon={Icon} label={label} onClick={() => onTabChange(id)} />
          ))}

          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider px-3 pt-4 pb-1">Tools</p>
          {navItems.filter(n => n.group === 'tools').map(({ id, label, Icon }) => (
            <SidebarItem key={id} active={activeMainTab === id} Icon={Icon} label={label} onClick={() => onTabChange(id)} />
          ))}

          <p className="text-[10px] font-semibold t-muted uppercase tracking-wider px-3 pt-4 pb-1">System</p>
          {navItems.filter(n => n.group === 'system').map(({ id, label, Icon }) => (
            <SidebarItem key={id} active={activeMainTab === id} Icon={Icon} label={label} onClick={() => onTabChange(id)} />
          ))}
        </nav>

        <div className="p-4 border-t border-theme">
          {data.settings.name && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {data.settings.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold t-primary">{data.settings.name}</p>
                <p className="text-[10px] t-muted">Personal</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav — visible only on mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-theme bg-nav pb-safe z-40">
        <div className="flex">
          {mobileItems.map(id => {
            const item = navItems.find(n => n.id === id)!
            const Icon = item.Icon
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                  activeMainTab === id ? 'text-violet-600' : 't-muted'
                }`}
              >
                <Icon size={20} />
                {item.label.split(' ')[0]}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function SidebarItem({ active, Icon, label, onClick }: { active: boolean; Icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active
          ? 'bg-violet-600 text-white shadow-sm'
          : 't-secondary hover:bg-[var(--bg-hover)]'
      }`}
    >
      <Icon size={18} className={active ? 'text-white' : ''} />
      {label}
    </button>
  )
}
