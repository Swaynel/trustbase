# TrustBase — Community Financial Network

> *"Your community vouches for you. Your history funds you. Your data works for you."*

TrustBase is a community-run financial network where refugees save together, guarantee each other's credit, trade with each other, and build a verified financial identity — all without a bank, a government ID, or an external lender.

**NSC × WIN Innovation Hackathon · April 2026**

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 — Clients                                          │
│  Web App (Next.js 14)  ·  USSD/SMS (*483*#)  ·  Operator PWA│
├─────────────────────────────────────────────────────────────┤
│  Layer 2 — Next.js API Routes (18 routes)                   │
│  Auth · Paystack · Identity · Savings · Loans               │
│  Marketplace · Governance · Transfers · Notifications       │
├─────────────────────────────────────────────────────────────┤
│  Layer 3 — Supabase                                         │
│  Auth (phone OTP)  ·  Postgres + pgvector  ·  Realtime      │
│  Row Level Security  ·  Edge Functions (Deno)               │
├─────────────────────────────────────────────────────────────┤
│  Layer 4 — Cohere AI                                        │
│  Fraud detection · Identity explainer · Listing classifier  │
│  Semantic search · Dispute resolution · Credit narrative    │
├─────────────────────────────────────────────────────────────┤
│  Layer 5 — External Services                                │
│  Paystack (payments)  ·  Africa's Talking (USSD/SMS)        │
│  Cloudinary (images)                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend & backend | Next.js 14 (App Router) |
| Authentication | Supabase Auth — phone OTP |
| Database | Supabase Postgres + pgvector |
| File storage | Cloudinary |
| Payments | Paystack (Charge, Transfers, Webhooks) |
| USSD / SMS | Africa's Talking |
| AI provider | Cohere (command-r, command-r-plus, embed-multilingual, classify) |
| Deployment | Vercel + Supabase Cloud |

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo>
cd trustbase
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
# Fill in all values — see .env.example for documentation
```

### 3. Set up Supabase

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase (Docker required)
supabase start

# Run migrations
supabase db push

# Deploy edge functions
supabase functions deploy nightly-pillar-score
supabase functions deploy chama-payout
```

### 4. Run the development server

```bash
npm run dev
# Open http://localhost:3000
```

### 5. Set up webhooks (for Paystack)

In Paystack dashboard → Settings → Webhooks:
```
https://your-ngrok-url.ngrok.io/api/paystack/webhook
```

For Africa's Talking USSD:
```
https://your-ngrok-url.ngrok.io/api/ussd
```

---

## Identity System

Members progress through 5 levels by activating 3 pillars:

| Level | Name | Pillars | Unlocks |
|-------|------|---------|---------|
| 0 | Observer | None | View only |
| 1 | Participant | 1 pillar | Savings groups |
| 2 | Member | 2 pillars | Marketplace + Loans |
| 3 | Trusted Member | 3 pillars + 90 days | Create groups, Node operator |
| 4 | Community Anchor | 3 pillars + 180 days | Max governance weight |

**Three Pillars:**
- **Origin Web** — 3+ Level 2 members corroborate your declared origin country
- **Presence Pulse** — 30 days of consistent phone/M-Pesa activity
- **Activity Threads** — 5 distinct financial transactions with 5 different members

---

## USSD Access

All platform functions accessible on any phone via `*483*#`:

| Code | Function |
|------|----------|
| `*483*00#` | Identity level + pillar status |
| `*483*11#` | Pillar 1 status (origin web) |
| `*483*22#` | Pillar 2 status (presence pulse) |
| `*483*33#` | Pillar 3 status (activity threads) |
| `*483*BAL#` | Check savings group balance |
| `*483*VOUCH*ID#` | Corroborate a member |
| `*483*VOTE*YES#` | Cast YES vote |
| `*483*VOTE*NO#` | Cast NO vote |
| SMS `HELP` | Multilingual AI onboarding guide |

---

## AI Features (Cohere)

| Feature | Model | Where |
|---------|-------|-------|
| Identity explainer SMS | command-r | `GET /api/identity/explain`, USSD `*483*00#` |
| Fraud & anomaly detection | classify (few-shot) | Nightly edge function |
| Listing categorisation | classify + embed | `POST /api/marketplace/listings` |
| Semantic marketplace search | embed-multilingual-v3.0 + pgvector | `GET /api/marketplace/search?q=` |
| Dispute resolution | command-r-plus | `POST /api/marketplace/disputes` |
| Multilingual onboarding | command-r | `POST /api/cohere/onboarding`, SMS `HELP` |
| Credit narrative / passport | command-r-plus | `POST /api/cohere/credit-narrative` |

---

## Database Schema

20 tables across 7 domains:

```
Identity:    members · identity_pillars · identity_events · identity_flags · origin_corroborations
Savings:     chamas · chama_members · chama_events · contributions
Lending:     loans · guarantees
Ledger:      transactions
Marketplace: listings (pgvector) · orders · disputes
Governance:  votes · vote_responses · governance_rules
Transfers:   transfer_requests · ussd_sessions
```

---

## Revenue Model

| Stream | Phase |
|--------|-------|
| Savings group subscription fee | Day 1 |
| Internal marketplace fees | Day 1 |
| Value transfer agent fees | Month 1 |
| Community pool management fee | Month 3 |
| Premium member profiles | Month 3 |
| Dividend distribution | Month 6 |
| External marketplace access (NGOs, corporates) | Year 1 |

---

## Demo Walkthrough (for judges)

1. **Sign in** via phone OTP → see Level 0 dashboard
2. **Identity** — view the three-pillar progress card, click "Explain my identity status" → Cohere generates a personalised SMS in your language
3. **Level up** — manually set `identity_level = 2` in Supabase for demo account
4. **Marketplace** — create a listing → Cohere auto-classifies and embeds it
5. **Semantic search** — search "chakula" (Swahili for food) → English food listings appear via pgvector
6. **Savings** — join a chama → contribute via Paystack test mode → watch balance update in real time via Supabase Realtime
7. **Loans** — request a loan, nominate guarantors → guarantors accept → Paystack disburses
8. **Governance** — vote on an open proposal → see weighted tally update live
9. **Credit narrative** — generate financial passport → Cohere writes a 1-paragraph narrative
10. **USSD** — use Africa's Talking sandbox to dial `*483*00#` → get identity status, then `HELP` → receive AI guide via SMS

---

## Project Structure

```
trustbase/
├── app/
│   ├── (auth)/login/          # Phone OTP login
│   ├── (app)/                 # Authenticated app shell
│   │   ├── dashboard/         # Member home
│   │   ├── chama/[id]/        # Savings groups
│   │   ├── marketplace/[id]/  # Buy & sell
│   │   ├── loans/             # Peer-guarantee lending
│   │   ├── governance/        # Community voting
│   │   ├── transfer/          # Cross-city hawala
│   │   └── profile/           # Identity + financial passport
│   ├── (operator)/operator/   # Node operator PWA
│   └── api/                   # 18 API routes
├── components/                # 25+ React components
├── lib/                       # Paystack, Cohere, AT, Cloudinary, Supabase wrappers
├── supabase/
│   ├── functions/             # Edge functions (nightly-pillar-score, chama-payout)
│   └── migrations/            # 3 SQL migration files
└── middleware.ts              # Auth guard + header injection
```

---

## Environment Variables

See `.env.example` for the full list and documentation.

All secrets are managed as Vercel environment variables in production.
The Paystack public key and Supabase publishable key are the only values safe for the client.
Everything else — Paystack secret, Cohere key, Cloudinary secret, Supabase secret key — is server-only.

---

## The Pitch

> A refugee nurse from DRC has been saving KES 500 every week for three years in a group with twelve neighbors. She has no bank account, no credit score, and no way to prove any of it. When she moves to a new city, she starts from zero. TrustBase changes that — turning her savings history and her community's trust into a financial identity that actually works, on any phone, anywhere she goes.

**The community is the bank, the market, the regulator, and the investor.**

---

*TrustBase · NSC × WIN Innovation Hackathon · April 2026*
