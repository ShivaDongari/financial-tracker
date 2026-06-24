import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Accounts from './components/Accounts'
import Transactions from './components/Transactions'
import Bills from './components/Bills'
import Scanner from './components/Scanner'
import Settings from './components/Settings'
import Subscriptions from './components/Subscriptions'
import Budgets from './components/Budgets'
import Reconciliation from './components/Reconciliation'
import DetailedAssets from './components/DetailedAssets'
import AllMonthsIncome from './components/AllMonthsIncome'
import DetailedLoans from './components/DetailedLoans'

export default function App() {
  const refresh = useStore(s => s.refresh)
  useEffect(() => { refresh() }, [refresh])

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/reconciliation" element={<Reconciliation />} />
        <Route path="/scan" element={<Scanner />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/assets" element={<DetailedAssets />} />
        <Route path="/income-history" element={<AllMonthsIncome />} />
        <Route path="/loans" element={<DetailedLoans />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
