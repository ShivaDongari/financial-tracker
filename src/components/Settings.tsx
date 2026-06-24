import { useState, useRef } from 'react'
import { useStore } from '../store'
import { Save, User, Download, Upload, CheckCircle, AlertCircle, ScanLine, Moon, Sun } from 'lucide-react'
import { api } from '../utils/api'
import { exportData, importData } from '../utils/helpers'
import { FormField } from './Accounts'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'SGD', 'AED']

export default function Settings() {
  const { data, dispatch, refresh } = useStore()
  const [saved, setSaved] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ name: data.settings.name, currency: data.settings.currency })

  async function save() {
    const updated = await api.updateSettings(form)
    dispatch({ type: 'SET_SETTINGS', payload: { ...data.settings, ...updated } })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  async function toggleDark() {
    const dm = !data.settings.darkMode
    const updated = await api.updateSettings({ darkMode: dm })
    dispatch({ type: 'SET_SETTINGS', payload: { ...data.settings, ...updated, darkMode: dm } })
  }

  function handleExport() {
    const json = exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `fintracker-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  function handleImport(file: File) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      if (importData(e.target?.result as string)) {
        setImportStatus('success'); await refresh()
        setForm({ name: data.settings.name, currency: data.settings.currency })
        setTimeout(() => setImportStatus('idle'), 3000)
      } else { setImportStatus('error'); setTimeout(() => setImportStatus('idle'), 3000) }
    }
    reader.readAsText(file)
  }

  const isDark = !!data.settings.darkMode

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6 max-w-2xl">
      <h1 className="text-xl font-bold t-primary">Settings</h1>

      {/* Theme */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: isDark ? 'var(--accent)' : 'var(--warning)' }}>
            {isDark ? <Moon size={14} /> : <Sun size={14} />}
          </div>
          <div>
            <p className="text-sm font-medium t-primary">{isDark ? 'Dark Mode' : 'Light Mode'}</p>
            <p className="text-[11px] t-muted">Eye-friendly colors, saved automatically</p>
          </div>
        </div>
        <button onClick={toggleDark} className={`relative w-10 h-6 rounded-full transition-colors ${isDark ? '' : ''}`}
          style={{ background: isDark ? 'var(--accent)' : 'var(--border)' }}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isDark ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Profile */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <User size={15} className="t-accent" />
          <p className="text-sm font-medium t-primary">Profile</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Name">
            <input className="input" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && save()} />
          </FormField>
          <FormField label="Currency">
            <select className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
          </FormField>
        </div>
      </div>

      {/* Scanner */}
      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <ScanLine size={15} className="t-accent" />
          <p className="text-sm font-medium t-primary">OCR Scanner</p>
        </div>
        <p className="text-xs t-secondary">Powered by Tesseract.js — 100% offline, no data leaves your device.</p>
      </div>

      {/* Backup */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Download size={15} className="t-accent" />
          <p className="text-sm font-medium t-primary">Backup & Restore</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleExport} className="btn-secondary flex items-center justify-center gap-1.5"><Download size={14} /> Export</button>
          <button onClick={() => fileRef.current?.click()} className="btn-secondary flex items-center justify-center gap-1.5"><Upload size={14} /> Import</button>
        </div>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
        {importStatus === 'success' && <div className="flex items-center gap-2 text-[var(--success)] rounded-lg p-2 text-xs font-medium" style={{ background: 'var(--success-light)' }}><CheckCircle size={14} />Data imported successfully.</div>}
        {importStatus === 'error' && <div className="flex items-center gap-2 text-[var(--danger)] rounded-lg p-2 text-xs font-medium" style={{ background: 'var(--danger-light)' }}><AlertCircle size={14} />Invalid file format.</div>}
      </div>

      <button onClick={save} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors text-white ${saved ? '' : ''}`}
        style={{ background: saved ? 'var(--success)' : 'var(--accent)' }}>
        <Save size={14} />{saved ? 'Saved!' : 'Save Settings'}
      </button>

      <p className="text-center text-[11px] t-muted">FinTracker v1.0 · All data stored locally in your browser.</p>
    </div>
  )
}
