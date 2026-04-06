// lib/cohere.ts
const COHERE_KEY = process.env.COHERE_API_KEY!
const BASE = 'https://api.cohere.com/v1'

async function cohereFetch(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COHERE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || 'Cohere error')
  return json
}

// ─── CHAT (command-r / command-r-plus) ───────────────────────────────────────
export async function chat({
  message,
  systemPrompt,
  chatHistory = [],
  model = 'command-r',
}: {
  message: string
  systemPrompt?: string
  chatHistory?: Array<{ role: 'USER' | 'CHATBOT'; message: string }>
  model?: 'command-r' | 'command-r-plus'
}) {
  const data = await cohereFetch('/chat', {
    model,
    message,
    preamble: systemPrompt,
    chat_history: chatHistory,
    max_tokens: 500,
  })
  return data.text as string
}

// ─── EMBED (multilingual) ────────────────────────────────────────────────────
export async function embed(texts: string[]): Promise<number[][]> {
  const data = await cohereFetch('/embed', {
    model: 'embed-multilingual-v3.0',
    texts,
    input_type: 'search_document',
    embedding_types: ['float'],
  })
  return data.embeddings.float as number[][]
}

export async function embedQuery(query: string): Promise<number[]> {
  const data = await cohereFetch('/embed', {
    model: 'embed-multilingual-v3.0',
    texts: [query],
    input_type: 'search_query',
    embedding_types: ['float'],
  })
  return data.embeddings.float[0] as number[]
}

// ─── CLASSIFY ────────────────────────────────────────────────────────────────
export async function classify(inputs: string[], examples: Array<{ text: string; label: string }>) {
  const data = await cohereFetch('/classify', {
    model: 'embed-multilingual-v3.0',
    inputs,
    examples,
  })
  return data.classifications as Array<{
    input: string
    prediction: string
    confidence: number
    confidences: Array<{ option: string; confidence: number }>
  }>
}

// ─── IDENTITY EXPLAINER ──────────────────────────────────────────────────────
export async function explainIdentity({
  language,
  level,
  p1Done, p1Score,
  p2Done, p2Days,
  p3Done, p3Threads,
}: {
  language: string
  level: number
  p1Done: boolean; p1Score: number
  p2Done: boolean; p2Days: number
  p3Done: boolean; p3Threads: number
}) {
  const langNames: Record<string, string> = {
    en: 'English', sw: 'Swahili', fr: 'French', ar: 'Arabic',
  }
  const lang = langNames[language] || 'English'

  const statusText = `
Identity Level: ${level}/4
Pillar 1 (Origin Web): ${p1Done ? 'COMPLETE' : `${Math.round(p1Score)}% - need 3 community corroborations`}
Pillar 2 (Presence Pulse): ${p2Done ? 'COMPLETE' : `${p2Days}/30 days of consistent presence`}
Pillar 3 (Activity Threads): ${p3Done ? 'COMPLETE' : `${p3Threads}/5 distinct transaction partners`}
`.trim()

  return chat({
    model: 'command-r',
    systemPrompt: `You are TrustBase's member assistant. Respond in ${lang}. 
Keep replies under 160 characters for SMS. Be encouraging and specific. 
Explain what the member needs to do next to advance their identity level.`,
    message: statusText,
  })
}

// ─── FRAUD CLASSIFIER (few-shot) ─────────────────────────────────────────────
const FRAUD_EXAMPLES = [
  { text: 'Activated 1 pillar in 45 days. Activity threads with 5 different cities. Normal velocity.', label: 'legitimate' },
  { text: 'Pillar 1 complete. 22/30 presence days. 3 activity threads, all different members.', label: 'legitimate' },
  { text: 'New member, 10 transactions all with same counterpart. 0 diversity.', label: 'suspicious' },
  { text: 'Activated 3 pillars in 2 days. 5 threads all same origin. Velocity 10x baseline.', label: 'coordinated_fraud' },
  { text: 'Level jumped 0→3 in 24h. All corroborators share phone prefix. Multiple accounts one device.', label: 'coordinated_fraud' },
  { text: 'Steady savings for 60 days. Loan repaid on time. Good standing.', label: 'legitimate' },
]

export async function classifyFraudRisk(activitySummary: string) {
  const results = await classify([activitySummary], FRAUD_EXAMPLES)
  return results[0]
}

