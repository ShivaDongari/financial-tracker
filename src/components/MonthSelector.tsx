import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../store'
import { monthKeyToLabel, prevMonth, nextMonth, currentMonthKey } from '../utils/helpers'

export default function MonthSelector() {
  const selectedMonth = useStore(s => s.selectedMonth)
  const setMonth = useStore(s => s.setMonth)
  const isCurrent = selectedMonth === currentMonthKey()

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => setMonth(prevMonth(selectedMonth))} className="p-1 rounded hover:bg-[var(--bg-hover)] t-muted transition-colors">
        <ChevronLeft size={16} />
      </button>
      <button onClick={() => setMonth(currentMonthKey())}
        className={`text-xs font-medium px-2 py-1 rounded transition-colors ${isCurrent ? 'badge-accent' : 't-secondary hover:bg-[var(--bg-hover)]'}`}>
        {monthKeyToLabel(selectedMonth)}
      </button>
      <button onClick={() => setMonth(nextMonth(selectedMonth))} className="p-1 rounded hover:bg-[var(--bg-hover)] t-muted transition-colors">
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
