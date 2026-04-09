-- TrustBase development seed
-- Usage:
--   supabase db reset
-- or
--   psql "$DIRECT_URL" -f supabase/seed.sql
--
-- Notes:
-- - This is for development/demo data only.
-- - It resets public application tables, but does not touch auth.users.
-- - Seeded members have NULL auth_id by design; link an auth user manually if you
--   want to log in as one of the generated profiles.

BEGIN;

TRUNCATE TABLE
  ussd_sessions,
  transfer_requests,
  vote_responses,
  votes,
  governance_rules,
  disputes,
  orders,
  listings,
  transactions,
  guarantees,
  loans,
  contributions,
  chama_events,
  chama_members,
  chamas,
  origin_corroborations,
  identity_flags,
  identity_events,
  identity_pillars,
  members
RESTART IDENTITY CASCADE;

INSERT INTO governance_rules (key, value) VALUES
  ('max_loan_amount', '5000'),
  ('min_guarantors', '2'),
  ('max_guarantors', '3'),
  ('loan_grace_days', '7'),
  ('min_chama_size', '3'),
  ('max_chama_size', '30'),
  ('agent_fee_pct', '0.5');

CREATE TEMP TABLE seed_members AS
WITH member_base AS (
  SELECT
    gs AS idx,
    ('00000000-0000-4000-8000-' || lpad(to_hex(gs), 12, '0'))::uuid AS id,
    (ARRAY[
      'Amina','Daniel','Grace','Samuel','Mariam','Peter','Esther','Joseph','Halima','David',
      'Ruth','Ibrahim','Mercy','Brian','Joy','Ahmed','Lydia','Kevin','Sarah','Moses'
    ])[1 + ((gs - 1) % 20)] AS first_name,
    (ARRAY[
      'Abdi','Otieno','Mwangi','Kilonzo','Njeri','Okello','Hassan','Kamau','Wanjiku','Achieng',
      'Mutiso','Yusuf','Chebet','Omondi','Ali'
    ])[1 + ((gs - 1) % 15)] AS last_name,
    CASE
      WHEN gs <= 18 THEN 0
      WHEN gs <= 48 THEN 1
      WHEN gs <= 78 THEN 2
      WHEN gs <= 105 THEN 3
      ELSE 4
    END AS identity_level,
    CASE
      WHEN gs IN (110, 117) THEN 'admin'
      WHEN gs IN (52, 67, 84, 101, 114) THEN 'operator'
      ELSE 'member'
    END AS role,
    (ARRAY['en', 'sw', 'fr', 'ar'])[1 + ((gs - 1) % 4)] AS language,
    (ARRAY[
      'Kenya','Uganda','Somalia','South Sudan',
      'DR Congo','Ethiopia','Rwanda','Burundi'
    ])[1 + ((gs - 1) % 8)] AS origin_country,
    (ARRAY[
      'Nairobi','Kampala','Mogadishu','Juba',
      'Goma','Addis Ababa','Kigali','Bujumbura'
    ])[1 + ((gs - 1) % 8)] AS origin_region,
    CASE
      WHEN gs % 14 = 0 AND gs NOT IN (52, 67, 84, 101, 110, 114, 117) THEN false
      ELSE true
    END AS is_active,
    now() - ((15 + (gs * 2))::int * interval '1 day') AS created_at
  FROM generate_series(1, 120) AS gs
)
SELECT
  idx,
  id,
  first_name || ' ' || last_name AS display_name,
  encode(digest('+254700' || lpad(idx::text, 4, '0'), 'sha256'), 'hex') AS phone_hash,
  identity_level,
  role,
  language,
  origin_country,
  origin_region,
  CASE WHEN identity_level >= 2 THEN 'cus_seed_' || lpad(idx::text, 4, '0') END AS paystack_customer_id,
  CASE WHEN identity_level >= 2 AND is_active THEN 'RCP_seed_' || lpad(idx::text, 4, '0') END AS paystack_recipient_code,
  CASE
    WHEN identity_level >= 3 THEN
      first_name || ' has a strong community track record with regular savings activity and trusted peer relationships.'
    ELSE NULL
  END AS credit_narrative,
  CASE WHEN identity_level >= 3 THEN created_at + interval '120 days' ELSE NULL END AS credit_narrative_at,
  round((
    600
    + (identity_level * 950)
    + ((idx * 137) % 3600)
    + CASE WHEN role = 'operator' THEN 6000 WHEN role = 'admin' THEN 9500 ELSE 0 END
  )::numeric, 2) AS internal_balance,
  round(least(98, greatest(24,
    34 + (identity_level * 13) + ((idx * 7) % 17) - CASE WHEN is_active THEN 0 ELSE 11 END
  ))::numeric, 2) AS reputation_score,
  is_active,
  created_at,
  greatest(created_at + interval '1 day', now() - ((greatest(1, idx / 2))::int * interval '1 day')) AS updated_at,
  CASE
    WHEN identity_level >= 3 THEN true
    WHEN identity_level = 2 AND idx % 2 = 0 THEN true
    ELSE false
  END AS pillar_1_done,
  identity_level >= 1 AS pillar_2_done,
  CASE
    WHEN identity_level >= 3 THEN true
    WHEN identity_level = 2 AND idx % 2 = 1 THEN true
    ELSE false
  END AS pillar_3_done,
  CASE
    WHEN identity_level >= 3 THEN 100.00
    WHEN identity_level = 2 AND idx % 2 = 0 THEN 100.00
    WHEN identity_level = 2 THEN 42.00
    WHEN identity_level = 1 THEN 18.00
    ELSE 0.00
  END::numeric(5,2) AS pillar_1_score,
  CASE
    WHEN identity_level >= 4 THEN 100.00
    WHEN identity_level >= 3 THEN 97.00
    WHEN identity_level = 2 THEN 88.00
    WHEN identity_level = 1 THEN 62.00
    ELSE 12.00
  END::numeric(5,2) AS pillar_2_score,
  CASE
    WHEN identity_level >= 3 THEN 100.00
    WHEN identity_level = 2 AND idx % 2 = 1 THEN 100.00
    WHEN identity_level = 2 THEN 54.00
    WHEN identity_level = 1 THEN 24.00
    ELSE 0.00
  END::numeric(5,2) AS pillar_3_score,
  CASE
    WHEN identity_level >= 4 THEN 210
    WHEN identity_level >= 3 THEN 124
    WHEN identity_level = 2 THEN 58
    WHEN identity_level = 1 THEN 22
    ELSE 4
  END AS p2_days_present,
  CASE
    WHEN identity_level >= 4 THEN 22
    WHEN identity_level >= 3 THEN 13
    WHEN identity_level = 2 AND idx % 2 = 1 THEN 7
    WHEN identity_level = 2 THEN 3
    WHEN identity_level = 1 THEN 1
    ELSE 0
  END AS p3_threads
