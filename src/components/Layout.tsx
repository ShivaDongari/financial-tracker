import { ReactNode } from 'react'
import { LayoutDashboard, Wallet, ArrowLeftRight, CalendarClock, ScanLine, Settings, LucideIcon } from 'lucide-react'
import { Tab } from '../App'

const tabs: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Home', Icon: LayoutDashboard },
  { id: 'accounts', label: 'Accounts', Icon: Wallet },
  { id: 'transactions', label: 'Activity', Icon: ArrowLeftRight },
  { id: 'bills', label: 'Bills', Icon: CalendarClock },
  { id: 'scanner', label: 'Scan', Icon: ScanLine },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

interface Props {
  tab: Tab
  onTabChange: (t: Tab) => void
  children: ReactNode
}

export default function Layout({ tab, onTabChange, children }: Props) {
  const activeMainTab = ['detailed-assets', 'all-months-income', 'detailed-loans'].includes(tab) ? 'dashboard' : tab

  return (
    <div className="flex flex-col h-screen w-full max-w-3xl mx-auto bg-page">
      <main className="flex-1 overflow-y-auto">{children}</main>
      <nav className="border-t border-theme bg-nav pb-safe shrink-0">
        <div className="flex">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                activeMainTab === id ? 'text-violet-600' : 't-muted'
              }`}
            >
              <Icon size={20} className={activeMainTab === id ? 'text-violet-600' : ''} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
