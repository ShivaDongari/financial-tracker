import { useState } from 'react'
import { StoreProvider } from './store'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Accounts from './components/Accounts'
import Transactions from './components/Transactions'
import Bills from './components/Bills'
import Scanner from './components/Scanner'
import Settings from './components/Settings'
import Subscriptions from './components/Subscriptions'
import DetailedAssets from './components/DetailedAssets'
import AllMonthsIncome from './components/AllMonthsIncome'
import DetailedLoans from './components/DetailedLoans'

export type Tab = 'dashboard' | 'accounts' | 'transactions' | 'bills' | 'scanner' | 'settings' | 'subscriptions' | 'detailed-assets' | 'all-months-income' | 'detailed-loans'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')

  const content: Record<Tab, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={setTab} />,
    accounts: <Accounts />,
    transactions: <Transactions />,
    bills: <Bills />,
    subscriptions: <Subscriptions />,
    scanner: <Scanner onSaved={() => setTab('transactions')} />,
    settings: <Settings />,
    'detailed-assets': <DetailedAssets onBack={() => setTab('dashboard')} />,
    'all-months-income': <AllMonthsIncome onBack={() => setTab('dashboard')} />,
    'detailed-loans': <DetailedLoans onBack={() => setTab('dashboard')} />,
  }

  return (
    <StoreProvider>
      <Layout tab={tab} onTabChange={setTab}>
        {content[tab]}
      </Layout>
    </StoreProvider>
  )
}
