/// <reference path="../_shared/edge-runtime.d.ts" />

// supabase/functions/nightly-pillar-score/index.ts
// Runs at 02:00 EAT nightly via pg_cron or Supabase scheduled function
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const COHERE_KEY = Deno.env.get('COHERE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SECRET_KEY =
  Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const AT_KEY = Deno.env.get('AFRICASTALKING_API_KEY')!
const AT_USER = Deno.env.get('AFRICASTALKING_USERNAME')!

if (!SUPABASE_SECRET_KEY) {
  throw new Error('Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) for admin Edge Function access.')
}

if (SUPABASE_SECRET_KEY.startsWith('postgres://') || SUPABASE_SECRET_KEY.startsWith('postgresql://')) {
  throw new Error('SUPABASE_SECRET_KEY must be an API key, not a Postgres connection URL.')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)

type TransactionCounterpartRow = {
  counterpart_id: string | null
}

async function classifyFraud(activitySummary: string) {
  const examples = [
    { text: 'Activated 1 pillar in 45 days. Normal velocity. Diverse threads.', label: 'legitimate' },
    { text: 'Steady savings for 60 days. Loan repaid on time.', label: 'legitimate' },
    { text: 'New member, 10 transactions all with same counterpart.', label: 'suspicious' },
    { text: 'Activated 3 pillars in 2 days. 5 threads same origin. Velocity 10x baseline.', label: 'coordinated_fraud' },
  ]

  const res = await fetch('https://api.cohere.com/v1/classify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COHERE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'embed-multilingual-v3.0',
      inputs: [activitySummary],
      examples,
    }),
  })
  const data = await res.json()
  return data.classifications?.[0]
}

async function sendSMS(to: string, message: string) {
  const body = new URLSearchParams({
    username: AT_USER,
    to,
    message,
    from: 'TrustBase',
  })
  await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: { 'apiKey': AT_KEY, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: body.toString(),
  })
}

Deno.serve(async () => {
  console.log('Nightly pillar score job started')
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  // Get all active members
  const { data: members } = await supabase
    .from('members')
    .select('id, identity_level, language, created_at')
    .eq('is_active', true)

  if (!members?.length) {
    return new Response('No active members', { status: 200 })
  }

  let levelUps = 0
  let flagged = 0

  for (const member of members) {
    try {
      const { data: pillars } = await supabase
        .from('identity_pillars')
        .select('*')
        .eq('member_id', member.id)
        .single()

      if (!pillars) continue

      // ── PILLAR 2: Presence Pulse ────────────────────────────
      // Count days with transactions or contributions in last 30 days
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { count: activeDays } = await supabase
        .from('transactions')
        .select('created_at', { count: 'exact', head: true })
        .eq('member_id', member.id)
        .gte('created_at', thirtyDaysAgo)

      const p2Days = Math.min(activeDays || 0, 30)
      const p2Done = p2Days >= 30
      const p2Score = (p2Days / 30) * 100

      // ── PILLAR 3: Activity Threads ──────────────────────────
      const { data: transactions } = await supabase
        .from('transactions')
        .select('counterpart_id')
        .eq('member_id', member.id)
        .not('counterpart_id', 'is', null)

      const transactionRows = (transactions ?? []) as TransactionCounterpartRow[]
      const uniqueCounterparts = new Set(
        transactionRows
          .map((transaction) => transaction.counterpart_id)
          .filter((counterpartId): counterpartId is string => Boolean(counterpartId))
      )
      const p3Threads = Math.min(uniqueCounterparts.size, 5)
      const p3Done = p3Threads >= 5
      const p3Score = (p3Threads / 5) * 100

      // ── PILLAR 1: Origin Web ────────────────────────────────
      const { count: corroborations } = await supabase
        .from('origin_corroborations')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', member.id)

      const p1Done = (corroborations || 0) >= 3
      const p1Score = Math.min(((corroborations || 0) / 3) * 100, 100)

      // ── UPDATE PILLARS ──────────────────────────────────────
      await supabase
        .from('identity_pillars')
        .update({
          pillar_1_score: p1Score,
          pillar_2_score: p2Score,
          pillar_3_score: p3Score,
          pillar_1_done: p1Done,
          pillar_2_done: p2Done,
          pillar_3_done: p3Done,
          p2_days_present: p2Days,
          p3_threads: p3Threads,
          updated_at: now.toISOString(),
        })
        .eq('member_id', member.id)

      // ── LEVEL TRANSITION CHECK ──────────────────────────────
      const daysOnPlatform = Math.floor(
        (now.getTime() - new Date(member.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )

      const pillarsDone = [p1Done, p2Done, p3Done].filter(Boolean).length
      let newLevel = 0
      if (pillarsDone >= 1) newLevel = 1
      if (pillarsDone >= 2) newLevel = 2
      if (pillarsDone >= 3 && daysOnPlatform >= 90) newLevel = 3
      if (pillarsDone >= 3 && daysOnPlatform >= 180) newLevel = 4

      if (newLevel !== member.identity_level) {
        await supabase
          .from('members')
          .update({ identity_level: newLevel })
          .eq('id', member.id)

        await supabase.from('identity_events').insert({
          member_id: member.id,
          old_level: member.identity_level,
          new_level: newLevel,
          reason: 'nightly_pillar_recalculation',
        })

        levelUps++
      }

      // ── FRAUD DETECTION ─────────────────────────────────────
      const recentTxCount = activeDays || 0
      const activitySummary = [
        `Pillars completed: ${pillarsDone}/3 in ${daysOnPlatform} days.`,
        `Activity threads: ${p3Threads} distinct counterparts.`,
        `Presence days: ${p2Days}/30.`,
        `Origin corroborations: ${corroborations || 0}.`,
        recentTxCount > 20 ? `High velocity: ${recentTxCount} transactions in 24h.` : '',
      ].filter(Boolean).join(' ')

      const fraud = await classifyFraud(activitySummary)
      if (fraud && fraud.confidence > 0.7 && fraud.prediction !== 'legitimate') {
        await supabase.from('identity_flags').insert({
          member_id: member.id,
          flag_type: fraud.prediction,
          confidence: fraud.confidence,
          reasoning: activitySummary,
          reviewed: false,
        })
        flagged++
      }

    } catch (err) {
      console.error(`Error processing member ${member.id}:`, err)
    }
  }

  console.log(`Nightly run complete. Level-ups: ${levelUps}, Flagged: ${flagged}`)
  return new Response(
    JSON.stringify({ processed: members.length, levelUps, flagged }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
