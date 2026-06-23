import { useState, useRef } from 'react'
import { ScanLine, Upload, Camera, Loader2, CheckCircle, AlertCircle, Edit3, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { Category, CATEGORIES, TransactionType, TransactionLineItem } from '../types'
import { todayISO } from '../utils/helpers'
import { scanReceipt } from '../utils/ocr'
import { api } from '../utils/api'
import { FormField, Modal } from './Accounts'

interface Props {
  onSaved: () => void
}

type Step = 'upload' | 'scanning' | 'review' | 'done'

export default function Scanner({ onSaved }: Props) {
  const { data, refreshTransactions } = useStore()
  const [step, setStep] = useState<Step>('upload')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    type: 'expense' as TransactionType,
    amount: '',
    description: '',
    category: 'Household' as Category,
    date: todayISO(),
    merchant: '',
    accountId: '',
    notes: '',
  })
  const [lineItems, setLineItems] = useState<TransactionLineItem[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError('')
    setStep('scanning')
    try {
      const result = await scanReceipt(file)
      setForm(f => ({
        ...f,
        amount: result.total ? String(result.total) : '',
        description: result.lineItems.map(li => li.description).join(', ').slice(0, 80) || 'Scanned receipt',
        merchant: result.merchant || '',
        date: result.date || todayISO(),
        accountId: data.accounts[0]?.id || '',
      }))
      setLineItems(
        result.lineItems.map(li => ({
          description: li.description,
          amount: li.amount,
          category: 'Household' as Category,
          quantity: 1,
        }))
      )
      setStep('review')
    } catch (e: any) {
      setError(e?.message || 'Failed to scan document. Please try again.')
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
      type: form.type,
      amount: totalAmount,
      category: form.category,
      description: form.description.trim(),
      accountId: form.accountId,
      date: form.date,
      merchant: form.merchant.trim(),
      notes: form.notes.trim(),
      scanned: true,
      lineItems: validLineItems.map(li => ({
        description: li.description,
        amount: li.amount,
        category: li.category,
        quantity: li.quantity,
      })),
    })
    await refreshTransactions()
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <CheckCircle size={56} className="text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Transaction Saved!</h2>
        <p className="text-sm text-gray-500 mb-6">Your scanned receipt has been added with {lineItems.length} line item(s).</p>
        <div className="flex gap-3">
          <button onClick={() => { setStep('upload'); setLineItems([]) }} className="btn-secondary px-6">Scan Another</button>
          <button onClick={onSaved} className="btn-primary px-6">View Transactions</button>
        </div>
      </div>
    )
  }

  if (step === 'scanning') {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
          <Loader2 size={32} className="text-blue-600 animate-spin" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Scanning Document</h2>
        <p className="text-sm text-gray-400">Tesseract.js is extracting the details...</p>
      </div>
    )
  }

  if (step === 'review') {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 pt-2">
          <Edit3 size={20} className="text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Review & Split</h1>
        </div>

        {form.merchant && (
          <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
            <span className="font-semibold">Extracted from:</span> {form.merchant}
          </div>
        )}

        <div className="flex gap-2">
          {(['expense', 'income', 'transfer'] as TransactionType[]).map(t => (
            <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize border ${form.type === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500'}`}>{t}</button>
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
        <FormField label="Overall Category">
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

        {/* Line items section */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Line Items (Multi-Category Split)</h3>
            <button onClick={addLineItem} className="flex items-center gap-1 text-xs text-blue-600 font-medium">
              <Plus size={14} /> Add Item
            </button>
          </div>

          {lineItems.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">No line items. Add items to split across categories.</p>
          )}

          {lineItems.map((li, i) => (
            <div key={i} className="bg-white rounded-lg p-2.5 space-y-2 border border-gray-100">
              <div className="flex items-center gap-2">
                <input className="input flex-1 !py-1.5 text-xs" placeholder="Item description" value={li.description}
                  onChange={e => updateLineItem(i, { description: e.target.value })} />
                <button onClick={() => removeLineItem(i)} className="text-gray-400 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex gap-2">
                <input className="input !py-1.5 text-xs w-24" type="number" step="0.01" placeholder="$0.00" value={li.amount || ''}
                  onChange={e => updateLineItem(i, { amount: parseFloat(e.target.value) || 0 })} />
                <select className="input !py-1.5 text-xs flex-1" value={li.category}
                  onChange={e => updateLineItem(i, { category: e.target.value as Category })}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <input className="input !py-1.5 text-xs w-14" type="number" min="1" placeholder="Qty" value={li.quantity}
                  onChange={e => updateLineItem(i, { quantity: parseInt(e.target.value) || 1 })} />
              </div>
            </div>
          ))}

          {lineItems.length > 0 && (
            <p className="text-xs text-gray-500 text-right">
              Items total: ${lineItems.reduce((s, li) => s + li.amount * li.quantity, 0).toFixed(2)}
            </p>
          )}
        </div>

        <FormField label="Notes">
          <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </FormField>

        <div className="flex gap-2 pb-4">
          <button onClick={() => setStep('upload')} className="flex-1 btn-secondary">Rescan</button>
          <button onClick={saveTransaction} disabled={!form.accountId} className="flex-1 btn-primary disabled:opacity-50">Save Transaction</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">
      <div className="pt-2">
        <h1 className="text-xl font-bold text-gray-900">Scan Receipt or Bill</h1>
        <p className="text-sm text-gray-500 mt-1">Upload or take a photo — OCR extracts items automatically (free, offline)</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-3 bg-blue-600 text-white rounded-2xl p-6">
          <Camera size={32} />
          <span className="text-sm font-semibold">Take Photo</span>
        </button>
        <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-3 bg-gray-100 text-gray-700 rounded-2xl p-6">
          <Upload size={32} />
          <span className="text-sm font-semibold">Upload File</span>
        </button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5"><ScanLine size={14} /> Powered by Tesseract.js (offline OCR)</p>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>· Store receipts & invoices</li>
          <li>· Utility & service bills</li>
          <li>· Automatically splits line items</li>
          <li>· Assign different categories per item</li>
        </ul>
      </div>
    </div>
  )
}