FROM member_base;

INSERT INTO members (
  id,
  auth_id,
  phone_hash,
  identity_level,
  role,
  display_name,
  language,
  origin_country,
  origin_region,
  paystack_customer_id,
  paystack_recipient_code,
  credit_narrative,
  credit_narrative_at,
  internal_balance,
  reputation_score,
  is_active,
  created_at,
  updated_at
)
SELECT
  id,
  NULL,
  phone_hash,
  identity_level,
  role,
  display_name,
  language,
  origin_country,
  origin_region,
  paystack_customer_id,
  paystack_recipient_code,
  credit_narrative,
  credit_narrative_at,
  internal_balance,
  reputation_score,
  is_active,
  created_at,
  updated_at
FROM seed_members;

INSERT INTO identity_pillars (
  id,
  member_id,
  pillar_1_score,
  pillar_2_score,
  pillar_3_score,
  pillar_1_done,
  pillar_2_done,
  pillar_3_done,
  p2_days_present,
  p3_threads,
  updated_at
)
SELECT
  gen_random_uuid(),
  id,
  pillar_1_score,
  pillar_2_score,
  pillar_3_score,
  pillar_1_done,
  pillar_2_done,
  pillar_3_done,
  p2_days_present,
  p3_threads,
  updated_at
FROM seed_members;

INSERT INTO identity_events (id, member_id, old_level, new_level, reason, created_at)
SELECT
  gen_random_uuid(),
  sm.id,
  lvl.level_no - 1,
  lvl.level_no,
  CASE lvl.level_no
    WHEN 1 THEN 'Completed first trust pillar'
    WHEN 2 THEN 'Unlocked community services with second pillar'
    WHEN 3 THEN 'Completed all pillars and earned trusted member status'
    WHEN 4 THEN 'Reached community anchor tenure milestone'
  END,
  LEAST(now() - interval '1 day', sm.created_at + (lvl.level_no * interval '28 days'))
FROM seed_members sm
JOIN LATERAL generate_series(1, sm.identity_level) AS lvl(level_no) ON true;

INSERT INTO origin_corroborations (id, subject_id, corroborator_id, origin_country, created_at)
SELECT
  gen_random_uuid(),
  subject.id,
  corroborator.id,
  subject.origin_country,
  LEAST(now() - interval '1 day', subject.created_at + interval '9 days')
FROM seed_members subject
JOIN LATERAL (
  SELECT candidate.id
  FROM seed_members candidate
  WHERE candidate.id <> subject.id
    AND candidate.is_active
    AND candidate.identity_level >= 2
    AND candidate.origin_country = subject.origin_country
  ORDER BY abs(candidate.idx - subject.idx), candidate.idx
  LIMIT 3
) AS corroborator ON subject.pillar_1_done;

INSERT INTO identity_flags (
  id,
  member_id,
  flag_type,
  confidence,
  reasoning,
  reviewed,
  reviewed_by,
  created_at
)
SELECT
  gen_random_uuid(),
  sm.id,
  CASE WHEN sm.idx % 3 = 0 THEN 'coordinated_fraud' ELSE 'suspicious' END,
  round((0.610 + ((sm.idx % 7) * 0.041))::numeric, 3),
  CASE
    WHEN sm.idx % 3 = 0 THEN 'High overlap in counterparties and mirrored transaction timing.'
    ELSE 'Low diversity of activity compared with peer cohort.'
  END,
  sm.idx % 2 = 0,
  CASE
    WHEN sm.idx % 2 = 0 THEN (
      SELECT reviewer.id
      FROM seed_members reviewer
      WHERE reviewer.role IN ('operator', 'admin')
      ORDER BY reviewer.idx
      OFFSET ((sm.idx - 1) % 7)
      LIMIT 1
    )
    ELSE NULL
  END,
  now() - ((8 + sm.idx)::int * interval '1 day')
