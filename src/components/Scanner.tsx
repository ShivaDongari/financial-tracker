import { useState, useRef } from 'react'
import { ScanLine, Upload, Camera, Loader2, CheckCircle, AlertCircle, Edit3, Plus, Trash2, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { Category, CATEGORIES, TransactionType, TransactionLineItem } from '../types'
import { todayISO, formatCurrency } from '../utils/helpers'
import { scanReceipt, OcrResult } from '../utils/ocr'
import { api } from '../utils/api'
import { FormField, Modal } from './Accounts'

interface Props { onSaved: () => void }
type Step = 'upload' | 'scanning' | 'review' | 'done'

export default function Scanner({ onSaved }: Props) {
  const { data, refreshTransactions } = useStore()
  const [step, setStep] = useState<Step>('upload')
  const [error, setError] = useState('')
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [form, setForm] = useState({
    type: 'expense' as TransactionType, amount: '', description: '',
    category: 'Household' as Category, date: todayISO(), merchant: '',
    accountId: '', notes: '',
  })
  const [lineItems, setLineItems] = useState<TransactionLineItem[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const cur = data.settings.currency

  async function handleFile(file: File) {
    setError('')
    setStep('scanning')
    try {
      const result = await scanReceipt(file)
      setOcrResult(result)
      setForm(f => ({
        ...f,
        amount: result.total ? String(result.total) : '',
        description: result.lineItems.map(li => li.description).join(', ').slice(0, 80) || 'Scanned receipt',
        merchant: result.merchant || '',
        date: result.date || todayISO(),
        category: result.suggestedCategory,
        accountId: data.accounts[0]?.id || '',
        notes: [
          result.tax ? `Tax: $${result.tax.toFixed(2)}` : '',
          result.discount ? `Discount: -$${result.discount.toFixed(2)}` : '',
          result.time ? `Time: ${result.time}` : '',
        ].filter(Boolean).join(' · '),
      }))
      setLineItems(result.lineItems.map(li => ({
        description: li.description,
        amount: li.amount,
        category: li.suggestedCategory,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        tax: li.tax,
        discount: li.discount,
      })))
      setStep('review')
    } catch (e: any) {
      setError(e?.message || 'Failed to scan. Try again.')
      setStep('upload')
    }
  }

  function addLineItem() {
    setLineItems(items => [...items, { description: '', amount: 0, category: 'Household', quantity: 1 }])
  }

  function updateLineItem(index: number, updates: Partial<TransactionLineItem>) {
    setLineItems(items => items.map((li, i) => i === index ? { ...li, ...updates } : li))
  }

  function removeLineItem(index: number) {
    setLineItems(items => items.filter((_, i) => i !== index))
  }

  async function saveTransaction() {
    const validLineItems = lineItems.filter(li => li.description && li.amount > 0)
    const totalAmount = validLineItems.length
      ? validLineItems.reduce((s, li) => s + li.amount * li.quantity, 0)
      : parseFloat(form.amount) || 0

    await api.createTransaction({
      type: form.type, amount: totalAmount, category: form.category,
      description: form.description.trim(), accountId: form.accountId,
      date: form.date, merchant: form.merchant.trim(), notes: form.notes.trim(),
      scanned: true,
      lineItems: validLineItems.map(li => ({
        description: li.description, amount: li.amount, category: li.category,
        quantity: li.quantity, unitPrice: li.unitPrice, tax: li.tax, discount: li.discount,
      })),
    })
    await refreshTransactions()
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-extrabold t-primary mb-2">Saved!</h2>
        <p className="text-sm t-secondary mb-6">{lineItems.length} item(s) logged with AI-suggested categories.</p>
        <div className="flex gap-3">
          <button onClick={() => { setStep('upload'); setLineItems([]); setOcrResult(null) }} className="btn-secondary px-6">Scan Another</button>
          <button onClick={onSaved} className="btn-primary px-6">View Activity</button>
        </div>
      </div>
    )
  }

  if (step === 'scanning') {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center mb-4">
          <Loader2 size={32} className="text-violet-600 animate-spin" />
        </div>
        <h2 className="text-lg font-bold t-primary mb-1">Analyzing Receipt...</h2>
        <p className="text-sm t-muted">AI is extracting items, prices & categories</p>
      </div>
    )
  }

  if (step === 'review') {
    return (
      <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
        <div className="flex items-center gap-2 pt-2 lg:pt-0">
          <Edit3 size={20} className="text-violet-600" />
          <h1 className="text-xl font-extrabold t-primary">Review & Confirm</h1>
        </div>

        {/* AI extraction summary */}
        {ocrResult && (
          <div className="card" style={{ background: 'rgba(139,92,246,.06)', borderColor: 'rgba(139,92,246,.15)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-violet-500" />
              <span className="text-xs font-semibold text-violet-600">AI Extraction Summary</span>
              {ocrResult.confidence > 0 && <span className="text-[10px] t-muted">({ocrResult.confidence.toFixed(0)}% confidence)</span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {ocrResult.merchant && <div><span className="t-muted">Merchant:</span> <span className="t-primary font-medium">{ocrResult.merchant}</span></div>}
              {ocrResult.date && <div><span className="t-muted">Date:</span> <span className="t-primary font-medium">{ocrResult.date}</span></div>}
              {ocrResult.subtotal != null && <div><span className="t-muted">Subtotal:</span> <span className="t-primary font-medium">{formatCurrency(ocrResult.subtotal, cur)}</span></div>}
              {ocrResult.tax != null && <div><span className="t-muted">Tax:</span> <span className="t-primary font-medium">{formatCurrency(ocrResult.tax, cur)}</span></div>}
              {ocrResult.discount != null && <div><span className="t-muted">Discount:</span> <span className="text-emerald-600 font-medium">-{formatCurrency(ocrResult.discount, cur)}</span></div>}
              {ocrResult.total != null && <div><span className="t-muted">Total:</span> <span className="t-primary font-bold">{formatCurrency(ocrResult.total, cur)}</span></div>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['expense', 'income', 'transfer'] as TransactionType[]).map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold capitalize border transition-colors ${form.type === t ? 'bg-violet-600 text-white border-violet-600' : 'border-theme t-secondary'}`}>{t}</button>
              ))}
            </div>
            <FormField label="Total Amount">
              <input className="input" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </FormField>
            <FormField label="Description">
              <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </FormField>
            <FormField label="Merchant">
              <input className="input" value={form.merchant} onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} />
            </FormField>
            <FormField label="Suggested Category">
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Date">
              <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
            <FormField label="Account">
              <select className="input" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
                <option value="">Select account</option>
                {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FormField>
            <FormField label="Notes">
              <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </FormField>
          </div>

          {/* Line items */}
          <div className="card space-y-3" style={{ background: 'var(--bg-hover)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold t-primary">Line Items ({lineItems.length})</h3>
              <button onClick={addLineItem} className="flex items-center gap-1 text-xs text-violet-600 font-semibold">
                <Plus size={14} /> Add
              </button>
            </div>

            {lineItems.length === 0 && <p className="text-xs t-muted text-center py-4">No items extracted. Add manually or save as single transaction.</p>}

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {lineItems.map((li, i) => (
                <div key={i} className="card !p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <input className="input flex-1 !py-2 text-xs" placeholder="Item" value={li.description}
                      onChange={e => updateLineItem(i, { description: e.target.value })} />
                    <button onClick={() => removeLineItem(i)} className="t-muted hover:text-rose-500"><Trash2 size={14} /></button>
                  </div>
                  <div className="flex gap-2">
                    <input className="input !py-2 text-xs w-20" type="number" step="0.01" placeholder="$" value={li.amount || ''}
                      onChange={e => updateLineItem(i, { amount: parseFloat(e.target.value) || 0 })} />
                    <select className="input !py-2 text-xs flex-1" value={li.category}
                      onChange={e => updateLineItem(i, { category: e.target.value as Category })}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input className="input !py-2 text-xs w-14" type="number" min="1" placeholder="Qty" value={li.quantity}
                      onChange={e => updateLineItem(i, { quantity: parseInt(e.target.value) || 1 })} />
                  </div>
                </div>
              ))}
            </div>

            {lineItems.length > 0 && (
              <div className="flex justify-between text-xs font-medium pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="t-muted">{lineItems.length} items</span>
                <span className="t-primary">Total: {formatCurrency(lineItems.reduce((s, li) => s + li.amount * li.quantity, 0), cur)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pb-4">
          <button onClick={() => setStep('upload')} className="flex-1 btn-secondary">Rescan</button>
          <button onClick={saveTransaction} disabled={!form.accountId} className="flex-1 btn-primary disabled:opacity-50">Save Transaction</button>
        </div>
      </div>
    )
  }

  // Upload step
  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 lg:pb-6">
      <div className="pt-2 lg:pt-0">
        <h1 className="text-xl font-extrabold t-primary">AI Receipt Scanner</h1>
        <p className="text-sm t-secondary mt-1">Upload a receipt and AI will extract items, prices & categories automatically.</p>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex gap-3">
          <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <button onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-3 bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-2xl p-6 shadow-sm">
          <Camera size={32} />
          <span className="text-sm font-semibold">Take Photo</span>
        </button>
        <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-3 card rounded-2xl p-6 t-primary">
          <Upload size={32} />
          <span className="text-sm font-semibold">Upload File</span>
        </button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

      <div className="card max-w-lg" style={{ background: 'rgba(139,92,246,.06)', borderColor: 'rgba(139,92,246,.15)' }}>
        <p className="text-xs font-semibold text-violet-600 mb-2 flex items-center gap-1.5"><Sparkles size={14} /> AI-Powered Extraction</p>
        <ul className="text-xs text-violet-500 space-y-1.5">
          <li>· Identifies merchant/store name & purchase date</li>
          <li>· Extracts line items with quantities, unit prices & totals</li>
          <li>· Captures tax, discounts, subtotals & grand total</li>
          <li>· Auto-suggests expense categories per item</li>
          <li>· Review & modify everything before saving</li>
        </ul>
        <p className="text-[10px] text-violet-400 mt-2">Powered by Tesseract.js — 100% offline, no data leaves your device.</p>
      </div>
    </div>
  )
}
