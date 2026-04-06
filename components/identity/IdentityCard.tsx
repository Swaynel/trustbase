'use client'
// components/identity/IdentityCard.tsx
import { useState } from 'react'
import { Shield, CheckCircle2, Clock, MessageSquare, Loader2 } from 'lucide-react'

const LEVEL_NAMES = ['Observer', 'Participant', 'Member', 'Trusted Member', 'Community Anchor']
const LEVEL_DESC = [
  'View group summaries only',
  'Join savings groups & contribute',
  'Sell on marketplace & request loans',
  'Create groups & act as node operator',
  'Highest governance weight & accelerate others',
]

interface Pillars {
  pillar_1_done: boolean; pillar_1_score: number
  pillar_2_done: boolean; p2_days_present: number
  pillar_3_done: boolean; p3_threads: number
}

export default function IdentityCard({ member, pillars }: {
  member: { identity_level: number; reputation_score: number; display_name: string }
  pillars: Pillars | null
}) {
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const level = member.identity_level

  async function getExplanation() {
    setLoading(true)
    try {
      const res = await fetch('/api/identity/explain')
      const data = await res.json()
      setExplanation(data.explanation || 'No explanation available.')
    } catch {
      setExplanation('Could not load explanation. Please try again.')
    }
    setLoading(false)
  }

  const pillarDefs = [
    {
      name: 'Origin Web',
      done: pillars?.pillar_1_done,
      detail: pillars?.pillar_1_done ? 'Community corroborated' : `${Math.round(pillars?.pillar_1_score || 0)}% — need 3 corroborations`,
      icon: '🌐',
    },
    {
      name: 'Presence Pulse',
      done: pillars?.pillar_2_done,
      detail: pillars?.pillar_2_done ? '30 days consistent presence' : `${pillars?.p2_days_present || 0}/30 days`,
      icon: '📍',
    },
    {
      name: 'Activity Threads',
      done: pillars?.pillar_3_done,
      detail: pillars?.pillar_3_done ? '5 distinct partners' : `${pillars?.p3_threads || 0}/5 transaction partners`,
      icon: '🔗',
    },
  ]

  const pillarsComplete = [pillars?.pillar_1_done, pillars?.pillar_2_done, pillars?.pillar_3_done].filter(Boolean).length

  return (
    <div className="card border-earth-200 relative overflow-hidden">
      {/* Level strip */}
      <div className={`absolute top-0 left-0 right-0 h-1 level-${level}`} />

      <div className="flex items-start justify-between gap-4 mb-5 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-earth-500" />
            <span className="font-display text-xl text-ink-900">{LEVEL_NAMES[level]}</span>
            <span className="badge bg-earth-100 text-earth-700">Level {level}/4</span>
          </div>
          <p className="text-xs text-earth-500">{LEVEL_DESC[level]}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-earth-400">Reputation</p>
          <p className="font-display text-2xl text-ink-900">{Math.round(member.reputation_score)}</p>
        </div>
      </div>

      {/* Progress bar to next level */}
      {level < 4 && (
        <div className="mb-5">
          <div className="flex justify-between text-xs text-earth-400 mb-1">
            <span>Pillars complete</span>
            <span>{pillarsComplete}/3</span>
          </div>
          <div className="h-2 bg-earth-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-earth-500 rounded-full transition-all duration-500"
              style={{ width: `${(pillarsComplete / 3) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Three pillars */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {pillarDefs.map((p, i) => (
          <div key={i} className={`rounded-xl p-3 text-center transition-colors ${p.done ? 'bg-forest-400/10 border border-forest-400/30' : 'bg-earth-50 border border-earth-100'}`}>
            <div className="text-lg mb-1">{p.icon}</div>
            <p className="text-xs font-medium text-ink-800 leading-tight mb-1">{p.name}</p>
            <div className="flex items-center justify-center gap-1">
              {p.done
                ? <CheckCircle2 className="w-3.5 h-3.5 text-forest-500" />
                : <Clock className="w-3.5 h-3.5 text-earth-400" />
              }
              <span className="text-xs text-earth-500 leading-tight">{p.detail}</span>
            </div>
          </div>
        ))}
      </div>

      {/* AI explanation */}
      <button
        onClick={getExplanation}
        disabled={loading}
        className="btn-secondary w-full flex items-center justify-center gap-2 text-xs"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
        Explain my identity status
      </button>

      {explanation && (
        <div className="mt-3 p-3 rounded-xl bg-earth-50 border border-earth-100">
          <p className="text-xs text-earth-700 leading-relaxed">{explanation}</p>
        </div>
      )}
    </div>
  )
}
