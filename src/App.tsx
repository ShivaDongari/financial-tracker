import { useState } from 'react'
import { StoreProvider } from './store'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Accounts from './components/Accounts'
import Transactions from './components/Transactions'
import Bills from './components/Bills'
import Scanner from './components/Scanner'
import Settings from './components/Settings'

export type Tab = 'dashboard' | 'accounts' | 'transactions' | 'bills' | 'scanner' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')

  const content = {
    dashboard: <Dashboard onNavigate={setTab} />,
    accounts: <Accounts />,
    transactions: <Transactions />,
    bills: <Bills />,
    scanner: <Scanner onSaved={() => setTab('transactions')} />,
    settings: <Settings />,
  }

  return (
    <StoreProvider>
      <Layout tab={tab} onTabChange={setTab}>
        {content[tab]}
      </Layout>
    </StoreProvider>
  )
}
