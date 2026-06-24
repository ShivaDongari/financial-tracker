import { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react'
import { Account, Transaction, Bill, Subscription, AppSettings } from './types'
import { api } from './utils/api'
import { currentMonthKey } from './utils/helpers'

interface AppData {
  accounts: Account[]
  transactions: Transaction[]
  bills: Bill[]
  subscriptions: Subscription[]
  settings: AppSettings
  loading: boolean
  selectedMonth: string
}

const defaultData: AppData = {
  accounts: [], transactions: [], bills: [], subscriptions: [],
  settings: { currency: 'USD', name: '', darkMode: false },
  loading: true, selectedMonth: currentMonthKey(),
}

type Action =
  | { type: 'SET_ACCOUNTS'; payload: Account[] }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'SET_BILLS'; payload: Bill[] }
  | { type: 'SET_SUBSCRIPTIONS'; payload: Subscription[] }
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_MONTH'; payload: string }

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'SET_ACCOUNTS': return { ...state, accounts: action.payload }
    case 'SET_TRANSACTIONS': return { ...state, transactions: action.payload }
    case 'SET_BILLS': return { ...state, bills: action.payload }
    case 'SET_SUBSCRIPTIONS': return { ...state, subscriptions: action.payload }
    case 'SET_SETTINGS': return { ...state, settings: action.payload }
    case 'SET_LOADING': return { ...state, loading: action.payload }
    case 'SET_MONTH': return { ...state, selectedMonth: action.payload }
    default: return state
  }
}

interface StoreContextValue {
  data: AppData
  refresh: () => Promise<void>
  refreshAccounts: () => Promise<void>
  refreshTransactions: () => Promise<void>
  refreshBills: () => Promise<void>
  refreshSubscriptions: () => Promise<void>
  setMonth: (m: string) => void
  dispatch: React.Dispatch<Action>
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, defaultData)

  const refreshAccounts = useCallback(async () => {
    dispatch({ type: 'SET_ACCOUNTS', payload: await api.getAccounts() })
  }, [])
  const refreshTransactions = useCallback(async () => {
    dispatch({ type: 'SET_TRANSACTIONS', payload: await api.getTransactions() })
  }, [])
  const refreshBills = useCallback(async () => {
    dispatch({ type: 'SET_BILLS', payload: await api.getBills() })
  }, [])
  const refreshSubscriptions = useCallback(async () => {
    dispatch({ type: 'SET_SUBSCRIPTIONS', payload: await api.getSubscriptions() })
  }, [])
  const setMonth = useCallback((m: string) => {
    dispatch({ type: 'SET_MONTH', payload: m })
  }, [])

  const refresh = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const [accounts, transactions, bills, subscriptions, settings] = await Promise.all([
        api.getAccounts(), api.getTransactions(), api.getBills(), api.getSubscriptions(), api.getSettings(),
      ])
      dispatch({ type: 'SET_ACCOUNTS', payload: accounts })
      dispatch({ type: 'SET_TRANSACTIONS', payload: transactions })
      dispatch({ type: 'SET_BILLS', payload: bills })
      dispatch({ type: 'SET_SUBSCRIPTIONS', payload: subscriptions })
      dispatch({ type: 'SET_SETTINGS', payload: settings })
    } catch (e) { console.error('Failed to load:', e) }
    dispatch({ type: 'SET_LOADING', payload: false })
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { document.documentElement.classList.toggle('dark', !!data.settings.darkMode) }, [data.settings.darkMode])

  return (
    <StoreContext.Provider value={{ data, refresh, refreshAccounts, refreshTransactions, refreshBills, refreshSubscriptions, setMonth, dispatch }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
