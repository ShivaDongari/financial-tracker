import { ReactNode } from 'react'
import { LayoutDashboard, Wallet, ArrowLeftRight, CalendarClock, ScanLine, Settings, LucideIcon } from 'lucide-react'
import { Tab } from '../App'

const tabs: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Home', Icon: LayoutDashboard },
  { id: 'accounts', label: 'Accounts', Icon: Wallet },
  { id: 'transactions', label: 'Transactions', Icon: ArrowLeftRight },
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
  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-white shadow-sm">
      <main className="flex-1 overflow-y-auto">{children}</main>
      <nav className="border-t border-gray-100 bg-white pb-safe">
        <div className="flex">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                tab === id ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <Icon size={20} className={tab === id ? 'text-blue-600' : 'text-gray-400'} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
