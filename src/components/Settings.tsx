import { useState, useRef } from 'react'
import { useStore } from '../store'
import { Save, User, Download, Upload, CheckCircle, AlertCircle, ScanLine } from 'lucide-react'
import { api } from '../utils/api'
import { exportData, importData } from '../utils/helpers'
import { FormField } from './Accounts'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'SGD', 'AED']

export default function Settings() {
  const { data, dispatch, refresh } = useStore()
  const [saved, setSaved] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)
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

  function handleExport() {
    const json = exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance-tracker-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(file: File) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      if (importData(text)) {
        setImportStatus('success')
        await refresh()
        setForm({ name: data.settings.name, currency: data.settings.currency })
        setTimeout(() => setImportStatus('idle'), 3000)
      } else {
        setImportStatus('error')
        setTimeout(() => setImportStatus('idle'), 3000)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="pt-2">
        <h1 className="text-xl font-extrabold text-slate-900">Settings</h1>
        <p className="text-xs text-slate-400 mt-0.5">Tweak things, break nothing (hopefully)</p>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white">
            <User size={14} />
          </div>
          <p className="text-sm font-semibold text-slate-700">Profile</p>
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

      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
            <ScanLine size={14} />
          </div>
          <p className="text-sm font-semibold text-slate-700">OCR Scanner</p>
        </div>
        <p className="text-xs text-slate-500">Powered by Tesseract.js — 100% offline, zero cloud. Your receipts never leave your device.</p>
      </div>

      {/* Export / Import */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
            <Download size={14} />
          </div>
          <p className="text-sm font-semibold text-slate-700">Backup & Restore</p>
        </div>
        <p className="text-xs text-slate-500">Export your data as JSON to keep a backup, or import from a previous export.</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleExport} className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 rounded-2xl py-3 text-sm font-semibold hover:bg-slate-200 transition-colors">
            <Download size={15} /> Export
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 rounded-2xl py-3 text-sm font-semibold hover:bg-slate-200 transition-colors">
            <Upload size={15} /> Import
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />

        {importStatus === 'success' && (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-xl p-3">
            <CheckCircle size={16} />
            <p className="text-xs font-medium">Data imported successfully! Page will refresh.</p>
          </div>
        )}
        {importStatus === 'error' && (
          <div className="flex items-center gap-2 text-rose-600 bg-rose-50 rounded-xl p-3">
            <AlertCircle size={16} />
            <p className="text-xs font-medium">Invalid file. Make sure it's a valid export.</p>
          </div>
        )}
      </div>

      <button onClick={save}
        className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all shadow-sm ${saved ? 'bg-emerald-500 text-white' : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700'}`}>
        <Save size={16} />
        {saved ? 'Saved!' : 'Save Settings'}
      </button>

      <div className="text-center text-xs text-slate-400 space-y-1 pb-2">
        <p>Finance Tracker v0.3.0</p>
        <p>All data stored locally in your browser. No servers, no tracking, no drama.</p>
      </div>
    </div>
  )
}