// ─── LISTING CLASSIFIER ──────────────────────────────────────────────────────
const CATEGORY_EXAMPLES = [
  { text: 'Fresh tomatoes and vegetables from my garden', label: 'food' },
  { text: 'Second hand clothes, dresses and shirts', label: 'clothing' },
  { text: 'Phone repair and screen replacement', label: 'services' },
  { text: 'Samsung phone charger, USB cable', label: 'electronics' },
  { text: 'Handmade beaded bracelets', label: 'crafts' },
  { text: 'Tutoring in mathematics for students', label: 'services' },
  { text: 'Cooking oil, rice and maize flour', label: 'food' },
  { text: 'Knitted bags and woven baskets', label: 'crafts' },
]

export async function classifyListing(title: string, description: string) {
  const input = `${title}. ${description}`
  const results = await classify([input], CATEGORY_EXAMPLES)
  return results[0]
}

// ─── DISPUTE RESOLUTION ──────────────────────────────────────────────────────
export async function resolveDispute({
  orderDetails,
  buyerLevel,
  sellerLevel,
  description,
}: {
  orderDetails: string
  buyerLevel: number
  sellerLevel: number
  description: string
}) {
  const message = `
Order: ${orderDetails}
Buyer identity level: ${buyerLevel}/4
Seller identity level: ${sellerLevel}/4
Dispute description: ${description}

Return ONLY a JSON object (no markdown) with fields:
summary, key_discrepancy, recommendation (one of: refund_buyer|release_to_seller|partial_refund|escalate), confidence (0-1)
`.trim()

  const text = await chat({
    model: 'command-r-plus',
    systemPrompt: 'You are a fair dispute resolution assistant for a community marketplace. Analyze disputes objectively and return only JSON.',
    message,
  })

  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return { summary: text, recommendation: 'escalate', confidence: 0.5, key_discrepancy: 'Parse error' }
  }
}

// ─── CREDIT NARRATIVE ────────────────────────────────────────────────────────
export async function generateCreditNarrative({
  displayName,
  level,
  tenureDays,
  savingsConsistencyPct,
  loanRepaymentRate,
  transactionCount,
  language,
}: {
  displayName: string
  level: number
  tenureDays: number
  savingsConsistencyPct: number
  loanRepaymentRate: number
  transactionCount: number
  language: string
}) {
  const langNames: Record<string, string> = {
    en: 'English', sw: 'Swahili', fr: 'French', ar: 'Arabic',
  }

  const summary = `
Member: ${displayName}
TrustBase Identity Level: ${level}/4
Platform Tenure: ${tenureDays} days
Savings Consistency: ${savingsConsistencyPct}%
Loan Repayment Rate: ${loanRepaymentRate}%
Total Transactions: ${transactionCount}
`.trim()

  const english = await chat({
    model: 'command-r-plus',
    systemPrompt: `You write financial identity narratives for refugee community members. 
Write a professional 1-paragraph narrative describing financial reliability and community standing.
Do NOT include raw numbers — describe qualitatively. No markdown.`,
    message: summary,
  })

  if (language === 'en') return english

  const translated = await chat({
    model: 'command-r-plus',
    systemPrompt: `Translate the following financial narrative to ${langNames[language] || 'English'}. 
Keep the professional tone. Return only the translated text.`,
    message: english,
  })

  return translated
}

// ─── ONBOARDING GUIDE ────────────────────────────────────────────────────────
export async function onboardingGuide({
  question,
  language,
  level,
  activeChamas,
}: {
  question: string
  language: string
  level: number
  activeChamas: string[]
}) {
  const langNames: Record<string, string> = {
    en: 'English', sw: 'Swahili', fr: 'French', ar: 'Arabic',
  }
  const lang = langNames[language] || 'English'

  return chat({
    model: 'command-r',
    systemPrompt: `You are TrustBase's helpful community guide. Respond in ${lang}.
The member's current identity level is ${level}/4.
Their active savings groups: ${activeChamas.join(', ') || 'none yet'}.
TrustBase knowledge: Identity levels 0-4 built through 3 pillars (origin web, presence pulse, activity threads).
Services: digital savings groups (chamas), peer-guarantee loans, internal marketplace, cross-city transfers, governance voting.
Be encouraging, practical, and specific. Keep response under 200 words.`,
    message: question,
  })
}
