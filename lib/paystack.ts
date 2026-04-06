// lib/paystack.ts
import crypto from 'crypto'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!
const BASE = 'https://api.paystack.co'

async function paystackFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || 'Paystack error')
  return json
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(body)
    .digest('hex')
  return hash === signature
}

export async function initializeCharge({
  email,
  amount,        // in kobo (KES cents)
  phone,
  metadata,
  callbackUrl,
}: {
  email: string
  amount: number
  phone?: string
  metadata?: Record<string, unknown>
  callbackUrl?: string
}) {
  return paystackFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount,
      currency: 'KES',
      mobile_money: phone ? { phone, provider: 'mpesa' } : undefined,
      metadata,
      callback_url: callbackUrl,
    }),
  })
}

export async function verifyTransaction(reference: string) {
  return paystackFetch(`/transaction/verify/${reference}`)
}

export async function createRecipient({
  name,
  phone,
  bankCode = '999992', // MPesa Kenya
}: {
  name: string
  phone: string
  bankCode?: string
}) {
  return paystackFetch('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({
      type: 'mobile_money',
      name,
      account_number: phone,
      bank_code: bankCode,
      currency: 'KES',
    }),
  })
}

export async function initiateTransfer({
  amount,
  recipientCode,
  reason,
  reference,
}: {
  amount: number
  recipientCode: string
  reason: string
  reference?: string
}) {
  return paystackFetch('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: 'balance',
      amount,
      recipient: recipientCode,
      reason,
      reference: reference || `tb_${Date.now()}`,
      currency: 'KES',
    }),
  })
}

export async function createOrGetCustomer(email: string, phone: string) {
  return paystackFetch('/customer', {
    method: 'POST',
    body: JSON.stringify({ email, phone }),
  })
}
