import { CATEGORY_TREE } from '../types'

export interface CsvRow {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
  merchant?: string
}

export interface CsvMapping {
  date: number
  description: number
  amount: number
  type?: number
  category?: number
}

export function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  return lines.map(line => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { cells.push(current.trim()); current = ''; continue }
      current += ch
    }
    cells.push(current.trim())
    return cells
  })
}

export function detectColumns(headers: string[]): CsvMapping {
  const lower = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const mapping: CsvMapping = { date: -1, description: -1, amount: -1 }

  for (let i = 0; i < lower.length; i++) {
    const h = lower[i]
    if (mapping.date === -1 && /date|posted|trans/.test(h)) mapping.date = i
    if (mapping.description === -1 && /desc|narr|memo|detail|particular|remark/.test(h)) mapping.description = i
    if (mapping.amount === -1 && /amount|sum|value|debit|credit|total/.test(h)) mapping.amount = i
    if (!mapping.type && /type|kind|dr|cr/.test(h)) mapping.type = i
    if (!mapping.category && /categ|class|tag/.test(h)) mapping.category = i
  }

  // Fallbacks if no header matched
  if (mapping.date === -1) mapping.date = 0
  if (mapping.description === -1) mapping.description = Math.min(1, headers.length - 1)
  if (mapping.amount === -1) mapping.amount = Math.min(2, headers.length - 1)

  return mapping
}

function parseAmount(val: string): number {
  const cleaned = val.replace(/[^0-9.\-+]/g, '')
  return parseFloat(cleaned) || 0
}

function parseDate(val: string): string {
  // Try various date formats
  const trimmed = val.trim()

  // ISO: 2026-06-24
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)

  // MM/DD/YYYY or MM-DD-YYYY
  const mdy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (mdy) {
    const y = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3]
    return `${y}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
  }

  // DD/MM/YYYY (European) — harder to detect, assume if day > 12
  const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (dmy && parseInt(dmy[1]) > 12) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }

  return trimmed
}

function guessCategory(description: string): string {
  const lower = description.toLowerCase()
  for (const cat of CATEGORY_TREE) {
    for (const sub of cat.subcategories) {
      if (lower.includes(sub.toLowerCase())) return cat.name
    }
  }
  const keywords: Record<string, string[]> = {
    'Food & Dining': ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'food', 'grocery', 'supermarket', 'walmart', 'target', 'costco'],
    'Transportation': ['gas', 'fuel', 'uber', 'lyft', 'parking', 'transit', 'shell', 'chevron'],
    'Recurring Payments': ['netflix', 'spotify', 'apple', 'google', 'amazon prime', 'disney', 'hulu', 'youtube', 'rent', 'insurance', 'gym', 'membership'],
    'Entertainment': ['movie', 'theater', 'gaming', 'steam', 'playstation'],
    'Healthcare': ['pharmacy', 'cvs', 'walgreens', 'doctor', 'hospital', 'dental', 'medical'],
    'Utilities': ['electric', 'water', 'internet', 'phone', 'comcast', 'verizon', 'att'],
    'Housing': ['rent', 'mortgage', 'property'],
    'Income': ['salary', 'payroll', 'deposit', 'direct dep', 'interest', 'dividend'],
  }
  for (const [cat, kws] of Object.entries(keywords)) {
    if (kws.some(k => lower.includes(k))) return cat
  }
  return 'Other'
}

export function mapRows(data: string[][], mapping: CsvMapping, skipHeader: boolean): CsvRow[] {
  const rows = skipHeader ? data.slice(1) : data
  const result: CsvRow[] = []
  for (const row of rows) {
    const dateVal = row[mapping.date] || ''
    const descVal = row[mapping.description] || ''
    const amountVal = row[mapping.amount] || '0'
    const amount = parseAmount(amountVal)
    if (!dateVal || amount === 0) continue

    const isIncome = amount > 0 && (!mapping.type || /credit|cr|deposit/i.test(row[mapping.type!] || ''))
    const category = mapping.category ? (row[mapping.category!] || guessCategory(descVal)) : guessCategory(descVal)

    result.push({
      date: parseDate(dateVal),
      description: descVal,
      amount: Math.abs(amount),
      type: isIncome ? 'income' : 'expense',
      category,
      merchant: descVal.split(/\s{2,}|\t/)[0] || undefined,
    })
  }
  return result
}

export function parseOfx(text: string): CsvRow[] {
  const rows: CsvRow[] = []
  const txBlocks = text.split(/<STMTTRN>/i).slice(1)

  for (const block of txBlocks) {
    const getTag = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\\n]+)`, 'i'))
      return m ? m[1].trim() : ''
    }
    const amount = parseFloat(getTag('TRNAMT')) || 0
    const dateRaw = getTag('DTPOSTED')
    const desc = getTag('NAME') || getTag('MEMO') || ''
    if (!dateRaw || amount === 0) continue

    const date = dateRaw.length >= 8
      ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
      : dateRaw

    rows.push({
      date,
      description: desc,
      amount: Math.abs(amount),
      type: amount > 0 ? 'income' : 'expense',
      category: guessCategory(desc),
    })
  }

  return rows
}
