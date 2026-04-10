'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft, Loader2, MapPin, Wallet } from 'lucide-react'

type NewTransferFormProps = {
  memberId: string
  balance: number
}

const DESTINATION_SUGGESTIONS = [
  'Nairobi',
  'Mombasa',
  'Kampala',
  'Kigali',
  'Bujumbura',
]

export default function NewTransferForm({ memberId, balance }: NewTransferFormProps) {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [destinationCity, setDestinationCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const numericAmount = Number(amount)
  const canSubmit =
    destinationCity.trim().length > 1 &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    numericAmount <= balance

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmit) {
      setError('Enter a valid amount and destination city within your balance.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/transfer/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          amount: numericAmount,
          destinationCity: destinationCity.trim(),
        }),
      })

      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error || 'Could not create transfer request.')
        return
      }

      setSuccess(payload.message || 'Transfer request created.')
      setAmount('')
      setDestinationCity('')
      router.refresh()
    } catch {
      setError('Something went wrong while creating the transfer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-earth-600">
            <Wallet className="h-3.5 w-3.5" />
            Amount to send
          </span>
          <input
            className="input"
            inputMode="decimal"
            min="1"
            name="amount"
            placeholder="500"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-earth-600">
            <MapPin className="h-3.5 w-3.5" />
            Destination city
          </span>
          <input
            className="input"
            list="transfer-destinations"
            name="destinationCity"
            placeholder="e.g. Nairobi"
            type="text"
            value={destinationCity}
            onChange={(event) => setDestinationCity(event.target.value)}
          />
          <datalist id="transfer-destinations">
            {DESTINATION_SUGGESTIONS.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="rounded-xl border border-earth-200 bg-earth-50 px-4 py-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <div>
            <p className="text-earth-500">Available balance</p>
            <p className="font-display text-lg text-ink-100">KES {balance.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-earth-500">Sender</p>
            <p className="text-xs font-medium text-ink-200">{memberId.slice(0, 8)}</p>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-forest-600">{success}</p> : null}

      <button
        className="btn-primary flex w-full items-center justify-center gap-2"
        disabled={!canSubmit || loading}
        type="submit"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
        {loading ? 'Creating transfer...' : 'Create transfer request'}
      </button>
    </form>
  )
}
