import Tesseract from 'tesseract.js'
import { Category, CATEGORIES } from '../types'

export interface OcrLineItem {
  description: string
  amount: number
  quantity: number
  unitPrice: number
  tax: number
  discount: number
  suggestedCategory: Category
}

export interface OcrResult {
  merchant?: string
  date?: string
  time?: string
  subtotal?: number
  tax?: number
  discount?: number
  total?: number
  lineItems: OcrLineItem[]
  suggestedCategory: Category
  rawText: string
  confidence: number
}

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  'Household': ['grocery', 'groceries', 'supermarket', 'walmart', 'target', 'costco', 'kroger', 'safeway', 'aldi', 'trader joe', 'whole foods', 'home depot', 'lowes', 'ikea', 'cleaning', 'detergent', 'kitchen', 'bathroom', 'furniture', 'rent', 'utility', 'water', 'electric', 'gas bill'],
  'Car': ['gas', 'fuel', 'shell', 'chevron', 'exxon', 'bp', 'petrol', 'auto', 'mechanic', 'tire', 'oil change', 'car wash', 'parking', 'uber', 'lyft', 'transit', 'metro'],
  'Personal': ['pharmacy', 'cvs', 'walgreens', 'health', 'doctor', 'dental', 'gym', 'fitness', 'salon', 'barber', 'haircut', 'spa', 'clothing', 'apparel', 'nike', 'adidas', 'zara', 'h&m'],
  'Entertainment': ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'pizza', 'burger', 'bar', 'pub', 'netflix', 'spotify', 'movie', 'cinema', 'theater', 'gaming', 'steam', 'playstation', 'xbox', 'hobby'],
  'Education': ['book', 'university', 'college', 'tuition', 'course', 'udemy', 'coursera', 'school', 'textbook', 'software', 'adobe', 'microsoft'],
  'Loans / Debt Service': ['loan', 'mortgage', 'payment', 'interest', 'principal', 'emi', 'installment', 'debt'],
  'Subscription': ['subscription', 'monthly plan', 'annual plan', 'membership', 'premium', 'pro plan', 'recurring'],
}

function suggestCategory(text: string): Category {
  const lower = text.toLowerCase()
  let bestCat: Category = 'Household'
  let bestScore = 0
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      if (lower.includes(kw)) score += kw.length
    }
    if (score > bestScore) {
      bestScore = score
      bestCat = cat as Category
    }
  }
  return bestCat
}

export async function scanReceipt(imageSource: File | string): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(imageSource, 'eng')
  return parseReceiptText(data.text, data.confidence)
}

export function parseReceiptText(text: string, confidence = 0): OcrResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const result: OcrResult = {
    lineItems: [],
    rawText: text,
    suggestedCategory: 'Household',
    confidence,
  }

  if (lines.length > 0) {
    const firstNonPrice = lines.find(l => !/^\$?\d/.test(l) && l.length > 2)
    if (firstNonPrice) result.merchant = firstNonPrice.replace(/[#*=\-]+/g, '').trim()
  }

  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/
  const timePattern = /(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)/
  for (const line of lines) {
    if (!result.date) {
      const dm = line.match(datePattern)
      if (dm) result.date = normalizeDate(dm[1])
    }
    if (!result.time) {
      const tm = line.match(timePattern)
      if (tm) result.time = tm[1]
    }
    if (result.date && result.time) break
  }

  const pricePattern = /\$?\s*(\d+\.\d{2})/
  const qtyPricePattern = /(\d+)\s*[xX@]\s*\$?\s*(\d+\.\d{2})/
  const totalPatterns = [/\btotal\b/i, /amount\s*due/i, /grand\s*total/i, /balance\s*due/i]
  const subtotalPatterns = [/subtotal/i, /sub-total/i, /sub total/i]
  const taxPatterns = [/\btax\b/i, /\bvat\b/i, /\bgst\b/i, /\bhst\b/i]
  const discountPatterns = [/discount/i, /savings/i, /coupon/i, /promo/i]
  const skipPatterns = [/\btip\b/i, /\bchange\b/i, /\bcash\b/i, /\bcard\b/i, /visa/i, /mastercard/i, /amex/i, /debit/i, /credit/i, /approved/i, /thank/i]

  for (const line of lines) {
    const isTotal = totalPatterns.some(p => p.test(line))
    const isSubtotal = subtotalPatterns.some(p => p.test(line))
    const isTax = taxPatterns.some(p => p.test(line))
    const isDiscount = discountPatterns.some(p => p.test(line))
    const isSkip = skipPatterns.some(p => p.test(line))
    const pm = line.match(pricePattern)

    if (isTotal && !isSubtotal && pm) {
      result.total = parseFloat(pm[1])
      continue
    }
    if (isSubtotal && pm) {
      result.subtotal = parseFloat(pm[1])
      continue
    }
    if (isTax && pm) {
      result.tax = parseFloat(pm[1])
      continue
    }
    if (isDiscount && pm) {
      result.discount = parseFloat(pm[1])
      continue
    }
    if (isSkip) continue

    if (pm) {
      const amount = parseFloat(pm[1])
      if (amount <= 0 || amount >= 100000) continue
      const desc = line.replace(pricePattern, '').replace(/[\$]/g, '').trim()
      if (!desc || desc.length < 2) continue

      const qm = line.match(qtyPricePattern)
      const qty = qm ? parseInt(qm[1]) : 1
      const unitPrice = qm ? parseFloat(qm[2]) : amount

      result.lineItems.push({
        description: desc,
        amount,
        quantity: qty,
        unitPrice,
        tax: 0,
        discount: 0,
        suggestedCategory: suggestCategory(desc),
      })
    }
  }

  if (!result.total) {
    if (result.subtotal) {
      result.total = result.subtotal + (result.tax || 0) - (result.discount || 0)
    } else if (result.lineItems.length) {
      result.total = result.lineItems.reduce((s, li) => s + li.amount, 0)
    }
  }

  const allText = [result.merchant || '', ...result.lineItems.map(li => li.description)].join(' ')
  result.suggestedCategory = suggestCategory(allText)

  return result
}

function normalizeDate(raw: string): string {
  const parts = raw.split(/[\/\-]/)
  if (parts.length !== 3) return raw
  let [a, b, c] = parts
  if (c.length === 2) c = `20${c}`
  const month = a.padStart(2, '0')
  const day = b.padStart(2, '0')
  return `${c}-${month}-${day}`
}