FROM seed_members sm
WHERE sm.idx IN (4, 9, 14, 21, 27, 36, 45, 58, 63, 74, 87, 96);

CREATE TEMP TABLE seed_chamas (
  chama_idx integer PRIMARY KEY,
  id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  status text NOT NULL,
  contribution_amount numeric(14,2) NOT NULL,
  cycle_days integer NOT NULL,
  creator_idx integer NOT NULL,
  created_at timestamptz NOT NULL,
  current_cycle_end date
);

INSERT INTO seed_chamas VALUES
  (1,  '00000000-0000-5000-8000-000000000001'::uuid, 'Eastleigh Traders Circle', 'Daily traders saving for stall rent and stock rotation.', 'active', 400.00, 30, 82,  now() - interval '95 days', current_date + 12),
  (2,  '00000000-0000-5000-8000-000000000002'::uuid, 'Kakuma Women Rise', 'Women-led rotating savings for family resilience and school fees.', 'active', 600.00, 30, 86,  now() - interval '120 days', current_date + 9),
  (3,  '00000000-0000-5000-8000-000000000003'::uuid, 'Boda Support Pool', 'Transport workers pooling emergency maintenance capital.', 'active', 500.00, 14, 91,  now() - interval '70 days', current_date + 6),
  (4,  '00000000-0000-5000-8000-000000000004'::uuid, 'Kampala Fresh Foods', 'Cross-border food vendors financing fast restock cycles.', 'forming', 350.00, 21, 94,  now() - interval '24 days', current_date + 18),
  (5,  '00000000-0000-5000-8000-000000000005'::uuid, 'Hope Tailors Chama', 'Tailors and textile sellers building a shared equipment fund.', 'active', 750.00, 30, 97,  now() - interval '135 days', current_date + 15),
  (6,  '00000000-0000-5000-8000-000000000006'::uuid, 'Great Lakes Remit Net', 'Members supporting family remittances and urgent city transfers.', 'payout', 800.00, 30, 99,  now() - interval '160 days', current_date + 3),
  (7,  '00000000-0000-5000-8000-000000000007'::uuid, 'Juba Builders Fund', 'Skilled laborers saving jointly for tools and work mobility.', 'active', 650.00, 21, 102, now() - interval '88 days', current_date + 7),
  (8,  '00000000-0000-5000-8000-000000000008'::uuid, 'Digital Skills Circle', 'Young members pooling resources for devices, bundles, and training.', 'forming', 300.00, 14, 104, now() - interval '19 days', current_date + 11),
  (9,  '00000000-0000-5000-8000-000000000009'::uuid, 'Anchor Families Pool', 'Long-tenure anchors supporting household resilience and funeral cover.', 'closed', 900.00, 30, 107, now() - interval '220 days', current_date - 5),
  (10, '00000000-0000-5000-8000-00000000000a'::uuid, 'Nairobi Service Guild', 'Hairdressers, mechanics, and repair workers rotating contributions.', 'active', 550.00, 30, 109, now() - interval '76 days', current_date + 10),
  (11, '00000000-0000-5000-8000-00000000000b'::uuid, 'Safe Start Mothers Fund', 'Small weekly contributions for medicine, transport, and school needs.', 'payout', 450.00, 14, 112, now() - interval '92 days', current_date + 2),
  (12, '00000000-0000-5000-8000-00000000000c'::uuid, 'Refugee Creatives Loop', 'Craft makers and designers financing raw materials and booth fees.', 'forming', 420.00, 21, 115, now() - interval '28 days', current_date + 16);

INSERT INTO chamas (
  id,
  name,
  description,
  status,
  contribution_amount,
  cycle_days,
  balance,
  created_by,
  current_cycle_end,
  created_at
)
SELECT
  sc.id,
  sc.name,
  sc.description,
  sc.status,
  sc.contribution_amount,
  sc.cycle_days,
  0,
  sm.id,
  sc.current_cycle_end,
  sc.created_at
FROM seed_chamas sc
JOIN seed_members sm ON sm.idx = sc.creator_idx;

INSERT INTO chama_members (chama_id, member_id, joined_at, total_contributed, payout_received)
SELECT
  sc.id,
  sm.id,
  greatest(sc.created_at, sm.created_at) + interval '1 day',
  0,
  false
FROM seed_chamas sc
JOIN seed_members sm
  ON sm.is_active
 AND sm.identity_level >= 1
 AND (
   CASE
     WHEN sc.status = 'forming' THEN ((sm.idx + sc.chama_idx * 3) % 23) IN (0, 1)
     ELSE ((sm.idx + sc.chama_idx * 5) % 17) IN (0, 1)
   END
 )
ON CONFLICT (chama_id, member_id) DO NOTHING;

INSERT INTO chama_members (chama_id, member_id, joined_at, total_contributed, payout_received)
SELECT
  sc.id,
  sm.id,
  greatest(sc.created_at, sm.created_at) + interval '1 day',
  0,
  false
FROM seed_chamas sc
JOIN seed_members sm ON sm.idx = sc.creator_idx
ON CONFLICT (chama_id, member_id) DO NOTHING;

