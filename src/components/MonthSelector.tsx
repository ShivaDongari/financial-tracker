import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../store'
import { monthKeyToLabel, prevMonth, nextMonth, currentMonthKey } from '../utils/helpers'

export default function MonthSelector() {
  const { data, setMonth } = useStore()
  const mk = data.selectedMonth
  const isCurrent = mk === currentMonthKey()

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => setMonth(prevMonth(mk))} className="p-1 rounded hover:bg-[var(--bg-hover)] t-muted transition-colors">
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={() => setMonth(currentMonthKey())}
        className={`text-xs font-medium px-2 py-1 rounded transition-colors ${isCurrent ? 'badge-accent' : 't-secondary hover:bg-[var(--bg-hover)]'}`}
      >
        {monthKeyToLabel(mk)}
      </button>
      <button onClick={() => setMonth(nextMonth(mk))} className="p-1 rounded hover:bg-[var(--bg-hover)] t-muted transition-colors">
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
