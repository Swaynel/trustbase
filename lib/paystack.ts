// lib/paystack.ts
import crypto from 'crypto'

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!
const BASE = 'https://api.paystack.co'

type PaystackResponse<T> = {
  status: boolean
  message: string
  data: T
}

type PaystackInitializeData = {
  authorization_url: string
  access_code: string
  reference: string
}

type PaystackVerifyData = {
  amount: number
  status: string
}

type PaystackRecipientData = {
  recipient_code: string
}

type PaystackTransferData = Record<string, unknown>
type PaystackCustomerData = Record<string, unknown>

async function paystackFetch<T>(path: string, opts: RequestInit = {}): Promise<PaystackResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })

  const raw = await res.text()
  let json: PaystackResponse<T> | null = null

  if (raw) {
    try {
      json = JSON.parse(raw) as PaystackResponse<T>
    } catch {
      json = null
    }
  }

  if (!res.ok) {
    const message =
      (json && typeof json.message === 'string' && json.message) ||
      raw ||
      `Paystack error (${res.status})`
    throw new Error(message)
  }

  if (!json) {
    throw new Error('Paystack returned an empty response')
  }

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
  return paystackFetch<PaystackInitializeData>('/transaction/initialize', {
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
  return paystackFetch<PaystackVerifyData>(`/transaction/verify/${reference}`)
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
  return paystackFetch<PaystackRecipientData>('/transferrecipient', {
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
  return paystackFetch<PaystackTransferData>('/transfer', {
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
  return paystackFetch<PaystackCustomerData>('/customer', {
    method: 'POST',
    body: JSON.stringify({ email, phone }),
  })
}