INSERT INTO chama_events (id, chama_id, event_type, metadata, created_at)
SELECT
  gen_random_uuid(),
  sc.id,
  'created',
  jsonb_build_object('status', sc.status, 'created_by_idx', sc.creator_idx),
  sc.created_at
FROM seed_chamas sc;

INSERT INTO chama_events (id, chama_id, event_type, metadata, created_at)
SELECT
  gen_random_uuid(),
  sc.id,
  CASE
    WHEN sc.status = 'payout' THEN 'payout_window_opened'
    WHEN sc.status = 'closed' THEN 'cycle_closed'
    ELSE 'cycle_started'
  END,
  jsonb_build_object('cycle_days', sc.cycle_days),
  sc.created_at + interval '14 days'
FROM seed_chamas sc
WHERE sc.status IN ('active', 'payout', 'closed');

INSERT INTO contributions (
  id,
  chama_id,
  member_id,
  amount,
  paystack_reference,
  status,
  operator_id,
  created_at
)
SELECT
  gen_random_uuid(),
  cm.chama_id,
  cm.member_id,
  sc.contribution_amount,
  format('seed_ctr_%s_%s_%s', sc.chama_idx, right(replace(cm.member_id::text, '-', ''), 6), cycle_no.cycle_no),
  CASE
    WHEN cycle_no.cycle_no = cycles.max_cycles AND (sm.idx + sc.chama_idx) % 13 = 0 THEN 'pending'
    WHEN cycle_no.cycle_no = 1 AND (sm.idx + sc.chama_idx) % 19 = 0 THEN 'failed'
    ELSE 'success'
  END,
  (
    SELECT op.id
    FROM seed_members op
    WHERE op.role = 'operator'
    ORDER BY abs(op.idx - sm.idx), op.idx
    LIMIT 1
  ),
  LEAST(now() - interval '2 hours', cm.joined_at + ((cycle_no.cycle_no * greatest(7, sc.cycle_days / 2))::int * interval '1 day'))
FROM chama_members cm
JOIN seed_chamas sc ON sc.id = cm.chama_id
JOIN seed_members sm ON sm.id = cm.member_id
JOIN LATERAL (
  SELECT
    CASE
      WHEN sc.status = 'active' THEN 3 + ((sm.idx + sc.chama_idx) % 2)
      WHEN sc.status = 'payout' THEN 4
      WHEN sc.status = 'closed' THEN 5
      ELSE 0
    END AS max_cycles
) cycles ON true
JOIN LATERAL generate_series(1, cycles.max_cycles) AS cycle_no(cycle_no) ON cycles.max_cycles > 0;

UPDATE chama_members cm
SET total_contributed = totals.total_contributed
FROM (
  SELECT
    chama_id,
    member_id,
    round(coalesce(sum(amount), 0), 2) AS total_contributed
  FROM contributions
  WHERE status = 'success'
  GROUP BY chama_id, member_id
) totals
WHERE cm.chama_id = totals.chama_id
  AND cm.member_id = totals.member_id;

UPDATE chama_members cm
SET payout_received = true
FROM (
  SELECT
    cm2.chama_id,
    cm2.member_id
  FROM chama_members cm2
  JOIN seed_chamas sc ON sc.id = cm2.chama_id
  JOIN seed_members sm ON sm.id = cm2.member_id
  WHERE sc.status IN ('payout', 'closed')
    AND ((sm.idx + sc.chama_idx) % 5 = 0)
) marked
WHERE cm.chama_id = marked.chama_id
  AND cm.member_id = marked.member_id;

UPDATE chamas c
SET balance = round(
  coalesce(t.success_total, 0)
  * CASE c.status
      WHEN 'payout' THEN 0.38
      WHEN 'closed' THEN 0.06
      ELSE 1
    END,
  2
)
FROM (
  SELECT chama_id, sum(amount) AS success_total
  FROM contributions
  WHERE status = 'success'
  GROUP BY chama_id
) t
WHERE c.id = t.chama_id;

CREATE TEMP TABLE seed_loans AS
WITH eligible AS (
  SELECT
    row_number() OVER (ORDER BY cm.chama_id, cm.member_id) AS loan_idx,
    cm.chama_id,
    cm.member_id AS borrower_id,
    sm.idx AS borrower_idx
  FROM chama_members cm
  JOIN seed_members sm ON sm.id = cm.member_id
  JOIN seed_chamas sc ON sc.id = cm.chama_id
  WHERE sm.identity_level >= 2
    AND sm.is_active
    AND sc.status IN ('active', 'payout', 'closed')
)
SELECT
  loan_idx,
  ('00000000-0000-6000-8000-' || lpad(to_hex(loan_idx), 12, '0'))::uuid AS id,
  chama_id,
  borrower_id,
  borrower_idx,
  round((1200 + (loan_idx * 275))::numeric, 2) AS amount,
  (ARRAY[
    'Stock replenishment for weekly sales',
    'School fees bridge support',
    'Medical transport and medicine',
    'Tool purchase for new contract',
    'Working capital for food kiosk',
    'Short-term rent support'
  ])[1 + ((loan_idx - 1) % 6)] AS purpose,
  CASE
    WHEN loan_idx BETWEEN 1 AND 3 THEN 'guaranteeing'
    WHEN loan_idx BETWEEN 4 AND 5 THEN 'approved'
    WHEN loan_idx BETWEEN 6 AND 10 THEN 'disbursed'
    WHEN loan_idx BETWEEN 11 AND 13 THEN 'repaid'
    WHEN loan_idx BETWEEN 14 AND 15 THEN 'defaulted'
    ELSE 'requested'
  END AS status,
  now() - ((75 - loan_idx * 3)::int * interval '1 day') AS created_at
