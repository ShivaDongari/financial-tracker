import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { CATEGORY_TREE, getSubcategories } from '../types'

interface Props {
  category: string
  subcategory?: string
  onCategoryChange: (cat: string) => void
  onSubcategoryChange?: (sub: string) => void
  showSubcategory?: boolean
}

export default function CategoryPicker({ category, subcategory, onCategoryChange, onSubcategoryChange, showSubcategory = true }: Props) {
  const [catOpen, setCatOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const [catSearch, setCatSearch] = useState('')
  const [subSearch, setSubSearch] = useState('')
  const catRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false)
      if (subRef.current && !subRef.current.contains(e.target as Node)) setSubOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredCats = CATEGORY_TREE.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()))
  const subs = getSubcategories(category)
  const filteredSubs = subs.filter(s => s.toLowerCase().includes(subSearch.toLowerCase()))

  return (
    <div className="flex gap-2">
      {/* Category */}
      <div className="relative flex-1" ref={catRef}>
        <button type="button" onClick={() => { setCatOpen(!catOpen); setSubOpen(false) }}
          className="input flex items-center justify-between text-left !py-2 text-xs">
          <span className="truncate">{category || 'Select category'}</span>
          <ChevronDown size={14} className="t-muted shrink-0" />
        </button>
        {catOpen && (
          <div className="absolute z-50 top-full mt-1 w-full rounded-lg shadow-lg border border-theme overflow-hidden" style={{ background: 'var(--bg-card)' }}>
            <div className="p-2 border-b border-theme">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 t-muted" />
                <input className="w-full text-xs rounded pl-7 pr-2 py-1.5 focus:outline-none" style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  placeholder="Search categories..." value={catSearch} onChange={e => setCatSearch(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredCats.map(c => (
                <button key={c.name} type="button" onClick={() => { onCategoryChange(c.name); setCatOpen(false); setCatSearch('') }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] transition-colors ${c.name === category ? 'font-semibold t-accent' : 't-primary'}`}>
                  {c.name}
                  <span className="t-muted ml-1">({c.subcategories.length})</span>
                </button>
              ))}
              {filteredCats.length === 0 && <p className="px-3 py-2 text-xs t-muted">No categories found</p>}
            </div>
          </div>
        )}
      </div>

      {/* Subcategory */}
      {showSubcategory && subs.length > 0 && (
        <div className="relative flex-1" ref={subRef}>
          <button type="button" onClick={() => { setSubOpen(!subOpen); setCatOpen(false) }}
            className="input flex items-center justify-between text-left !py-2 text-xs">
            <span className="truncate">{subcategory || 'Subcategory'}</span>
            <ChevronDown size={14} className="t-muted shrink-0" />
          </button>
          {subOpen && (
            <div className="absolute z-50 top-full mt-1 w-full rounded-lg shadow-lg border border-theme overflow-hidden" style={{ background: 'var(--bg-card)' }}>
              <div className="p-2 border-b border-theme">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 t-muted" />
                  <input className="w-full text-xs rounded pl-7 pr-2 py-1.5 focus:outline-none" style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                    placeholder="Search..." value={subSearch} onChange={e => setSubSearch(e.target.value)} autoFocus />
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto">
                <button type="button" onClick={() => { onSubcategoryChange?.(''); setSubOpen(false); setSubSearch('') }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] t-muted`}>None</button>
                {filteredSubs.map(s => (
                  <button key={s} type="button" onClick={() => { onSubcategoryChange?.(s); setSubOpen(false); setSubSearch('') }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] transition-colors ${s === subcategory ? 'font-semibold t-accent' : 't-primary'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
