import { useState, useRef } from 'react'
import { Upload, Check, AlertCircle, ArrowLeft, FileSpreadsheet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { parseCsv, detectColumns, mapRows, parseOfx, CsvRow, CsvMapping } from '../utils/csvImport'
import { formatCurrency } from '../utils/helpers'
import { api } from '../utils/api'
import { FormField } from './Accounts'

type Step = 'upload' | 'map' | 'review' | 'done'

export default function Import() {
  const navigate = useNavigate()
  const accounts = useStore(s => s.accounts)
  const settings = useStore(s => s.settings)
  const refreshTransactions = useStore(s => s.refreshTransactions)
  const [step, setStep] = useState<Step>('upload')
  const [rawData, setRawData] = useState<string[][]>([])
  const [mapping, setMapping] = useState<CsvMapping>({ date: 0, description: 1, amount: 2 })
  const [rows, setRows] = useState<CsvRow[]>([])
  const [accountId, setAccountId] = useState('')
  const [imported, setImported] = useState(0)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const cur = settings.currency

  function handleFile(file: File) {
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const isOfx = file.name.toLowerCase().endsWith('.ofx') || file.name.toLowerCase().endsWith('.qfx')

      if (isOfx) {
        const parsed = parseOfx(text)
        if (!parsed.length) { setError('No transactions found in OFX file.'); return }
        setRows(parsed)
        setStep('review')
        return
      }

      const parsed = parseCsv(text)
      if (parsed.length < 2) { setError('File appears empty or invalid.'); return }
      setRawData(parsed)
      const detected = detectColumns(parsed[0])
      setMapping(detected)
      setStep('map')
    }
    reader.readAsText(file)
  }

  function applyMapping() {
    const mapped = mapRows(rawData, mapping, true)
    if (!mapped.length) { setError('No valid transactions found with current column mapping.'); return }
    setRows(mapped)
    setStep('review')
  }

  function removeRow(idx: number) {
    setRows(r => r.filter((_, i) => i !== idx))
  }

  async function importAll() {
    if (!accountId) return
    let count = 0
    for (const row of rows) {
      await api.createTransaction({
        type: row.type, amount: row.amount, category: row.category,
        description: row.description, accountId, date: row.date,
        merchant: row.merchant,
      })
      count++
    }
    await refreshTransactions()
    setImported(count)
    setStep('done')
  }

  const totalIncome = rows.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)
  const totalExpense = rows.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)

  if (step === 'done') {
    return (
      <div className="p-4 lg:p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Check size={48} className="text-[var(--success)] mb-4" />
        <h2 className="text-xl font-bold t-primary mb-2">Import Complete</h2>
        <p className="text-sm t-secondary mb-6">{imported} transactions imported successfully.</p>
        <div className="flex gap-3">
          <button onClick={() => { setStep('upload'); setRows([]) }} className="btn-secondary px-6">Import More</button>
          <button onClick={() => navigate('/transactions')} className="btn-primary px-6">View Transactions</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <div className="flex items-center gap-3">
        <button onClick={() => step === 'upload' ? navigate('/transactions') : setStep('upload')} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] t-secondary">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold t-primary">Import Transactions</h1>
          <p className="text-xs t-muted">Import from CSV, OFX, or QFX bank statements</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg p-3 text-xs font-medium" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* Upload step */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="card flex flex-col items-center justify-center py-12 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet size={40} className="t-muted mb-3" />
            <p className="text-sm font-medium t-primary mb-1">Drop file or click to upload</p>
            <p className="text-xs t-muted">Supports .csv, .ofx, .qfx files</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.ofx,.qfx,.tsv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

          <div className="card">
            <p className="text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Supported formats</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg p-2.5 border border-theme">
                <p className="font-medium t-primary">CSV / TSV</p>
                <p className="t-muted mt-0.5">Most bank exports. Auto-detects columns.</p>
              </div>
              <div className="rounded-lg p-2.5 border border-theme">
                <p className="font-medium t-primary">OFX / QFX</p>
                <p className="t-muted mt-0.5">Quicken/financial standard. Auto-parsed.</p>
              </div>
              <div className="rounded-lg p-2.5 border border-theme">
                <p className="font-medium t-primary">Auto-categorize</p>
                <p className="t-muted mt-0.5">AI suggests categories based on descriptions.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Column mapping step */}
      {step === 'map' && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm font-semibold t-primary mb-3">Map Columns</p>
            <p className="text-xs t-muted mb-3">We detected {rawData.length - 1} rows. Adjust column mappings if needed.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FormField label="Date Column">
                <select className="input" value={mapping.date} onChange={e => setMapping(m => ({ ...m, date: parseInt(e.target.value) }))}>
                  {rawData[0].map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </FormField>
              <FormField label="Description Column">
                <select className="input" value={mapping.description} onChange={e => setMapping(m => ({ ...m, description: parseInt(e.target.value) }))}>
                  {rawData[0].map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </FormField>
              <FormField label="Amount Column">
                <select className="input" value={mapping.amount} onChange={e => setMapping(m => ({ ...m, amount: parseInt(e.target.value) }))}>
                  {rawData[0].map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </FormField>
            </div>
          </div>

          {/* Preview */}
          <div className="card !p-0 overflow-hidden">
            <p className="px-4 py-2.5 text-xs font-semibold t-secondary uppercase tracking-wider border-b border-theme">Preview (first 5 rows)</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>{rawData[0].map((h, i) => <th key={i} className="table-header">{h || `Col ${i + 1}`}</th>)}</tr></thead>
                <tbody>
                  {rawData.slice(1, 6).map((row, i) => (
                    <tr key={i}>{row.map((cell, j) => <td key={j} className="table-cell text-xs">{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep('upload')} className="flex-1 btn-secondary">Back</button>
            <button onClick={applyMapping} className="flex-1 btn-primary">Continue</button>
          </div>
        </div>
      )}

      {/* Review step */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="card !p-3">
              <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Transactions</p>
              <p className="text-base font-bold t-primary mt-0.5">{rows.length}</p>
            </div>
            <div className="card !p-3">
              <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Income</p>
              <p className="text-base font-bold text-[var(--success)] mt-0.5">{formatCurrency(totalIncome, cur)}</p>
            </div>
            <div className="card !p-3">
              <p className="text-[10px] font-semibold t-muted uppercase tracking-wider">Expenses</p>
              <p className="text-base font-bold text-[var(--danger)] mt-0.5">{formatCurrency(totalExpense, cur)}</p>
            </div>
          </div>

          <FormField label="Import into account">
            <select className="input" value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">Select account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, cur)})</option>)}
            </select>
          </FormField>

          <div className="card !p-0 overflow-hidden">
            <div className="overflow-x-auto" style={{ maxHeight: '400px' }}>
              <table className="w-full">
                <thead className="sticky top-0" style={{ background: 'var(--bg-card)' }}>
                  <tr>
                    <th className="table-header">Date</th>
                    <th className="table-header">Description</th>
                    <th className="table-header">Category</th>
                    <th className="table-header">Type</th>
                    <th className="table-header text-right">Amount</th>
                    <th className="table-header w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-[var(--bg-hover)]">
                      <td className="table-cell text-xs t-muted whitespace-nowrap">{r.date}</td>
                      <td className="table-cell text-xs font-medium t-primary truncate max-w-[200px]">{r.description}</td>
                      <td className="table-cell"><span className="badge badge-accent">{r.category}</span></td>
                      <td className="table-cell"><span className={`badge ${r.type === 'income' ? 'badge-success' : 'badge-danger'}`}>{r.type}</span></td>
                      <td className={`table-cell text-right text-xs font-semibold ${r.type === 'income' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount, cur)}
                      </td>
                      <td className="table-cell"><button onClick={() => removeRow(i)} className="text-[10px] t-muted hover:text-[var(--danger)]">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep('upload')} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={importAll} disabled={!accountId || !rows.length} className="flex-1 btn-primary disabled:opacity-50">
              Import {rows.length} Transactions
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
