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

      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (cancelled) return
      if (memberError) {
        setError(memberError.message)
        return
      }

      if (member) {
        router.replace('/dashboard')
        return
      }

      setPhone(user.phone ?? '')
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
      const { error } = await supabase.auth.signInWithOtp({ phone })
      if (error) throw error
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
      const { data, error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })
      if (error) throw error

      // Check if member profile exists
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('id')
        .eq('auth_id', data.user!.id)
        .maybeSingle()

      if (memberError) throw memberError

      if (!member) {
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          name,
          language: lang,
          country,
        }),
      })

      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Could not create profile')

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
