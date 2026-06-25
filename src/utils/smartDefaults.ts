import { db } from '../db'

interface SmartSuggestion {
  category: string
  subcategory?: string
  accountId?: string
  type: 'income' | 'expense'
}

export async function getSuggestions(description: string): Promise<SmartSuggestion | null> {
  if (!description || description.length < 2) return null

  const lower = description.toLowerCase()
  const allTx = await db.transactions.orderBy('createdAt').reverse().limit(500).toArray()

  // Find past transactions with similar descriptions
  const matches = allTx.filter(t => {
    const desc = (t.description + ' ' + (t.merchant || '')).toLowerCase()
    return desc.includes(lower) || lower.includes(desc.split(' ')[0])
  })

  if (!matches.length) return null

  // Most common category for this description
  const catCounts: Record<string, number> = {}
  const acctCounts: Record<string, number> = {}
  let mostCommonType: 'income' | 'expense' = 'expense'
  let typeCount = { income: 0, expense: 0 }

  for (const tx of matches) {
    catCounts[tx.category] = (catCounts[tx.category] || 0) + 1
    acctCounts[tx.accountId] = (acctCounts[tx.accountId] || 0) + 1
    if (tx.type === 'income' || tx.type === 'expense') typeCount[tx.type]++
  }

  mostCommonType = typeCount.income > typeCount.expense ? 'income' : 'expense'
  const topCategory = Object.entries(catCounts).sort(([, a], [, b]) => b - a)[0]?.[0]
  const topAccount = Object.entries(acctCounts).sort(([, a], [, b]) => b - a)[0]?.[0]
  const topSubcategory = matches.find(m => m.subcategory)?.subcategory

  if (!topCategory) return null

  return {
    category: topCategory,
    subcategory: topSubcategory,
    accountId: topAccount,
    type: mostCommonType,
  }
}

export async function getFrequentMerchants(limit = 10): Promise<string[]> {
  const allTx = await db.transactions.orderBy('createdAt').reverse().limit(200).toArray()
  const counts: Record<string, number> = {}
  for (const tx of allTx) {
    const name = tx.merchant || tx.description
    if (name) counts[name] = (counts[name] || 0) + 1
  }
  return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, limit).map(([name]) => name)
}
