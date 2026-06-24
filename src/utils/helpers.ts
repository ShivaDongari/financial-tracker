export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function currentMonthName(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function todayFormatted(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

export function getWeekRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const start = new Date(now)
  start.setDate(now.getDate() - day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
}

export function getMonthRange(): { start: string; end: string } {
  const now = new Date()
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const end = next.toISOString().split('T')[0]
  return { start, end }
}

export function getSpendingEmoji(amount: number, budget: number): string {
  if (budget <= 0) return ''
  const ratio = amount / budget
  if (ratio < 0.3) return '🟢'
  if (ratio < 0.6) return '🫡'
  if (ratio < 0.85) return '😬'
  if (ratio < 1) return '🔥'
  return '💀'
}

export function getFunInsight(weeklySpend: number, monthlySpend: number, topCategory: string, dailyAvg: number, currency: string): string[] {
  const insights: string[] = []
  if (dailyAvg > 0) {
    insights.push(`You're spending ${formatCurrency(dailyAvg, currency)}/day this month — that's ${formatCurrency(dailyAvg * 365, currency)}/year.`)
  }
  if (topCategory) {
    const quips: Record<string, string> = {
      'Household': 'Adulting is expensive. Your house agrees.',
      'Car': 'Your car is eating well this month.',
      'Personal': 'Self-care isn\'t cheap, but you\'re worth it.',
      'Entertainment': 'Living your best life, one subscription at a time.',
      'Education': 'Investing in your brain. Smart move.',
      'Loans / Debt Service': 'Paying off debt like a boss.',
      'Subscription': 'The subscriptions are multiplying...',
    }
    insights.push(quips[topCategory] || `${topCategory} is your top spend.`)
  }
  if (weeklySpend === 0) {
    insights.push('Zero spent this week? Either you\'re a monk or forgot to log.')
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
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve(dataUrl.split(',')[1])
    }
    img.onerror = reject
    img.src = url
  })
}

export function exportData(): string {
  const raw = localStorage.getItem('finance_tracker_v2')
  return raw || '{}'
}

export function importData(json: string): boolean {
  try {
    const parsed = JSON.parse(json)
    if (parsed.accounts && parsed.transactions && parsed.bills && parsed.settings) {
      localStorage.setItem('finance_tracker_v2', json)
      return true
    }
    return false
  } catch {
    return false
  }
}

export function getMonthlyBreakdown(transactions: { type: string; amount: number; date: string }[], type: 'income' | 'expense'): { month: string; total: number }[] {
  const map: Record<string, number> = {}
  for (const t of transactions.filter(t => t.type === type)) {
    const key = t.date.slice(0, 7)
    map[key] = (map[key] || 0) + t.amount
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, total]) => {
      const d = new Date(month + '-01')
      return { month: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), total }
    })
}
