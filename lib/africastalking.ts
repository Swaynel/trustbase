// lib/africastalking.ts
const AT_KEY = process.env.AFRICASTALKING_API_KEY!
const AT_USER = process.env.AFRICASTALKING_USERNAME!
const AT_SENDER = process.env.AFRICASTALKING_SENDER_ID || 'TrustBase'
const BASE = 'https://api.africastalking.com/version1'
const SANDBOX_BASE = 'https://api.sandbox.africastalking.com/version1'

const isSandbox = process.env.NODE_ENV !== 'production'
const apiBase = isSandbox ? SANDBOX_BASE : BASE

async function atFetch(path: string, body: Record<string, string>) {
  const formBody = Object.entries(body)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const res = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      'apiKey': AT_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: formBody,
  })
  const json = await res.json()
  return json
}

export async function sendSMS(to: string | string[], message: string) {
  const recipients = Array.isArray(to) ? to.join(',') : to
  return atFetch('/messaging', {
    username: AT_USER,
    to: recipients,
    message,
    from: AT_SENDER,
  })
}

export async function sendBulkSMS(recipients: Array<{ phone: string; message: string }>) {
  // AT supports bulk but with same message — batch by message content
  const groups = recipients.reduce<Record<string, string[]>>((acc, r) => {
    if (!acc[r.message]) acc[r.message] = []
    acc[r.message].push(r.phone)
    return acc
  }, {})

  return Promise.allSettled(
    Object.entries(groups).map(([message, phones]) =>
      sendSMS(phones, message)
    )
  )
}

// USSD response helpers
export function ussdContinue(text: string) {
  return `CON ${text}`
}

export function ussdEnd(text: string) {
  return `END ${text}`
}

// Standard USSD menus
export const USSD_MENUS = {
  main: (name: string, level: number) =>
    `CON Welcome, ${name || 'friend'} (Level ${level})\n1. My Identity\n2. Savings Groups\n3. Loans\n4. Marketplace\n5. Governance\n6. Transfer\n0. Help`,

  identity: (p1: boolean, p2Days: number, p3Threads: number, level: number) =>
    `CON Identity Level ${level}/4\n1-Origin:${p1 ? '✓' : `need corroboration`}\n2-Presence:${p2Days}/30 days\n3-Activity:${p3Threads}/5 threads\n0. Back`,

  savings: (balance: number, chamaName: string) =>
    `CON ${chamaName}\nBalance: KES ${balance}\n1. Contribute\n2. Check balance\n3. Request loan\n0. Back`,

  vote: (proposal: string) =>
    `CON VOTE: ${proposal.slice(0, 100)}\n1. YES\n2. NO\n0. Skip`,
} as const
