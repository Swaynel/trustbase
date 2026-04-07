'use client'
// components/profile/LanguageSetting.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Swahili' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
]

export default function LanguageSetting({
  currentLanguage,
}: { currentLanguage: string }) {
  const router = useRouter()
  const [selected, setSelected] = useState(currentLanguage)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

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
      if (!res.ok) {
        throw new Error(data.error || 'Could not save language')
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save language')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-earth-600 mb-2">Preferred language</label>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {LANGUAGES.map(l => (
          <button
            key={l.code}
            onClick={() => setSelected(l.code)}
            className={`py-2 rounded-xl text-sm font-medium transition-colors border
              ${selected === l.code
                ? 'bg-earth-500 text-white border-earth-500'
                : 'bg-earth-50 text-earth-700 border-earth-100 hover:border-earth-300'
              }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving || selected === currentLanguage}
        className="btn-primary text-sm flex items-center gap-2"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
         saved  ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
        {saved ? 'Saved!' : 'Save language'}
      </button>
      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
    </div>
  )
}
