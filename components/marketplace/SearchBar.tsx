'use client'
// components/marketplace/SearchBar.tsx
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search, X } from 'lucide-react'

export default function SearchBar({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter()
  const [q, setQ] = useState(defaultValue ?? '')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(q.trim() ? `/marketplace?q=${encodeURIComponent(q.trim())}` : '/marketplace')
  }

  function handleClear() {
    setQ('')
    router.push('/marketplace')
  }

  return (
   <form onSubmit={handleSearch} className="relative">
  <div className="flex items-center input px-3.5">
    <Search className="w-4 h-4 text-earth-400 mr-2" />
    <input
      type="text"
      value={q}
      onChange={e => setQ(e.target.value)}
      placeholder="Search listings in any language… (AI-powered)"
      className="flex-1 bg-transparent outline-none"
    />
    {q && (
      <button onClick={handleClear} type="button">
        <X className="w-4 h-4 text-earth-400 hover:text-earth-600" />
      </button>
    )}
  </div>
</form>
  )
}