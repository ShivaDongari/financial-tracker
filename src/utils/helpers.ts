export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
}

// Use local date parsing to avoid timezone bugs (YYYY-MM-DD → local date)
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return ''
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthKeyToLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function todayFormatted(): string {
  const d = new Date()
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function daysUntil(dateStr: string): number {
  if (!dateStr) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = parseLocalDate(dateStr)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export function getMonthStartEnd(monthKey: string): { start: string; end: string } {
  const [y, m] = monthKey.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export function getNextOccurrence(dateStr: string, frequency: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  switch (frequency) {
    case 'weekly': date.setDate(date.getDate() + 7); break
    case 'monthly': date.setMonth(date.getMonth() + 1); break
    case 'quarterly': date.setMonth(date.getMonth() + 3); break
    case 'yearly': date.setFullYear(date.getFullYear() + 1); break
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getWeekRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const start = new Date(now)
  start.setDate(now.getDate() - day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: fmt(start), end: fmt(end) }
}

export function prevMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function nextMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getFunInsight(weeklySpend: number, monthlySpend: number, topCategory: string, dailyAvg: number, currency: string): string[] {
  const insights: string[] = []
  if (dailyAvg > 0) insights.push(`Averaging ${formatCurrency(dailyAvg, currency)}/day this month.`)
  if (topCategory) {
    const quips: Record<string, string> = {
      'Household': 'Household leads your spending this month.',
      'Car': 'Automotive costs are your top expense.',
      'Personal': 'Personal spending tops the chart.',
      'Entertainment': 'Entertainment is your biggest category.',
      'Education': 'Education is your top investment.',
      'Loans / Debt Service': 'Debt payments lead your outflows.',
      'Subscription': 'Subscriptions are your top recurring cost.',
    }
    insights.push(quips[topCategory] || `${topCategory} is your top category.`)
  }
  return insights
}

export async function compressImage(file: File, maxPx = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1])
    }
    img.onerror = reject
    img.src = url
  })
}

export function exportData(): string {
  return localStorage.getItem('finance_tracker_v2') || '{}'
}

export function importData(json: string): boolean {
  try {
    const parsed = JSON.parse(json)
    if (parsed.accounts && parsed.transactions && parsed.bills && parsed.settings) {
      localStorage.setItem('finance_tracker_v2', json)
      return true
    }
    return false
  } catch { return false }
}

export function getMonthlyBreakdown(transactions: { type: string; amount: number; date: string }[], type: 'income' | 'expense'): { month: string; monthKey: string; total: number }[] {
  const map: Record<string, number> = {}
  for (const t of transactions.filter(t => t.type === type)) {
    const key = t.date.slice(0, 7)
    map[key] = (map[key] || 0) + t.amount
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, total]) => ({ month: monthKeyToLabel(key), monthKey: key, total }))
}