FROM eligible
WHERE loan_idx <= 18;

INSERT INTO loans (
  id,
  chama_id,
  borrower_id,
  amount,
  purpose,
  status,
  paystack_reference,
  disbursed_at,
  due_at,
  repaid_at,
  created_at
)
SELECT
  sl.id,
  sl.chama_id,
  sl.borrower_id,
  sl.amount,
  sl.purpose,
  sl.status,
  CASE
    WHEN sl.status IN ('approved', 'disbursed', 'repaid', 'defaulted') THEN 'seed_loan_' || lpad(sl.loan_idx::text, 3, '0')
    ELSE NULL
  END,
  CASE
    WHEN sl.status IN ('disbursed', 'repaid', 'defaulted') THEN sl.created_at + interval '3 days'
    ELSE NULL
  END,
  CASE
    WHEN sl.status IN ('approved', 'disbursed', 'repaid', 'defaulted', 'guaranteeing') THEN sl.created_at + interval '33 days'
    ELSE NULL
  END,
  CASE
    WHEN sl.status = 'repaid' THEN sl.created_at + interval '24 days'
    ELSE NULL
  END,
  sl.created_at
FROM seed_loans sl;

INSERT INTO guarantees (
  id,
  loan_id,
  guarantor_id,
  stake_score,
  accepted,
  outcome,
  created_at
)
SELECT
  gen_random_uuid(),
  sl.id,
  picked.member_id,
  CASE WHEN guarantor.identity_level >= 4 THEN 15.00 ELSE 10.00 END,
  CASE
    WHEN sl.status = 'requested' THEN false
    WHEN sl.status = 'guaranteeing' THEN CASE WHEN picked.rn = 1 THEN true ELSE NULL END
    WHEN sl.status = 'approved' THEN CASE WHEN picked.rn <= 2 THEN true ELSE NULL END
    WHEN sl.status IN ('disbursed', 'repaid', 'defaulted') THEN true
    ELSE NULL
  END,
  CASE
    WHEN sl.status = 'repaid' THEN 'returned'
    WHEN sl.status = 'defaulted' THEN 'deducted'
    ELSE NULL
  END,
  sl.created_at + (picked.rn::int * interval '1 day')
FROM seed_loans sl
JOIN LATERAL (
  SELECT *
  FROM (
    SELECT
      cm.member_id,
      row_number() OVER (ORDER BY abs(sm.idx - sl.borrower_idx), sm.idx) AS rn
    FROM chama_members cm
    JOIN seed_members sm ON sm.id = cm.member_id
    WHERE cm.chama_id = sl.chama_id
      AND cm.member_id <> sl.borrower_id
      AND sm.identity_level >= 2
      AND sm.is_active
  ) ranked
  WHERE rn <= CASE WHEN sl.loan_idx % 2 = 0 THEN 2 ELSE 3 END
) picked ON true
JOIN seed_members guarantor ON guarantor.id = picked.member_id;

INSERT INTO transactions (
  id,
  member_id,
  type,
  amount,
  direction,
  paystack_reference,
  counterpart_id,
  operator_id,
  metadata,
  created_at
)
SELECT
  gen_random_uuid(),
  c.member_id,
  'contribution',
  c.amount,
  'out',
  c.paystack_reference,
  NULL,
  c.operator_id,
  jsonb_build_object('chama_id', c.chama_id, 'contribution_id', c.id),
  c.created_at
FROM contributions c
WHERE c.status = 'success';

INSERT INTO transactions (
  id,
  member_id,
  type,
  amount,
  direction,
  counterpart_id,
  metadata,
  created_at
)
SELECT
  gen_random_uuid(),
  cm.member_id,
  'chama_payout',
  round(sc.contribution_amount * (2.8 + ((sm.idx + sc.chama_idx) % 3))::numeric, 2),
  'in',
  NULL,
  jsonb_build_object('chama_id', cm.chama_id, 'cycle_status', sc.status),
  now() - ((2 + sc.chama_idx)::int * interval '1 day')
FROM chama_members cm
JOIN seed_chamas sc ON sc.id = cm.chama_id
JOIN seed_members sm ON sm.id = cm.member_id
WHERE cm.payout_received
  AND sc.status IN ('payout', 'closed');

INSERT INTO transactions (
  id,
  member_id,
  type,
  amount,
  direction,
  paystack_reference,
  metadata,
  created_at
)
SELECT
  gen_random_uuid(),
  l.borrower_id,
  'loan_disbursement',
  l.amount,
  'in',
  l.paystack_reference,
  jsonb_build_object('loan_id', l.id, 'chama_id', l.chama_id),
  l.disbursed_at
FROM loans l
WHERE l.status IN ('disbursed', 'repaid', 'defaulted');

