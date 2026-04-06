'use client'
// components/marketplace/SearchBar.tsx
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search, X } from 'lucide-react'

export default function SearchBar({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter()
  const [q, setQ] = useState(defaultValue || '')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (q.trim()) {
      router.push(`/marketplace?q=${encodeURIComponent(q.trim())}`)
    } else {
      router.push('/marketplace')
    }
  }

  return (
    <form onSubmit={handleSearch} className="relative">
      <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-earth-400" />
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search listings in any language… (AI-powered)"
        className="input pl-10 pr-10"
      />
      {q && (
        <button type="button" onClick={() => { setQ(''); router.push('/marketplace') }}
          className="absolute right-3.5 top-3.5">
          <X className="w-4 h-4 text-earth-400 hover:text-earth-600" />
        </button>
      )}
    </form>
  )
}
