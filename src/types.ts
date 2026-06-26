export type AccountType = 'bank' | 'cash' | 'credit_card' | 'loan' | 'income'

export interface CreditCardStatement {
  statementDate: string
  dueDate: string
  statementBalance: number
  paid: boolean
  paidAmount?: number
  paidDate?: string
}

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
  monthlyPayment?: number | null
  statements?: CreditCardStatement[]
  createdAt: string
}

export type TransactionType = 'income' | 'expense' | 'transfer' | 'refund'

export interface CategoryDef {
  name: string
  subcategories: string[]
}

export const CATEGORY_TREE: CategoryDef[] = [
  { name: 'Income', subcategories: ['Salary', 'Bonus', 'Freelance', 'Investments', 'Other Income'] },
  { name: 'Housing', subcategories: ['Rent', 'Mortgage', 'Property Tax', 'Maintenance'] },
  { name: 'Utilities', subcategories: ['Electricity', 'Gas', 'Water', 'Internet', 'Phone'] },
  { name: 'Transportation', subcategories: ['Fuel', 'Parking', 'Public Transit', 'Vehicle Maintenance', 'Insurance'] },
  { name: 'Food & Dining', subcategories: ['Groceries', 'Restaurants', 'Coffee Shops', 'Delivery'] },
  { name: 'Recurring Payments', subcategories: ['Streaming Services', 'Software', 'Cloud Storage', 'Memberships', 'Rent', 'Internet', 'Insurance', 'Gym', 'Phone Plan'] },
  { name: 'Debt Payments', subcategories: ['Credit Cards', 'Student Loans', 'Personal Loans', 'Auto Loans'] },
  { name: 'Healthcare', subcategories: ['Insurance', 'Pharmacy', 'Medical Bills', 'Dental'] },
  { name: 'Entertainment', subcategories: ['Movies', 'Events', 'Gaming', 'Hobbies'] },
  { name: 'Education', subcategories: ['Tuition', 'Textbooks', 'Courses', 'Software'] },
  { name: 'Personal', subcategories: ['Apparel', 'Grooming', 'Fitness', 'Gifts'] },
  { name: 'Other', subcategories: ['Miscellaneous'] },
]

export const CATEGORIES = CATEGORY_TREE.map(c => c.name)

export function getSubcategories(category: string): string[] {
  return CATEGORY_TREE.find(c => c.name === category)?.subcategories || []
}

export interface TransactionLineItem {
  id?: string
  description: string
  amount: number
  category: string
  subcategory?: string
  quantity: number
  unitPrice?: number
  tax?: number
  discount?: number
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  category: string
  subcategory?: string
  description: string
  accountId: string
  date: string
  merchant?: string
  notes?: string
  scanned?: boolean
  billId?: string
  refundOfId?: string
  refundedAmount?: number
  lineItems: TransactionLineItem[]
  createdAt: string
}

export type BillFrequency = 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type BillType = 'fixed' | 'variable'

export interface Bill {
  id: string
  name: string
  amount: number
  dueDate: string
  noDueDate?: boolean
  frequency: BillFrequency
  billType: BillType
  accountId?: string
  category: string
  subcategory?: string
  paid: boolean
  paidDate?: string
  paidTransactionId?: string
  subscriptionId?: string
  isRecurringPayment?: boolean
  notes?: string
  createdAt: string
}

export interface Subscription {
  id: string
  name: string
  amount: number
  frequency: 'monthly' | 'quarterly' | 'yearly'
  nextRenewal: string
  category: string
  subcategory?: string
  accountId?: string
  active: boolean
  notes?: string
  linkedBillId?: string
  createdAt: string
}

export interface Budget {
  id: string
  category: string
  monthlyLimit: number
  createdAt: string
}

export interface Reconciliation {
  id: string
  accountId: string
  date: string
  actualBalance: number
  trackedBalance: number
  difference: number
  resolved: boolean
  notes?: string
  createdAt: string
}

export interface SavingsGoal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline?: string
  accountId?: string
  notes?: string
  completed: boolean
  createdAt: string
}

export interface AppSettings {
  currency: string
  name: string
  darkMode?: boolean
  selectedMonth?: string
  customCategories?: CategoryDef[]
}

export interface DashboardData {
  totalAssets: number
  totalDebt: number
  netWorth: number
  monthlyIncome: number
  monthlyExpenses: number
  remainingBudget: number
  categoryBreakdown: Record<string, number>
  scheduledExpenses: number
  upcomingCount: number
  dueSoonCount: number
  overdueCount: number
  paidCount: number
  totalDueThisMonth: number
  totalRecurringCost: number
  totalSubscriptionsCost: number
  debtSummary: {
    totalOutstanding: number
    dueThisMonth: number
    billsDue: number
    recurringDue: number
    loanPaymentsDue: number
  }
}