INSERT INTO transactions (
  id,
  member_id,
  type,
  amount,
  direction,
  metadata,
  created_at
)
SELECT
  gen_random_uuid(),
  l.borrower_id,
  'loan_repayment',
  l.amount,
  'out',
  jsonb_build_object('loan_id', l.id, 'status', l.status),
  l.repaid_at
FROM loans l
WHERE l.status = 'repaid';

CREATE TEMP TABLE seed_listings AS
WITH eligible_sellers AS (
  SELECT
    row_number() OVER (ORDER BY idx) AS listing_idx,
    id AS seller_id,
    idx AS seller_idx
  FROM seed_members
  WHERE identity_level >= 2
    AND is_active
)
SELECT
  listing_idx,
  ('00000000-0000-7000-8000-' || lpad(to_hex(listing_idx), 12, '0'))::uuid AS id,
  seller_id,
  seller_idx,
  (ARRAY['food', 'clothing', 'services', 'electronics', 'crafts', 'other'])[1 + ((listing_idx - 1) % 6)] AS category,
  CASE
    WHEN listing_idx <= 22 THEN 'active'
    WHEN listing_idx <= 30 THEN 'sold'
    WHEN listing_idx <= 33 THEN 'pending'
    ELSE 'suspended'
  END AS status,
  round((350 + (listing_idx * 145))::numeric, 2) AS price,
  round((6.8 + ((listing_idx % 10) * 0.3))::numeric, 1) AS quality_score,
  now() - ((50 - listing_idx)::int * interval '1 day') AS created_at
FROM eligible_sellers
WHERE listing_idx <= 36;

INSERT INTO listings (
  id,
  seller_id,
  title,
  description,
  category,
  price,
  cloudinary_public_id,
  status,
  quality_score,
  created_at
)
SELECT
  sl.id,
  sl.seller_id,
  CASE sl.category
    WHEN 'food' THEN (ARRAY['Fresh maize flour','Family spice pack','Dried beans bundle','Chapati order set'])[1 + ((sl.listing_idx - 1) % 4)]
    WHEN 'clothing' THEN (ARRAY['School uniform repair','Second-hand coats pack','Tailored kitenge dress','Children sweater set'])[1 + ((sl.listing_idx - 1) % 4)]
    WHEN 'services' THEN (ARRAY['Phone charging service','Hair braiding session','Motorbike delivery run','Document translation help'])[1 + ((sl.listing_idx - 1) % 4)]
    WHEN 'electronics' THEN (ARRAY['Used Android handset','Solar lamp kit','Phone charger bundle','Small radio set'])[1 + ((sl.listing_idx - 1) % 4)]
    WHEN 'crafts' THEN (ARRAY['Beaded bracelet set','Handmade basket','Decor wall weave','Custom tote bag'])[1 + ((sl.listing_idx - 1) % 4)]
    ELSE (ARRAY['Household starter pack','Storage crate set','Reusable water can','Cooking utensil mix'])[1 + ((sl.listing_idx - 1) % 4)]
  END,
  CASE sl.category
    WHEN 'food' THEN 'Reliable staple food supply prepared by trusted local sellers.'
    WHEN 'clothing' THEN 'Affordable clothing support for families and school-going children.'
    WHEN 'services' THEN 'Practical day-to-day service delivered inside the community network.'
    WHEN 'electronics' THEN 'Essential low-cost device or energy accessory for work and study.'
    WHEN 'crafts' THEN 'Handmade item produced by a verified member of the creatives loop.'
    ELSE 'Useful household goods circulating within the trusted marketplace.'
  END,
  sl.category,
  sl.price,
  NULL,
  sl.status,
  sl.quality_score,
  sl.created_at
FROM seed_listings sl;

CREATE TEMP TABLE seed_orders AS
WITH listing_pool AS (
  SELECT
    row_number() OVER (ORDER BY sl.listing_idx) AS order_idx,
    sl.*
  FROM seed_listings sl
  WHERE sl.status IN ('sold', 'active')
  LIMIT 12
)
SELECT
  lp.order_idx,
  ('00000000-0000-7100-8000-' || lpad(to_hex(lp.order_idx), 12, '0'))::uuid AS id,
  lp.id AS listing_id,
  buyer.id AS buyer_id,
  lp.seller_id,
  lp.price AS amount,
  CASE
    WHEN lp.order_idx <= 3 THEN 'completed'
    WHEN lp.order_idx <= 5 THEN 'paid'
    WHEN lp.order_idx <= 7 THEN 'disputed'
    WHEN lp.order_idx <= 9 THEN 'cancelled'
    ELSE 'pending'
  END AS status,
  CASE
    WHEN lp.order_idx <= 7 THEN 'seed_order_' || lpad(lp.order_idx::text, 3, '0')
    ELSE NULL
  END AS paystack_reference,
  lp.created_at + interval '4 days' AS created_at
FROM listing_pool lp
JOIN LATERAL (
  SELECT sm.id
  FROM seed_members sm
  WHERE sm.id <> lp.seller_id
    AND sm.identity_level >= 2
    AND sm.is_active
  ORDER BY abs(sm.idx - lp.seller_idx) DESC, sm.idx
  LIMIT 1
) AS buyer ON true;

