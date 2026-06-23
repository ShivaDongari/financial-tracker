import Tesseract from 'tesseract.js'

export interface OcrResult {
  merchant?: string
  date?: string
  total?: number
  lineItems: { description: string; amount: number }[]
  rawText: string
}

export async function scanReceipt(imageSource: File | string): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(imageSource, 'eng')
  const text = data.text
  return parseReceiptText(text)
}

export function parseReceiptText(text: string): OcrResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const result: OcrResult = { lineItems: [], rawText: text }

  if (lines.length > 0) {
    const firstNonPrice = lines.find(l => !/^\$?\d/.test(l))
    if (firstNonPrice) result.merchant = firstNonPrice
  }

  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/
  for (const line of lines) {
    const dm = line.match(datePattern)
    if (dm) {
      result.date = normalizeDate(dm[1])
      break
    }
  }

  const pricePattern = /\$?\s*(\d+\.\d{2})/
  const totalPatterns = [/total/i, /amount\s*due/i, /grand\s*total/i, /balance\s*due/i]
  const skipPatterns = [/subtotal/i, /sub-total/i, /tax/i, /tip/i, /change/i, /cash/i, /card/i, /visa/i, /mastercard/i]

  for (const line of lines) {
    const isTotal = totalPatterns.some(p => p.test(line))
    const isSkip = skipPatterns.some(p => p.test(line))
    const priceMatch = line.match(pricePattern)

    if (isTotal && priceMatch) {
      result.total = parseFloat(priceMatch[1])
      continue
    }

    if (isSkip) continue

    if (priceMatch) {
      const amount = parseFloat(priceMatch[1])
      const desc = line.replace(pricePattern, '').replace(/[\$]/g, '').trim()
      if (desc && amount > 0 && amount < 100000) {
        result.lineItems.push({ description: desc, amount })
      }
    }
  }

  if (!result.total && result.lineItems.length) {
    result.total = result.lineItems.reduce((s, li) => s + li.amount, 0)
  }

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
