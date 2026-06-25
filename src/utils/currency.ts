const RATES_KEY = 'fintracker_fx_rates'
const RATES_TTL = 4 * 60 * 60 * 1000 // 4 hours

// Fallback rates (approximate, used when offline)
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.5, CAD: 1.36, AUD: 1.53, JPY: 157.5, SGD: 1.34, AED: 3.67,
  CHF: 0.88, CNY: 7.24, KRW: 1380, MXN: 17.2, BRL: 4.95, ZAR: 18.5, NZD: 1.64, SEK: 10.8, NOK: 10.6,
}

interface CachedRates {
  base: string
  rates: Record<string, number>
  timestamp: number
}

function getCached(): CachedRates | null {
  try {
    const raw = localStorage.getItem(RATES_KEY)
    if (!raw) return null
    const cached: CachedRates = JSON.parse(raw)
    if (Date.now() - cached.timestamp < RATES_TTL) return cached
  } catch {}
  return null
}

export async function fetchRates(base = 'USD'): Promise<Record<string, number>> {
  const cached = getCached()
  if (cached && cached.base === base) return cached.rates

  try {
    const res = await fetch(`https://api.exchangerate.host/latest?base=${base}`)
    if (res.ok) {
      const data = await res.json()
      if (data.rates) {
        const cacheEntry: CachedRates = { base, rates: data.rates, timestamp: Date.now() }
        localStorage.setItem(RATES_KEY, JSON.stringify(cacheEntry))
        return data.rates
      }
    }
  } catch {}

  // Fallback to hardcoded rates
  if (base === 'USD') return FALLBACK_RATES
  const baseRate = FALLBACK_RATES[base] || 1
  const converted: Record<string, number> = {}
  for (const [cur, rate] of Object.entries(FALLBACK_RATES)) {
    converted[cur] = rate / baseRate
  }
  return converted
}

export function convertAmount(amount: number, fromCurrency: string, toCurrency: string, rates: Record<string, number>): number {
  if (fromCurrency === toCurrency) return amount
  const fromRate = rates[fromCurrency] || 1
  const toRate = rates[toCurrency] || 1
  return amount * (toRate / fromRate)
}

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
]
