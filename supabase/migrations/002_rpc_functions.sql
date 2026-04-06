-- TrustBase RPC Functions & Helpers
-- Migration 002

-- ─────────────────────────────────────────────────────────────────────────────
-- ATOMIC INCREMENT HELPERS
-- (used in webhook handlers and edge functions to avoid race conditions)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_chama_balance(chama_id UUID, amount NUMERIC)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE chamas SET balance = balance + amount WHERE id = chama_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_member_contribution(
  chama_id UUID, member_id UUID, amount NUMERIC
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE chama_members
  SET total_contributed = total_contributed + amount
  WHERE chama_id = increment_member_contribution.chama_id
    AND member_id = increment_member_contribution.member_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_member_balance(member_id UUID, amount NUMERIC)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE members SET internal_balance = internal_balance + amount WHERE id = member_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_vote_weight(
  vote_id UUID,
  col     TEXT,    -- 'yes_weight' or 'no_weight'
  amount  NUMERIC
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF col = 'yes_weight' THEN
    UPDATE votes SET yes_weight = yes_weight + amount WHERE id = vote_id;
  ELSIF col = 'no_weight' THEN
    UPDATE votes SET no_weight = no_weight + amount WHERE id = vote_id;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ACTIVITY THREAD TRACKER
-- Increments Pillar 3 thread count if this is a new counterpart
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION maybe_add_activity_thread(
  member_id        UUID,
  counterpart_type TEXT DEFAULT 'transaction'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _distinct_partners INTEGER;
BEGIN
  SELECT COUNT(DISTINCT counterpart_id)
  INTO _distinct_partners
  FROM transactions
  WHERE member_id = maybe_add_activity_thread.member_id
    AND counterpart_id IS NOT NULL;

  -- Update p3_threads score (capped at 5 for pillar completion)
  UPDATE identity_pillars
  SET
    p3_threads    = _distinct_partners,
    pillar_3_score = LEAST(100, (_distinct_partners::NUMERIC / 5) * 100),
    pillar_3_done  = (_distinct_partners >= 5),
    updated_at     = NOW()
  WHERE member_id = maybe_add_activity_thread.member_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- LOAN REPAYMENT PROCESSOR
-- Boosts guarantor reputation, records outcome
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION process_loan_repayment(loan_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _guarantee RECORD;
BEGIN
  FOR _guarantee IN
    SELECT * FROM guarantees WHERE loan_id = process_loan_repayment.loan_id AND accepted = TRUE
  LOOP
    -- Return stake and add reputation bonus
    UPDATE members
    SET reputation_score = LEAST(100, reputation_score + _guarantee.stake_score * 0.5)
    WHERE id = _guarantee.guarantor_id;

    -- Mark guarantee outcome
    UPDATE guarantees SET outcome = 'returned' WHERE id = _guarantee.id;
  END LOOP;

  -- Boost borrower reputation too
  UPDATE members
  SET reputation_score = LEAST(100, reputation_score + 5)
  WHERE id = (SELECT borrower_id FROM loans WHERE id = loan_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- LOAN DEFAULT HANDLER
-- Deducts guarantor reputation, drops borrower level
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION process_loan_default(loan_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _guarantee RECORD;
  _borrower_id UUID;
  _current_level INTEGER;
BEGIN
  SELECT borrower_id INTO _borrower_id FROM loans WHERE id = loan_id;

  FOR _guarantee IN
    SELECT * FROM guarantees WHERE loan_id = process_loan_default.loan_id AND accepted = TRUE
  LOOP
    -- Deduct guarantor reputation proportionally
    UPDATE members
    SET reputation_score = GREATEST(0, reputation_score - _guarantee.stake_score)
    WHERE id = _guarantee.guarantor_id;

    UPDATE guarantees SET outcome = 'deducted' WHERE id = _guarantee.id;
  END LOOP;

  -- Drop borrower identity level by 1 (but not below 0)
  UPDATE members
  SET
    identity_level = GREATEST(0, identity_level - 1),
    reputation_score = GREATEST(0, reputation_score - 15)
  WHERE id = _borrower_id;

  -- Log the level drop
  SELECT identity_level INTO _current_level FROM members WHERE id = _borrower_id;
  INSERT INTO identity_events (member_id, old_level, new_level, reason)
  VALUES (_borrower_id, _current_level + 1, _current_level, 'Loan default');

  -- Mark loan defaulted
  UPDATE loans SET status = 'defaulted' WHERE id = loan_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- CHAMA PAYOUT MARKER
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_chama_member_paid(chama_id UUID, member_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE chama_members
  SET payout_received = TRUE
  WHERE chama_id = mark_chama_member_paid.chama_id
    AND member_id = mark_chama_member_paid.member_id;

  -- Check if all members have been paid → close the chama
  IF NOT EXISTS (
    SELECT 1 FROM chama_members
    WHERE chama_id = mark_chama_member_paid.chama_id
      AND payout_received = FALSE
  ) THEN
    UPDATE chamas SET status = 'closed' WHERE id = chama_id;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SEMANTIC LISTING SEARCH (pgvector)
-- Called by /api/marketplace/search
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION search_listings(
  query_embedding  vector(1024),
  match_threshold  FLOAT   DEFAULT 0.3,
  match_count      INTEGER DEFAULT 20
)
RETURNS TABLE (
  id                   UUID,
  title                TEXT,
  description          TEXT,
  category             TEXT,
  price                NUMERIC,
  cloudinary_public_id TEXT,
  seller_id            UUID,
  created_at           TIMESTAMPTZ,
  similarity           FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.title,
    l.description,
    l.category,
    l.price,
    l.cloudinary_public_id,
    l.seller_id,
    l.created_at,
    1 - (l.listing_embedding <=> query_embedding) AS similarity
  FROM listings l
  WHERE
    l.status = 'active'
    AND l.listing_embedding IS NOT NULL
    AND 1 - (l.listing_embedding <=> query_embedding) > match_threshold
  ORDER BY l.listing_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- VOTE RESOLUTION (called by chama-payout edge function or admin)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION resolve_expired_votes()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _vote RECORD;
  _resolved INTEGER := 0;
BEGIN
  FOR _vote IN
    SELECT * FROM votes
    WHERE status = 'open'
      AND window_closes_at < NOW()
  LOOP
    UPDATE votes
    SET
      status = 'closed',
      result = CASE WHEN yes_weight > no_weight THEN 'passed' ELSE 'failed' END
    WHERE id = _vote.id;

    _resolved := _resolved + 1;
  END LOOP;

  RETURN _resolved;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- EXPIRED TRANSFER CLEANUP
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION expire_stale_transfers()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Refund internal balance for expired open transfers
  UPDATE members m
  SET internal_balance = internal_balance + tr.amount
  FROM transfer_requests tr
  WHERE tr.sender_id = m.id
    AND tr.status = 'open'
    AND tr.expires_at < NOW();

  -- Mark as expired
  UPDATE transfer_requests
  SET status = 'expired'
  WHERE status = 'open' AND expires_at < NOW();
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES for performance
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_transactions_member_id    ON transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at   ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contributions_chama_id    ON contributions(chama_id);
CREATE INDEX IF NOT EXISTS idx_contributions_member_id   ON contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id         ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_guarantees_guarantor_id   ON guarantees(guarantor_id);
CREATE INDEX IF NOT EXISTS idx_guarantees_loan_id        ON guarantees(loan_id);
CREATE INDEX IF NOT EXISTS idx_chama_members_member_id   ON chama_members(member_id);
CREATE INDEX IF NOT EXISTS idx_listings_status           ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_category         ON listings(category);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id           ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id          ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_votes_status              ON votes(status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status  ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_identity_pillars_member   ON identity_pillars(member_id);
CREATE INDEX IF NOT EXISTS idx_origin_corroborations_subject ON origin_corroborations(subject_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEDULED JOBS (requires pg_cron extension — enable in Supabase dashboard)
-- ─────────────────────────────────────────────────────────────────────────────

-- Uncomment after enabling pg_cron in Supabase:
-- SELECT cron.schedule('resolve-votes', '*/30 * * * *', 'SELECT resolve_expired_votes()');
-- SELECT cron.schedule('expire-transfers', '0 * * * *', 'SELECT expire_stale_transfers()');

-- Edge functions called via Supabase pg_net (HTTP cron):
-- SELECT cron.schedule('nightly-pillar-score', '0 23 * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/nightly-pillar-score',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
--     body := '{}'::jsonb
--   )$$
-- );
-- SELECT cron.schedule('chama-payout', '30 23 * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/chama-payout',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
--     body := '{}'::jsonb
--   )$$
-- );
