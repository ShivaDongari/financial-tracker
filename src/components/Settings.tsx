import { useState, useRef } from 'react'
import { useStore } from '../store'
import { Save, User, Download, Upload, CheckCircle, AlertCircle, ScanLine, Moon, Sun } from 'lucide-react'
import { api } from '../utils/api'
import { exportData, importData } from '../utils/helpers'
import { FormField, Modal } from './Accounts'

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
    dispatch({ type: 'SET_SETTINGS', payload: { ...data.settings, ...updated } })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function toggleDarkMode() {
    const newMode = !data.settings.darkMode
    const updated = await api.updateSettings({ ...data.settings, darkMode: newMode })
    dispatch({ type: 'SET_SETTINGS', payload: { ...data.settings, ...updated, darkMode: newMode } })
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

  const isDark = !!data.settings.darkMode

  return (
    <div className="p-4 space-y-4">
      <div className="pt-2">
        <h1 className="text-xl font-extrabold t-primary">Settings</h1>
        <p className="text-xs t-muted mt-0.5">Tweak things, break nothing (hopefully)</p>
      </div>

      {/* Theme toggle */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${isDark ? 'from-indigo-500 to-purple-600' : 'from-amber-400 to-orange-500'} flex items-center justify-center text-white`}>
              {isDark ? <Moon size={14} /> : <Sun size={14} />}
            </div>
            <div>
              <p className="text-sm font-semibold t-primary">{isDark ? 'Dark Mode' : 'Light Mode'}</p>
              <p className="text-[11px] t-muted">Eye-friendly colors for any brightness</p>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`relative w-12 h-7 rounded-full transition-colors ${isDark ? 'bg-violet-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${isDark ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white">
            <User size={14} />
          </div>
          <p className="text-sm font-semibold t-primary">Profile</p>
        </div>
        <FormField label="Your Name">
          <input className="input" placeholder="e.g. Alex" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && save()} />
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
          <p className="text-sm font-semibold t-primary">OCR Scanner</p>
        </div>
        <p className="text-xs t-secondary">Powered by Tesseract.js — 100% offline, zero cloud. Your receipts never leave your device.</p>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
            <Download size={14} />
          </div>
          <p className="text-sm font-semibold t-primary">Backup & Restore</p>
        </div>
        <p className="text-xs t-secondary">Export your data as JSON to keep a backup, or import from a previous export.</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleExport} className="flex items-center justify-center gap-2 btn-secondary">
            <Download size={15} /> Export
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 btn-secondary">
            <Upload size={15} /> Import
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />

        {importStatus === 'success' && (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-3">
            <CheckCircle size={16} />
            <p className="text-xs font-medium">Data imported successfully!</p>
          </div>
        )}
        {importStatus === 'error' && (
          <div className="flex items-center gap-2 text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-xl p-3">
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

      <div className="text-center text-xs t-muted space-y-1 pb-2">
        <p>Finance Tracker v0.4.0</p>
        <p>All data stored locally in your browser. No servers, no tracking, no drama.</p>
      </div>
    </div>
  )
}
