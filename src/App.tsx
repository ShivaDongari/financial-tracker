import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'

// Lazy-load heavy pages
const Accounts = lazy(() => import('./components/Accounts'))
const Transactions = lazy(() => import('./components/Transactions'))
const Bills = lazy(() => import('./components/Bills'))
const Subscriptions = lazy(() => import('./components/Subscriptions'))
const Budgets = lazy(() => import('./components/Budgets'))
const Goals = lazy(() => import('./components/Goals'))
const Reports = lazy(() => import('./components/Reports'))
const Scanner = lazy(() => import('./components/Scanner'))
const Import = lazy(() => import('./components/Import'))
const Reconciliation = lazy(() => import('./components/Reconciliation'))
const Settings = lazy(() => import('./components/Settings'))
const DetailedAssets = lazy(() => import('./components/DetailedAssets'))
const AllMonthsIncome = lazy(() => import('./components/AllMonthsIncome'))
const DetailedLoans = lazy(() => import('./components/DetailedLoans'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  )
}

export default function App() {
  const refresh = useStore(s => s.refresh)
  useEffect(() => { refresh() }, [refresh])

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/import" element={<Import />} />
          <Route path="/scan" element={<Scanner />} />
          <Route path="/reconciliation" element={<Reconciliation />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/assets" element={<DetailedAssets />} />
          <Route path="/income-history" element={<AllMonthsIncome />} />
          <Route path="/loans" element={<DetailedLoans />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