INSERT INTO orders (
  id,
  listing_id,
  buyer_id,
  seller_id,
  amount,
  status,
  paystack_reference,
  created_at
)
SELECT
  id,
  listing_id,
  buyer_id,
  seller_id,
  amount,
  status,
  paystack_reference,
  created_at
FROM seed_orders;

INSERT INTO disputes (
  id,
  order_id,
  raised_by,
  description,
  cohere_summary,
  recommended_resolution,
  cohere_confidence,
  resolved_by,
  outcome,
  created_at
)
SELECT
  gen_random_uuid(),
  so.id,
  CASE WHEN so.order_idx % 2 = 0 THEN so.buyer_id ELSE so.seller_id END,
  CASE
    WHEN so.order_idx % 2 = 0 THEN 'Buyer reports delivery delay and missing item quantity.'
    ELSE 'Seller reports buyer disputed after confirming collection.'
  END,
  'Order needs moderator review due to conflicting pickup and delivery narratives.',
  CASE
    WHEN so.order_idx = 6 THEN 'partial_refund'
    WHEN so.order_idx = 7 THEN 'refund_buyer'
    ELSE 'escalate'
  END,
  round((0.710 + (so.order_idx * 0.021))::numeric, 3),
  CASE
    WHEN so.order_idx = 6 THEN (SELECT id FROM seed_members WHERE role = 'admin' ORDER BY idx LIMIT 1)
    ELSE NULL
  END,
  CASE
    WHEN so.order_idx = 6 THEN 'Seller issued partial refund after moderator review.'
    ELSE NULL
  END,
  so.created_at + interval '2 days'
FROM seed_orders so
WHERE so.status = 'disputed';

INSERT INTO transactions (
  id,
  member_id,
  type,
  amount,
  direction,
  paystack_reference,
  counterpart_id,
  metadata,
  created_at
)
SELECT
  gen_random_uuid(),
  so.buyer_id,
  'marketplace_payment',
  so.amount,
  'out',
  so.paystack_reference,
  so.seller_id,
  jsonb_build_object('order_id', so.id, 'listing_id', so.listing_id),
  so.created_at
FROM seed_orders so
WHERE so.status IN ('paid', 'completed', 'disputed');

INSERT INTO transactions (
  id,
  member_id,
  type,
  amount,
  direction,
  paystack_reference,
  counterpart_id,
  metadata,
  created_at
)
SELECT
  gen_random_uuid(),
  so.seller_id,
  'marketplace_payout',
  so.amount,
  'in',
  so.paystack_reference,
  so.buyer_id,
  jsonb_build_object('order_id', so.id, 'listing_id', so.listing_id),
  so.created_at + interval '1 day'
FROM seed_orders so
WHERE so.status IN ('paid', 'completed');

CREATE TEMP TABLE seed_votes (
  vote_idx integer PRIMARY KEY,
  id uuid NOT NULL,
  proposal text NOT NULL,
  proposer_idx integer NOT NULL,
  status text NOT NULL,
  window_closes_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);

INSERT INTO seed_votes VALUES
  (1, '00000000-0000-8000-8000-000000000001'::uuid, 'Increase the maximum chama size from 30 to 40 members for urban trading clusters.', 108, 'open',   now() + interval '5 days',  now() - interval '2 days'),
  (2, '00000000-0000-8000-8000-000000000002'::uuid, 'Set aside 5 percent of monthly marketplace fees for emergency medical grants.',      111, 'open',   now() + interval '8 days',  now() - interval '1 day'),
  (3, '00000000-0000-8000-8000-000000000003'::uuid, 'Raise the standard loan grace period from 7 to 10 days.',                             113, 'closed', now() - interval '4 days',  now() - interval '11 days'),
  (4, '00000000-0000-8000-8000-000000000004'::uuid, 'Reduce the default agent fee from 0.5 percent to 0.4 percent for low-value transfers.', 116, 'closed', now() - interval '9 days',  now() - interval '16 days');

INSERT INTO votes (
  id,
  proposal,
  proposer_id,
  status,
  window_closes_at,
  yes_weight,
  no_weight,
  result,
  created_at
)
SELECT
  sv.id,
  sv.proposal,
  sm.id,
  sv.status,
  sv.window_closes_at,
  0,
  0,
  NULL,
  sv.created_at
FROM seed_votes sv
JOIN seed_members sm ON sm.idx = sv.proposer_idx;

INSERT INTO vote_responses (id, vote_id, member_id, choice, weight, created_at)
SELECT
  gen_random_uuid(),
  sv.id,
  sm.id,
  CASE
    WHEN ((sm.idx + sv.vote_idx * 2) % 5) IN (0, 1, 2) THEN 'yes'
    ELSE 'no'
  END,
  CASE
    WHEN sm.identity_level = 4 THEN 3
    ELSE sm.identity_level
  END,
  sv.created_at + ((8 + ((sm.idx + sv.vote_idx) % 72))::int * interval '1 hour')
FROM seed_votes sv
JOIN seed_members sm
  ON sm.is_active
 AND sm.identity_level > 0
 AND ((sm.idx + sv.vote_idx) % 4 <> 0);

UPDATE votes v
SET
  yes_weight = tally.yes_weight,
  no_weight = tally.no_weight,
  result = CASE
    WHEN v.status = 'closed' AND tally.yes_weight >= tally.no_weight THEN 'passed'
    WHEN v.status = 'closed' THEN 'failed'
    ELSE NULL
  END
