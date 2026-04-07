// app/(auth)/login/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Step = 'phone' | 'otp' | 'profile'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
]

function normalizePhoneNumber(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''

  const compact = trimmed.replace(/[\s()-]/g, '')
  const digits = compact.replace(/\D/g, '')

  if (compact.startsWith('+')) return `+${compact.slice(1).replace(/\D/g, '')}`
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  if (digits.startsWith('254') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`
  if (digits.startsWith('7') && digits.length === 9) return `+254${digits}`
  if (digits.length >= 8) return `+${digits}`

  return digits
}

function isValidE164Phone(phone: string) {
  return /^\+[1-9]\d{7,14}$/.test(phone)
}

async function parseJsonResponse(res: Response) {
  const text = await res.text()

  if (!text) return {}

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Server returned an unexpected ${res.headers.get('content-type') || 'response'} (${res.status}). Check the dev server log for the route error.`)
  }
}

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [lang, setLang] = useState('en')
  const [country, setCountry] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function hydrateSession() {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user || cancelled) return

      if (cancelled) return
      const res = await fetch('/api/auth/member-status', { cache: 'no-store' })
      const payload = await parseJsonResponse(res)

      if (!res.ok) {
        setError(String(payload.error || 'Could not load your profile state'))
        return
      }

      if (payload.hasMemberProfile) {
        router.replace('/dashboard')
        return
      }

      setPhone(normalizePhoneNumber(user.phone ?? ''))
      setStep('profile')
    }

    void hydrateSession()

    return () => {
      cancelled = true
    }
  }, [router])

  async function handleSendOTP() {
    setLoading(true); setError('')
    try {
      const normalizedPhone = normalizePhoneNumber(phone)
      if (!isValidE164Phone(normalizedPhone)) {
        throw new Error('Enter a valid phone number, for example +254711929567.')
      }

      const { error } = await supabase.auth.signInWithOtp({ phone: normalizedPhone })
      if (error) throw error
      setPhone(normalizedPhone)
      setStep('otp')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOTP() {
    setLoading(true); setError('')
    try {
      const normalizedPhone = normalizePhoneNumber(phone)
      if (!isValidE164Phone(normalizedPhone)) {
        throw new Error('Enter a valid phone number before verifying.')
      }

      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otp.trim(),
        type: 'sms',
      })
      if (error) throw error
      setPhone(normalizedPhone)

      const statusRes = await fetch('/api/auth/member-status', { cache: 'no-store' })
      const statusPayload = await parseJsonResponse(statusRes)
      if (!statusRes.ok) {
        throw new Error(String(statusPayload.error || 'Could not load your profile state'))
      }

      if (!statusPayload.hasMemberProfile) {
        setStep('profile')
      } else {
        router.push('/dashboard')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateProfile() {
    setLoading(true); setError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const user = session?.user ?? null
      if (!user) throw new Error('Not authenticated')

      const headers = new Headers({ 'Content-Type': 'application/json' })
      if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`)
      }

      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: normalizePhoneNumber(phone),
          name,
          language: lang,
          country,
        }),
      })

      const payload = await parseJsonResponse(res)
      if (!res.ok) throw new Error(String(payload.error || 'Could not create profile'))

      router.push('/dashboard')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand-50 px-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-30 bg-grain pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10 animate-fade-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-earth-600 mb-4 shadow-lg">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="10" r="5" fill="white" opacity="0.9"/>
              <circle cx="8" cy="22" r="4" fill="white" opacity="0.7"/>
              <circle cx="24" cy="22" r="4" fill="white" opacity="0.7"/>
              <line x1="16" y1="15" x2="8" y2="18" stroke="white" strokeWidth="1.5" opacity="0.5"/>
              <line x1="16" y1="15" x2="24" y2="18" stroke="white" strokeWidth="1.5" opacity="0.5"/>
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold text-ink-900">TrustBase</h1>
          <p className="text-earth-600 text-sm mt-1">Community Financial Network</p>
        </div>

        <div className="card p-8 animate-fade-up-delay-1">
          {step === 'phone' && (
            <>
              <h2 className="font-display text-xl font-semibold text-ink-900 mb-1">Welcome</h2>
              <p className="text-earth-600 text-sm mb-6">Enter your phone number to get started</p>
              <label className="block text-sm font-medium text-ink-800 mb-1.5">Phone number</label>
              <input
                className="input mb-4"
                type="tel"
                placeholder="+254 7XX XXX XXX"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
              />
              {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
              <button className="btn-primary w-full" onClick={handleSendOTP} disabled={loading || !phone}>
                {loading ? 'Sending…' : 'Send verification code'}
              </button>
            </>
          )}

          {step === 'otp' && (
            <>
              <h2 className="font-display text-xl font-semibold text-ink-900 mb-1">Verify</h2>
              <p className="text-earth-600 text-sm mb-6">Enter the 6-digit code sent to {phone}</p>
              <label className="block text-sm font-medium text-ink-800 mb-1.5">Verification code</label>
              <input
                className="input mb-4 text-center text-2xl font-mono tracking-widest"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
              />
              {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
              <button className="btn-primary w-full mb-3" onClick={handleVerifyOTP} disabled={loading || otp.length < 6}>
                {loading ? 'Verifying…' : 'Verify'}
              </button>
              <button className="btn-ghost w-full text-sm" onClick={() => setStep('phone')}>← Change number</button>
            </>
          )}

          {step === 'profile' && (
            <>
              <h2 className="font-display text-xl font-semibold text-ink-900 mb-1">Create profile</h2>
              <p className="text-earth-600 text-sm mb-6">Tell us a bit about yourself</p>

              <label className="block text-sm font-medium text-ink-800 mb-1.5">Your name</label>
              <input className="input mb-4" type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />

              <label className="block text-sm font-medium text-ink-800 mb-1.5">Preferred language</label>
              <select className="input mb-4" value={lang} onChange={e => setLang(e.target.value)}>
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>

              <label className="block text-sm font-medium text-ink-800 mb-1.5">Country of origin</label>
              <input className="input mb-6" type="text" placeholder="e.g. Democratic Republic of Congo" value={country} onChange={e => setCountry(e.target.value)} />

              {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
              <button className="btn-primary w-full" onClick={handleCreateProfile} disabled={loading || !name}>
                {loading ? 'Creating profile…' : 'Join TrustBase'}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-earth-500 mt-6 animate-fade-up-delay-2">
          Your community vouches for you. Your history funds you.
        </p>
      </div>
    </div>
  )
}
