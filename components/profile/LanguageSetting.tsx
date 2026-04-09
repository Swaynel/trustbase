'use client'
// components/profile/LanguageSetting.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'sw', label: 'Swahili', native: 'Kiswahili' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
]

export default function LanguageSetting({
  currentLanguage,
}: { currentLanguage: string }) {
  const router = useRouter()
  const [selected, setSelected] = useState(currentLanguage)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const hasChange = selected !== currentLanguage

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/profile/language', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: selected }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save language')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save language')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {LANGUAGES.map(l => {
          const isSelected = selected === l.code
          return (
            <button
              key={l.code}
              onClick={() => setSelected(l.code)}
              className={`group relative flex flex-col items-start p-4 rounded-2xl border transition-all duration-200 ${
                isSelected
                  ? 'bg-ink-900 border-ink-900 text-white shadow-xl shadow-ink-100 -translate-y-0.5'
                  : 'bg-white border-earth-100 hover:border-earth-300 hover:bg-earth-50/50'
              }`}
            >
              <span className={`text-sm font-display mb-0.5 ${isSelected ? 'text-white' : 'text-ink-900'}`}>
                {l.native}
              </span>
              <span className={`text-xs ${isSelected ? 'text-earth-300' : 'text-earth-400'}`}>
                {l.label}
              </span>
              {isSelected && (
                <div className="absolute top-4 right-4">
                  <div className="w-2 h-2 rounded-full bg-earth-400 animate-pulse" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 mb-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      <button
        onClick={save}
        disabled={saving || !hasChange}
        className={`w-full h-12 rounded-xl text-sm font-bold tracking-tight transition-all flex items-center justify-center gap-2 ${
          saved
            ? 'bg-forest-500 text-white'
            : hasChange
              ? 'bg-earth-600 text-white hover:bg-earth-700 shadow-lg shadow-earth-100'
              : 'bg-earth-100 text-earth-400 opacity-50 cursor-not-allowed'
        }`}
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saved ? 'Settings Updated!' : 'Update Language Preference'}
      </button>
    </div>
  )
}
