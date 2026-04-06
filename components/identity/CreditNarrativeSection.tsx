'use client'
// components/identity/CreditNarrativeSection.tsx
import { useState } from 'react'
import { FileText, RefreshCw, Loader2, Sparkles } from 'lucide-react'

interface Props {
  memberId: string
  displayName: string
  level: number
  tenureDays: number
  savingsConsistencyPct: number
  loanRepaymentRate: number
  transactionCount: number
  language: string
  existingNarrative?: string | null
  generatedAt?: string | null
}

export default function CreditNarrativeSection(props: Props) {
  const [narrative, setNarrative] = useState(props.existingNarrative || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generateNarrative() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/cohere/credit-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: props.displayName,
          level: props.level,
          tenureDays: props.tenureDays,
          savingsConsistencyPct: props.savingsConsistencyPct,
          loanRepaymentRate: props.loanRepaymentRate,
          transactionCount: props.transactionCount,
          language: props.language,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Generation failed'); setLoading(false); return }
      setNarrative(data.narrative)
    } catch {
      setError('Could not generate narrative. Please try again.')
    }
    setLoading(false)
  }

  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>TrustBase Financial Passport — ${props.displayName}</title>
      <style>body{font-family:Georgia,serif;max-width:600px;margin:40px auto;line-height:1.7;color:#1a1208;}
      h1{font-size:24px;margin-bottom:4px;}p{font-size:14px;color:#666;margin-bottom:24px;}
      .narrative{font-size:16px;line-height:1.8;border-left:3px solid #c07030;padding-left:16px;}
      .footer{margin-top:40px;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;}</style>
      </head><body>
      <h1>TrustBase Financial Passport</h1>
      <p>${props.displayName} · Level ${props.level}/4 · Generated ${new Date().toLocaleDateString()}</p>
      <div class="narrative">${narrative}</div>
      <div class="footer">Issued by TrustBase Community Financial Network. This document reflects behavioral data, not formal financial records.</div>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-earth-500" />
          <h2 className="font-display text-lg text-ink-900">Financial Passport</h2>
        </div>
        {narrative && (
          <button onClick={handlePrint} className="btn-ghost text-xs flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Print / Save
          </button>
        )}
      </div>

      <p className="text-xs text-earth-500 mb-4">
        A one-page AI-generated narrative of your financial reliability and community standing.
        Designed to share with NGOs, employers, or future financial partners.
      </p>

      {narrative ? (
        <div>
          <div className="bg-earth-50 border-l-4 border-earth-400 rounded-r-xl p-4 mb-4">
            <p className="text-sm text-ink-800 leading-relaxed">{narrative}</p>
          </div>
          {props.generatedAt && (
            <p className="text-xs text-earth-400">Generated {new Date(props.generatedAt).toLocaleDateString()}</p>
          )}
          <button
            onClick={generateNarrative}
            disabled={loading}
            className="btn-ghost text-xs flex items-center gap-1.5 mt-2"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Regenerate
          </button>
        </div>
      ) : (
        <div>
          {error && <p className="text-red-600 text-xs mb-3">{error}</p>}
          <button
            onClick={generateNarrative}
            disabled={loading || props.tenureDays < 7}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate my financial passport
          </button>
          {props.tenureDays < 7 && (
            <p className="text-xs text-earth-400 mt-2">Available after 7 days on TrustBase.</p>
          )}
        </div>
      )}
    </div>
  )
}
