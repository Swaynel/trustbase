-- TrustBase Core Schema
-- Run with: supabase db push

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────
-- MEMBERS
-- ─────────────────────────────────────────
CREATE TABLE members (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id                    UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_hash                 TEXT UNIQUE NOT NULL,  -- SHA-256 of phone number
  identity_level             INTEGER NOT NULL DEFAULT 0 CHECK (identity_level BETWEEN 0 AND 4),
  role                       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','operator','admin')),
  display_name               TEXT,
  language                   TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','sw','fr','ar')),
  origin_country             TEXT,
  origin_region              TEXT,
  paystack_customer_id       TEXT,
  paystack_recipient_code    TEXT,
  cloudinary_profile_id      TEXT,
  credit_narrative           TEXT,
  credit_narrative_at        TIMESTAMPTZ,
  internal_balance           NUMERIC(14,2) NOT NULL DEFAULT 0,
  reputation_score           NUMERIC(5,2) NOT NULL DEFAULT 50.0,
  is_active                  BOOLEAN NOT NULL DEFAULT true,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- IDENTITY PILLARS
-- ─────────────────────────────────────────
CREATE TABLE identity_pillars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  pillar_1_score  NUMERIC(5,2) DEFAULT 0,  -- origin web: 0-100
  pillar_2_score  NUMERIC(5,2) DEFAULT 0,  -- presence pulse: 0-100
  pillar_3_score  NUMERIC(5,2) DEFAULT 0,  -- activity threads: 0-100
  pillar_1_done   BOOLEAN NOT NULL DEFAULT false,
  pillar_2_done   BOOLEAN NOT NULL DEFAULT false,
  pillar_3_done   BOOLEAN NOT NULL DEFAULT false,
  p2_days_present INTEGER DEFAULT 0,
  p3_threads      INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE identity_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  old_level   INTEGER,
  new_level   INTEGER,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE identity_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES members(id),
  flag_type   TEXT NOT NULL CHECK (flag_type IN ('suspicious','coordinated_fraud')),
  confidence  NUMERIC(4,3),
  reasoning   TEXT,
  reviewed    BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID REFERENCES members(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Corroboration for Pillar 1
CREATE TABLE origin_corroborations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id       UUID NOT NULL REFERENCES members(id),
  corroborator_id  UUID NOT NULL REFERENCES members(id),
  origin_country   TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subject_id, corroborator_id)
);

-- ─────────────────────────────────────────
-- CHAMAS (SAVINGS GROUPS)
-- ─────────────────────────────────────────
CREATE TABLE chamas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  description          TEXT,
  status               TEXT NOT NULL DEFAULT 'forming'
                         CHECK (status IN ('forming','active','payout','closed')),
  contribution_amount  NUMERIC(14,2) NOT NULL,
  cycle_days           INTEGER NOT NULL DEFAULT 30,
  balance              NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by           UUID NOT NULL REFERENCES members(id),
  current_cycle_end    DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chama_members (
  chama_id          UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES members(id),
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_contributed NUMERIC(14,2) NOT NULL DEFAULT 0,
  payout_received   BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (chama_id, member_id)
);

