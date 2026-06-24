import { create } from 'zustand'
import { Account, Transaction, Bill, Subscription, Budget, Reconciliation } from './types'
import { api } from './utils/api'
import { currentMonthKey } from './utils/helpers'

interface AppSettings {
  currency: string
  name: string
  darkMode: boolean
  selectedMonth: string
}

interface Store {
  accounts: Account[]
  transactions: Transaction[]
  bills: Bill[]
  subscriptions: Subscription[]
  budgets: Budget[]
  reconciliations: Reconciliation[]
  settings: AppSettings
  loading: boolean
  selectedMonth: string

  refresh: () => Promise<void>
  refreshAccounts: () => Promise<void>
  refreshTransactions: () => Promise<void>
  refreshBills: () => Promise<void>
  refreshSubscriptions: () => Promise<void>
  refreshBudgets: () => Promise<void>
  refreshReconciliations: () => Promise<void>
  setMonth: (m: string) => void
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
}

export const useStore = create<Store>((set) => ({
  accounts: [], transactions: [], bills: [], subscriptions: [], budgets: [], reconciliations: [],
  settings: { currency: 'USD', name: '', darkMode: false, selectedMonth: currentMonthKey() },
  loading: true, selectedMonth: currentMonthKey(),

  refresh: async () => {
    set({ loading: true })
    try {
      const [accounts, transactions, bills, subscriptions, budgets, reconciliations, settings] = await Promise.all([
        api.getAccounts(), api.getTransactions(), api.getBills(), api.getSubscriptions(),
        api.getBudgets(), api.getReconciliations(), api.getSettings(),
      ])
      set({ accounts, transactions, bills, subscriptions, budgets, reconciliations, settings,
        selectedMonth: settings.selectedMonth || currentMonthKey(), loading: false })
      document.documentElement.classList.toggle('dark', settings.darkMode)
      // Process recurring bills on load
      api.processRecurringBills().catch(console.error)
    } catch (e) { console.error('Failed to load:', e); set({ loading: false }) }
  },

  refreshAccounts: async () => set({ accounts: await api.getAccounts() }),
  refreshTransactions: async () => set({ transactions: await api.getTransactions() }),
  refreshBills: async () => set({ bills: await api.getBills() }),
  refreshSubscriptions: async () => set({ subscriptions: await api.getSubscriptions() }),
  refreshBudgets: async () => set({ budgets: await api.getBudgets() }),
  refreshReconciliations: async () => set({ reconciliations: await api.getReconciliations() }),

  setMonth: (m: string) => set({ selectedMonth: m }),

  updateSettings: async (updates: Partial<AppSettings>) => {
    const merged = await api.updateSettings(updates)
    set({ settings: merged })
    document.documentElement.classList.toggle('dark', merged.darkMode)
  },
}))
