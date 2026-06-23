import { useState } from 'react'
import { useStore } from '../store'
import { Save, DollarSign, User } from 'lucide-react'
import { api } from '../utils/api'
import { FormField } from './Accounts'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'SGD', 'AED']

export default function Settings() {
  const { data, dispatch } = useStore()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    name: data.settings.name,
    currency: data.settings.currency,
  })

  async function save() {
    const updated = await api.updateSettings(form)
    dispatch({ type: 'SET_SETTINGS', payload: updated })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-4 space-y-5">
      <div className="pt-2">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User size={16} className="text-gray-400" />
          <p className="text-sm font-semibold text-gray-700">Profile</p>
        </div>
        <FormField label="Your Name">
          <input className="input" placeholder="e.g. Alex" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Currency">
          <select className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </FormField>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">OCR Scanner</p>
        <p className="text-xs text-gray-500">Receipt scanning is powered by Tesseract.js — runs entirely in your browser, no API key needed, no data sent to the cloud.</p>
      </div>

      <button onClick={save}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors ${saved ? 'bg-green-500 text-white' : 'btn-primary'}`}>
        <Save size={16} />
        {saved ? 'Saved!' : 'Save Settings'}
      </button>

      <div className="text-center text-xs text-gray-400 space-y-1">
        <p>Finance Tracker v0.2.0</p>
        <p>All data stored locally in your browser.</p>
      </div>
    </div>
  )
}