FROM (
  SELECT
    vote_id,
    round(sum(CASE WHEN choice = 'yes' THEN weight ELSE 0 END), 2) AS yes_weight,
    round(sum(CASE WHEN choice = 'no' THEN weight ELSE 0 END), 2) AS no_weight
  FROM vote_responses
  GROUP BY vote_id
) tally
WHERE v.id = tally.vote_id;

CREATE TEMP TABLE seed_transfers AS
WITH eligible AS (
  SELECT
    row_number() OVER (ORDER BY idx) AS transfer_idx,
    id AS sender_id,
    idx AS sender_idx
  FROM seed_members
  WHERE identity_level >= 2
    AND is_active
    AND role = 'member'
)
SELECT
  transfer_idx,
  ('00000000-0000-9000-8000-' || lpad(to_hex(transfer_idx), 12, '0'))::uuid AS id,
  sender_id,
  sender_idx,
  round((450 + (transfer_idx * 120))::numeric, 2) AS amount,
  (ARRAY[
    'Nairobi','Kampala','Mombasa','Kisumu','Eldoret','Gulu','Kigali','Juba'
  ])[1 + ((transfer_idx - 1) % 8)] AS destination_city,
  CASE
    WHEN transfer_idx <= 5 THEN 'open'
    WHEN transfer_idx <= 8 THEN 'matched'
    WHEN transfer_idx <= 12 THEN 'completed'
    WHEN transfer_idx <= 14 THEN 'expired'
    ELSE 'cancelled'
  END AS status,
  now() - ((12 - transfer_idx)::int * interval '1 day') AS created_at
FROM eligible
WHERE transfer_idx <= 16;

INSERT INTO transfer_requests (
  id,
  sender_id,
  amount,
  destination_city,
  agent_id,
  status,
  expires_at,
  created_at
)
SELECT
  st.id,
  st.sender_id,
  st.amount,
  st.destination_city,
  CASE
    WHEN st.status IN ('matched', 'completed') THEN (
      SELECT op.id
      FROM seed_members op
      WHERE op.role IN ('operator', 'admin')
      ORDER BY op.internal_balance DESC, op.idx
      OFFSET ((st.transfer_idx - 1) % 5)
      LIMIT 1
    )
    ELSE NULL
  END,
  st.status,
  CASE
    WHEN st.status = 'expired' THEN st.created_at + interval '6 hours'
    ELSE st.created_at + interval '24 hours'
  END,
  st.created_at
FROM seed_transfers st;

INSERT INTO transactions (
  id,
  member_id,
  type,
  amount,
  direction,
  metadata,
  created_at
)
SELECT
  gen_random_uuid(),
  tr.sender_id,
  'transfer_sent',
  tr.amount,
  'out',
  jsonb_build_object('transfer_id', tr.id, 'destination_city', tr.destination_city),
  tr.created_at
FROM transfer_requests tr;

INSERT INTO transactions (
  id,
  member_id,
  type,
  amount,
  direction,
  metadata,
  created_at
)
SELECT
  gen_random_uuid(),
  tr.agent_id,
  'agent_fee',
  round((tr.amount * 0.005)::numeric, 2),
  'in',
  jsonb_build_object('transfer_id', tr.id),
  tr.created_at + interval '1 hour'
FROM transfer_requests tr
WHERE tr.agent_id IS NOT NULL;

INSERT INTO transactions (
  id,
  member_id,
  type,
  amount,
  direction,
  metadata,
  created_at
)
SELECT
  gen_random_uuid(),
  tr.agent_id,
  'transfer_received',
  tr.amount,
  'out',
  jsonb_build_object('transfer_id', tr.id),
  tr.created_at + interval '5 hours'
FROM transfer_requests tr
WHERE tr.status = 'completed'
  AND tr.agent_id IS NOT NULL;

INSERT INTO transactions (
  id,
  member_id,
  type,
  amount,
  direction,
  metadata,
  created_at
)
SELECT
  gen_random_uuid(),
  sm.id,
  CASE WHEN sm.idx % 2 = 0 THEN 'investment' ELSE 'dividend' END,
  round((120 + ((sm.idx % 9) * 35))::numeric, 2),
  CASE WHEN sm.idx % 2 = 0 THEN 'out' ELSE 'in' END,
  jsonb_build_object('program', 'community_pool'),
  now() - ((3 + (sm.idx % 18))::int * interval '1 day')
FROM seed_members sm
WHERE sm.identity_level >= 3
  AND sm.is_active
  AND sm.idx % 6 = 0;

INSERT INTO ussd_sessions (
  session_id,
  member_id,
  phone_hash,
  current_menu,
  pending_data,
  updated_at
)
SELECT
  'seed-session-' || lpad(sm.idx::text, 3, '0'),
  sm.id,
  sm.phone_hash,
  (ARRAY['main', 'identity', 'savings', 'vote'])[1 + ((sm.idx - 1) % 4)],
  jsonb_build_object('language', sm.language, 'level', sm.identity_level),
  now() - ((sm.idx)::int * interval '1 minute')
FROM seed_members sm
WHERE sm.idx IN (22, 37, 54, 72, 101, 118);

COMMIT;
