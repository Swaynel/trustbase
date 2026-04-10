// lib/cohere.ts
const COHERE_KEY = process.env.COHERE_API_KEY!
const BASE = 'https://api.cohere.com/v1'
const DEFAULT_CHAT_MODEL = 'command-r-08-2024'
const PREMIUM_CHAT_MODEL = 'command-r-plus-08-2024'

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

// ─── CHAT (Command R Aug 2024 / Command R+ Aug 2024) ─────────────────────────
export async function chat({
  message,
  systemPrompt,
  chatHistory = [],
  model = DEFAULT_CHAT_MODEL,
}: {
  message: string
  systemPrompt?: string
  chatHistory?: Array<{ role: 'USER' | 'CHATBOT'; message: string }>
  model?: typeof DEFAULT_CHAT_MODEL | typeof PREMIUM_CHAT_MODEL
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

// ─── CLASSIFY (chat-based replacement) ───────────────────────────────────────
type ClassificationExample = { text: string; label: string }

type ClassificationResult = {
  input: string
  prediction: string
  confidence: number
  confidences: Array<{ option: string; confidence: number }>
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function buildFallbackConfidences(labels: string[], prediction: string, confidence: number) {
  const remainder = labels.length > 1 ? (1 - confidence) / (labels.length - 1) : 0

  return labels.map((label) => ({
    option: label,
    confidence: label === prediction ? confidence : remainder,
  }))
}

export async function classify(inputs: string[], examples: ClassificationExample[]) {
  const labels = Array.from(new Set(examples.map((example) => example.label)))
  const examplesText = examples
    .map((example) => `Label: ${example.label}\nText: ${example.text}`)
    .join('\n\n')

  const systemPrompt = `You are a compact text classifier.
Return only valid JSON with this shape:
{"results":[{"prediction":"one label","confidence":0.0,"confidences":[{"option":"label","confidence":0.0}]}]}

Rules:
- Use only these labels: ${labels.join(', ')}
- Confidence must be between 0 and 1
- Include one confidences entry per label
- No markdown, no commentary.`

  const results = await Promise.all(
    inputs.map(async (input) => {
      const response = await chat({
        model: DEFAULT_CHAT_MODEL,
        systemPrompt,
        message: `Examples:\n${examplesText}\n\nClassify this text:\n${input}`,
      })

      try {
        const parsed = JSON.parse(response.replace(/```json|```/g, '').trim()) as {
          results?: Array<{
            prediction?: string
            confidence?: number
            confidences?: Array<{ option?: string; confidence?: number }>
          }>
        }

        const candidate = parsed.results?.[0]
        const prediction = labels.includes(candidate?.prediction || '') ? String(candidate?.prediction) : labels[0]
        const confidence = normalizeConfidence(candidate?.confidence)
        const confidences =
          candidate?.confidences
            ?.map((item) => ({
              option: typeof item.option === 'string' ? item.option : '',
              confidence: normalizeConfidence(item.confidence),
            }))
            .filter((item) => labels.includes(item.option))
            ?? []

        return {
          input,
          prediction,
          confidence,
          confidences: confidences.length
            ? confidences
            : buildFallbackConfidences(labels, prediction, confidence),
        } satisfies ClassificationResult
      } catch {
        const prediction = labels[0]
        const confidence = 0.5

        return {
          input,
          prediction,
          confidence,
          confidences: buildFallbackConfidences(labels, prediction, confidence),
        } satisfies ClassificationResult
      }
    })
  )

  return results
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
    model: DEFAULT_CHAT_MODEL,
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
export type DisputeResolution = {
  summary: string
  key_discrepancy: string
  recommendation: 'refund_buyer' | 'release_to_seller' | 'partial_refund' | 'escalate'
  confidence: number
}

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
}): Promise<DisputeResolution> {
  const message = `
Order: ${orderDetails}
Buyer identity level: ${buyerLevel}/4
Seller identity level: ${sellerLevel}/4
Dispute description: ${description}

Return ONLY a JSON object (no markdown) with fields:
summary, key_discrepancy, recommendation (one of: refund_buyer|release_to_seller|partial_refund|escalate), confidence (0-1)
`.trim()

  const text = await chat({
    model: PREMIUM_CHAT_MODEL,
    systemPrompt: 'You are a fair dispute resolution assistant for a community marketplace. Analyze disputes objectively and return only JSON.',
    message,
  })

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) as Partial<DisputeResolution>

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : text,
      key_discrepancy: typeof parsed.key_discrepancy === 'string' ? parsed.key_discrepancy : 'Unavailable',
      recommendation:
        parsed.recommendation === 'refund_buyer' ||
        parsed.recommendation === 'release_to_seller' ||
        parsed.recommendation === 'partial_refund' ||
        parsed.recommendation === 'escalate'
          ? parsed.recommendation
          : 'escalate',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    }
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
    model: PREMIUM_CHAT_MODEL,
    systemPrompt: `You write financial identity narratives for refugee community members. 
Write a professional 1-paragraph narrative describing financial reliability and community standing.
Do NOT include raw numbers — describe qualitatively. No markdown.`,
    message: summary,
  })

  if (language === 'en') return english

  const translated = await chat({
    model: PREMIUM_CHAT_MODEL,
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
    model: DEFAULT_CHAT_MODEL,
    systemPrompt: `You are TrustBase's helpful community guide. Respond in ${lang}.
The member's current identity level is ${level}/4.
Their active savings groups: ${activeChamas.join(', ') || 'none yet'}.
TrustBase knowledge: Identity levels 0-4 built through 3 pillars (origin web, presence pulse, activity threads).
Services: digital savings groups (chamas), peer-guarantee loans, internal marketplace, cross-city transfers, governance voting.
Be encouraging, practical, and specific. Keep response under 200 words.`,
    message: question,
  })
}
