import { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react'
import { Account, Transaction, Bill, AppSettings } from './types'
import { api } from './utils/api'

interface AppData {
  accounts: Account[]
  transactions: Transaction[]
  bills: Bill[]
  settings: AppSettings
  loading: boolean
}

const defaultData: AppData = {
  accounts: [],
  transactions: [],
  bills: [],
  settings: { currency: 'USD', name: '' },
  loading: true,
}

type Action =
  | { type: 'SET_ACCOUNTS'; payload: Account[] }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'SET_BILLS'; payload: Bill[] }
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'SET_LOADING'; payload: boolean }

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'SET_ACCOUNTS': return { ...state, accounts: action.payload }
    case 'SET_TRANSACTIONS': return { ...state, transactions: action.payload }
    case 'SET_BILLS': return { ...state, bills: action.payload }
    case 'SET_SETTINGS': return { ...state, settings: action.payload }
    case 'SET_LOADING': return { ...state, loading: action.payload }
    default: return state
  }
}

interface StoreContextValue {
  data: AppData
  refresh: () => Promise<void>
  refreshAccounts: () => Promise<void>
  refreshTransactions: () => Promise<void>
  refreshBills: () => Promise<void>
  dispatch: React.Dispatch<Action>
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, defaultData)

  const refreshAccounts = useCallback(async () => {
    const accounts = await api.getAccounts()
    dispatch({ type: 'SET_ACCOUNTS', payload: accounts })
  }, [])

  const refreshTransactions = useCallback(async () => {
    const transactions = await api.getTransactions()
    dispatch({ type: 'SET_TRANSACTIONS', payload: transactions })
  }, [])

  const refreshBills = useCallback(async () => {
    const bills = await api.getBills()
    dispatch({ type: 'SET_BILLS', payload: bills })
  }, [])

  const refresh = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const [accounts, transactions, bills, settings] = await Promise.all([
        api.getAccounts(),
        api.getTransactions(),
        api.getBills(),
        api.getSettings(),
      ])
      dispatch({ type: 'SET_ACCOUNTS', payload: accounts })
      dispatch({ type: 'SET_TRANSACTIONS', payload: transactions })
      dispatch({ type: 'SET_BILLS', payload: bills })
      dispatch({ type: 'SET_SETTINGS', payload: settings })
    } catch (e) {
      console.error('Failed to load data:', e)
    }
    dispatch({ type: 'SET_LOADING', payload: false })
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <StoreContext.Provider value={{ data, refresh, refreshAccounts, refreshTransactions, refreshBills, dispatch }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
