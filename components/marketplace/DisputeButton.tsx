'use client'
// components/marketplace/DisputeButton.tsx
import { useState } from 'react'
import { AlertCircle, X, Loader2, Send } from 'lucide-react'

type DisputeRecommendation = {
  summary: string
  recommendation: string
  confidence: number
}

type DisputeResponse = {
  dispute: {
    id: string
    created_at: string
    cohere_confidence: number | null
  }
  aiRecommendation: DisputeRecommendation | null
  message: string
}

export default function DisputeButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState('')
  const [result, setResult] = useState<DisputeResponse | null>(null)
  const [error, setError] = useState('')

  async function handleDispute() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/marketplace/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, description }),
      })
      const data = await res.json() as ({ error?: string } & Partial<DisputeResponse>)
      if (!res.ok) { setError(data.error || 'Failed to raise dispute'); setLoading(false); return }
      setResult(data as DisputeResponse)
    } catch {
      setError('Something went wrong.')
    }
    setLoading(false)
  }

  const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
    refund_buyer:       { label: 'Recommend: Refund buyer',    color: 'text-blue-700 bg-blue-50' },
    release_to_seller:  { label: 'Recommend: Pay seller',      color: 'text-green-700 bg-green-50' },
    partial_refund:     { label: 'Recommend: Partial refund',  color: 'text-amber-700 bg-amber-50' },
    escalate:           { label: 'Needs human review',         color: 'text-red-700 bg-red-50' },
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
      >
        <AlertCircle className="w-4 h-4" /> Raise a dispute
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl fade-in">
            <div className="flex items-center justify-between p-5 border-b border-earth-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h2 className="font-display text-xl text-ink-900">Raise a dispute</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-earth-50 rounded-lg">
                <X className="w-4 h-4 text-earth-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!result ? (
                <>
                  <p className="text-sm text-earth-600">
                    Describe what went wrong. Our AI assistant will analyse the dispute and a
                    human moderator will make the final decision.
                  </p>
                  <textarea
                    className="input resize-none h-28"
                    placeholder="e.g. Item was not as described. I received a different product."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                  {error && <p className="text-red-500 text-xs">{error}</p>}
                  <div className="flex gap-3">
                    <button onClick={() => setOpen(false)} className="btn-ghost flex-1">Cancel</button>
                    <button
                      onClick={handleDispute}
                      disabled={!description.trim() || loading}
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Submit dispute
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-earth-50">
                    <p className="text-xs font-medium text-earth-600 mb-1">AI Summary</p>
                    <p className="text-sm text-ink-800">{result.aiRecommendation?.summary || result.message || 'Dispute logged.'}</p>
                  </div>
                  {result.aiRecommendation?.recommendation && (
                    <div className={`p-3 rounded-xl text-sm font-medium ${RECOMMENDATION_LABELS[result.aiRecommendation.recommendation]?.color || 'text-earth-700 bg-earth-50'}`}>
                      {RECOMMENDATION_LABELS[result.aiRecommendation.recommendation]?.label || result.aiRecommendation.recommendation}
                      {result.aiRecommendation.confidence && (
                        <span className="ml-2 opacity-60 text-xs">({Math.round(result.aiRecommendation.confidence * 100)}% confidence)</span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-earth-400">
                    A human moderator will review this dispute and contact you within 24 hours.
                  </p>
                  <button onClick={() => setOpen(false)} className="btn-primary w-full">Done</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