CREATE TABLE chama_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id    UUID NOT NULL REFERENCES chamas(id),
  event_type  TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contributions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id            UUID NOT NULL REFERENCES chamas(id),
  member_id           UUID NOT NULL REFERENCES members(id),
  amount              NUMERIC(14,2) NOT NULL,
  paystack_reference  TEXT UNIQUE,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','success','failed')),
  operator_id         UUID REFERENCES members(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- LOANS
-- ─────────────────────────────────────────
CREATE TABLE loans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chama_id            UUID REFERENCES chamas(id),
  borrower_id         UUID NOT NULL REFERENCES members(id),
  amount              NUMERIC(14,2) NOT NULL,
  purpose             TEXT,
  status              TEXT NOT NULL DEFAULT 'requested'
                        CHECK (status IN ('requested','guaranteeing','approved','disbursed','repaid','defaulted')),
  paystack_reference  TEXT,
  disbursed_at        TIMESTAMPTZ,
  due_at              TIMESTAMPTZ,
  repaid_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE guarantees (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id        UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  guarantor_id   UUID NOT NULL REFERENCES members(id),
  stake_score    NUMERIC(5,2) NOT NULL DEFAULT 10,
  accepted       BOOLEAN,
  outcome        TEXT CHECK (outcome IN ('returned','deducted')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TRANSACTIONS (LEDGER)
-- ─────────────────────────────────────────
CREATE TABLE transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           UUID NOT NULL REFERENCES members(id),
  type                TEXT NOT NULL
                        CHECK (type IN ('contribution','loan_disbursement','loan_repayment',
                                        'marketplace_payment','marketplace_payout',
                                        'chama_payout','transfer_sent','transfer_received',
                                        'agent_fee','investment','dividend')),
  amount              NUMERIC(14,2) NOT NULL,
  direction           TEXT NOT NULL CHECK (direction IN ('in','out')),
  paystack_reference  TEXT,
  counterpart_id      UUID REFERENCES members(id),
  operator_id         UUID REFERENCES members(id),
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- MARKETPLACE
-- ─────────────────────────────────────────
CREATE TABLE listings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id           UUID NOT NULL REFERENCES members(id),
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  category            TEXT,
  price               NUMERIC(14,2) NOT NULL,
  cloudinary_public_id TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','active','sold','suspended')),
  quality_score       NUMERIC(3,1),
  listing_embedding   vector(1024),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON listings USING ivfflat (listing_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          UUID NOT NULL REFERENCES listings(id),
  buyer_id            UUID NOT NULL REFERENCES members(id),
  seller_id           UUID NOT NULL REFERENCES members(id),
  amount              NUMERIC(14,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','paid','completed','disputed','cancelled')),
  paystack_reference  TEXT UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE disputes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                 UUID NOT NULL REFERENCES orders(id),
  raised_by                UUID NOT NULL REFERENCES members(id),
  description              TEXT,
  cohere_summary           TEXT,
  recommended_resolution   TEXT CHECK (recommended_resolution IN
                              ('refund_buyer','release_to_seller','partial_refund','escalate')),
  cohere_confidence        NUMERIC(4,3),
  resolved_by              UUID REFERENCES members(id),
  outcome                  TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- GOVERNANCE
-- ─────────────────────────────────────────
CREATE TABLE votes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal         TEXT NOT NULL,
  proposer_id      UUID NOT NULL REFERENCES members(id),
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  window_closes_at TIMESTAMPTZ NOT NULL,
  yes_weight       NUMERIC(10,2) NOT NULL DEFAULT 0,
  no_weight        NUMERIC(10,2) NOT NULL DEFAULT 0,
  result           TEXT CHECK (result IN ('passed','failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vote_responses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id    UUID NOT NULL REFERENCES votes(id),
  member_id  UUID NOT NULL REFERENCES members(id),
  choice     TEXT NOT NULL CHECK (choice IN ('yes','no')),
  weight     NUMERIC(5,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vote_id, member_id)
);

CREATE TABLE governance_rules (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_by  UUID REFERENCES members(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO governance_rules (key, value) VALUES
  ('max_loan_amount', '5000'),
  ('min_guarantors', '2'),
  ('max_guarantors', '3'),
  ('loan_grace_days', '7'),
  ('min_chama_size', '3'),
  ('max_chama_size', '30'),
  ('agent_fee_pct', '0.5');

-- ─────────────────────────────────────────
-- VALUE TRANSFER
-- ─────────────────────────────────────────
CREATE TABLE transfer_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        UUID NOT NULL REFERENCES members(id),
  amount           NUMERIC(14,2) NOT NULL,
  destination_city TEXT NOT NULL,
  agent_id         UUID REFERENCES members(id),
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','matched','completed','expired','cancelled')),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- USSD SESSIONS
-- ─────────────────────────────────────────
CREATE TABLE ussd_sessions (
  session_id    TEXT PRIMARY KEY,
  member_id     UUID REFERENCES members(id),
  phone_hash    TEXT,
  current_menu  TEXT NOT NULL DEFAULT 'main',
  pending_data  JSONB,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamas ENABLE ROW LEVEL SECURITY;
ALTER TABLE chama_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE guarantees ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;

-- Members can read/write their own data
CREATE POLICY "members_own" ON members
  FOR ALL USING (auth.uid() = auth_id);

CREATE POLICY "pillars_own" ON identity_pillars
  FOR ALL USING (
    member_id = (SELECT id FROM members WHERE auth_id = auth.uid())
  );

CREATE POLICY "transactions_own" ON transactions
  FOR ALL USING (
    member_id = (SELECT id FROM members WHERE auth_id = auth.uid())
  );

-- Chamas readable by members of that chama
CREATE POLICY "chamas_member_read" ON chamas
  FOR SELECT USING (
    id IN (
      SELECT chama_id FROM chama_members
      WHERE member_id = (SELECT id FROM members WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "chama_members_read" ON chama_members
  FOR SELECT USING (
    chama_id IN (
      SELECT chama_id FROM chama_members
      WHERE member_id = (SELECT id FROM members WHERE auth_id = auth.uid())
    )
  );

-- Active listings readable by all authenticated users
CREATE POLICY "listings_public_read" ON listings
  FOR SELECT USING (status = 'active' OR
    seller_id = (SELECT id FROM members WHERE auth_id = auth.uid())
  );

CREATE POLICY "listings_seller_write" ON listings
  FOR INSERT WITH CHECK (
    seller_id = (SELECT id FROM members WHERE auth_id = auth.uid())
  );

-- Votes readable by all
CREATE POLICY "votes_read" ON votes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "vote_responses_read" ON vote_responses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "vote_responses_write" ON vote_responses
  FOR INSERT WITH CHECK (
    member_id = (SELECT id FROM members WHERE auth_id = auth.uid())
  );

-- ─────────────────────────────────────────
-- CUSTOM JWT CLAIMS HOOK
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_custom_jwt_claims(event JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  _member members%ROWTYPE;
BEGIN
  SELECT * INTO _member FROM members WHERE auth_id = (event->>'user_id')::UUID;
  IF FOUND THEN
    RETURN jsonb_set(
      event,
      '{claims}',
      (event->'claims') ||
      jsonb_build_object(
        'identity_level', _member.identity_level,
        'role', _member.role,
        'member_id', _member.id
      )
    );
  END IF;
  RETURN event;
END;
$$;

-- ─────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER members_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pillars_updated_at BEFORE UPDATE ON identity_pillars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create identity_pillars row when member created
CREATE OR REPLACE FUNCTION create_member_pillars()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO identity_pillars (member_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER member_pillars_init AFTER INSERT ON members
  FOR EACH ROW EXECUTE FUNCTION create_member_pillars();
