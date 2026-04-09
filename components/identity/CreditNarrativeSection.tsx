'use client'
// components/identity/CreditNarrativeSection.tsx
import { useState } from 'react'
import { FileText, RefreshCw, Loader2, Sparkles, Printer, Lock } from 'lucide-react'

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

  const tooNew = props.tenureDays < 7
  const daysLeft = 7 - props.tenureDays

  async function generateNarrative() {
    setLoading(true)
    setError('')
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
      if (!res.ok) {
        setError(data.error || 'Generation failed')
        setLoading(false)
        return
      }
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
      <div class="footer">Issued by TrustBase Community Financial Network. This document reflects behavioural data, not formal financial records.</div>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div className="rounded-[28px] border border-earth-100 bg-white p-6 sm:p-8 shadow-[0_20px_60px_rgba(28,24,19,0.06)] overflow-hidden relative">
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-earth-50 rounded-full blur-3xl opacity-50" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-earth-600 flex items-center justify-center shadow-lg shadow-earth-200">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-display text-xl text-ink-900 leading-tight">Financial Passport</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-earth-500 bg-earth-50 px-1.5 py-0.5 rounded border border-earth-100">
                <Sparkles className="w-2.5 h-2.5" /> AI Engine
              </span>
              <span className="text-xs text-earth-400">Shareable Document</span>
            </div>
          </div>
        </div>

        {narrative && (
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-earth-700 bg-white border border-earth-200 px-4 py-2 rounded-xl hover:bg-earth-50 hover:border-earth-300 transition-all shadow-sm active:scale-95"
          >
            <Printer className="w-4 h-4" />
            Print Passport
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 mb-4 relative">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {narrative ? (
        <div className="space-y-4">
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-earth-200 to-sand-200 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative bg-white border border-earth-100 rounded-2xl p-6 shadow-sm">
              <div className="absolute left-0 top-6 bottom-6 w-1 bg-earth-500 rounded-r-full" />
              <p className="text-base text-ink-800 leading-relaxed font-serif pl-2 italic">
                &ldquo;{narrative}&rdquo;
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {props.generatedAt && (
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-earth-400 tracking-tighter">Issue Date</span>
                  <span className="text-xs font-medium text-ink-700">{new Date(props.generatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}
            <button
              onClick={generateNarrative}
              disabled={loading}
              className="flex items-center gap-2 text-xs font-semibold text-earth-500 hover:text-ink-900 transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              Update Narrative
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          {tooNew ? (
            <div className="rounded-2xl bg-earth-50/50 border border-earth-100 p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-white border border-earth-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Lock className="w-5 h-5 text-earth-300" />
              </div>
              <h4 className="text-ink-900 font-medium mb-1">Building your record...</h4>
              <p className="text-sm text-earth-500 max-w-[240px] mx-auto">
                The passport unlocks in <span className="text-ink-900 font-bold">{daysLeft} days</span>. Keep transacting to build your profile.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border-2 border-dashed border-earth-200 p-8 text-center bg-earth-50/30">
                <Sparkles className="w-8 h-8 text-earth-300 mx-auto mb-3" />
                <p className="text-sm text-earth-600 max-w-[280px] mx-auto mb-0">
                  Ready to generate a summary of your <span className="text-ink-900 font-bold">{props.transactionCount} transactions</span> and community standing.
                </p>
              </div>
              <button
                onClick={generateNarrative}
                disabled={loading}
                className="w-full h-14 bg-ink-900 text-white rounded-2xl font-display text-lg flex items-center justify-center gap-3 hover:bg-ink-800 transition-all shadow-xl shadow-ink-100 active:scale-[0.98] disabled:opacity-50"
              >
                {loading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <Sparkles className="w-5 h-5" />}
                Generate Financial Passport
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
