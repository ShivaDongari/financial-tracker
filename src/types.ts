export type AccountType = 'bank' | 'cash' | 'credit_card' | 'loan' | 'income'

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
  currency: string
  notes?: string
  interestRate?: number | null
  maturityDate?: string | null
  originalAmount?: number | null
  creditLimit?: number | null
  statementDueDay?: number | null
  createdAt: string
}

export type TransactionType = 'income' | 'expense' | 'transfer'

export const CATEGORIES = [
  'Household',
  'Car',
  'Personal',
  'Entertainment',
  'Education',
  'Loans / Debt Service',
  'Subscription',
] as const

export type Category = typeof CATEGORIES[number]

export interface TransactionLineItem {
  id?: string
  description: string
  amount: number
  category: Category
  quantity: number
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  category: Category
  description: string
  accountId: string
  date: string
  merchant?: string
  notes?: string
  scanned?: boolean
  lineItems: TransactionLineItem[]
  createdAt: string
}

export type BillFrequency = 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface Bill {
  id: string
  name: string
  amount: number
  dueDate: string
  noDueDate?: boolean
  frequency: BillFrequency
  accountId?: string
  category: Category
  paid: boolean
  notes?: string
  createdAt: string
}

export interface AppSettings {
  currency: string
  name: string
  darkMode?: boolean
}

export interface DashboardData {
  totalAssets: number
  totalDebt: number
  netWorth: number
  monthlyIncome: number
  monthlyExpenses: number
  remainingBudget: number
  categoryBreakdown: Record<string, number>
}
