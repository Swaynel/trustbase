-- supabase/migrations/003_demo_seed.sql
-- Demo seed data for hackathon judging
-- Run ONLY in development/demo environment — NOT in production

-- ─── Demo governance rules (already seeded in migration 001, this resets) ────
UPDATE governance_rules SET value = '5000' WHERE key = 'max_loan_amount';
UPDATE governance_rules SET value = '2'    WHERE key = 'min_guarantors';
UPDATE governance_rules SET value = '7'    WHERE key = 'loan_grace_days';
UPDATE governance_rules SET value = '3'    WHERE key = 'min_chama_size';
UPDATE governance_rules SET value = '30'   WHERE key = 'max_chama_size';
UPDATE governance_rules SET value = '0.5'  WHERE key = 'agent_fee_pct';

-- ─── Demo open governance vote ────────────────────────────────────────────────
-- (Assumes you have at least one member created via auth signup first)
-- Replace '00000000-0000-0000-0000-000000000000' with an actual member UUID

-- INSERT INTO votes (proposal, proposer_id, status, window_closes_at, yes_weight, no_weight)
-- VALUES (
--   'Increase maximum chama size from 30 to 50 members to allow larger community groups',
--   '00000000-0000-0000-0000-000000000000',
--   'open',
--   NOW() + INTERVAL '3 days',
--   12,
--   4
-- );

-- ─── Demo chama (open for joining) ───────────────────────────────────────────
-- INSERT INTO chamas (name, description, contribution_amount, cycle_days, created_by, status)
-- VALUES (
--   'Nairobi Women''s Circle',
--   'Weekly savings group for women entrepreneurs in Eastleigh',
--   500,
--   30,
--   '00000000-0000-0000-0000-000000000000',
--   'forming'
-- );

-- ─── Notes for demo setup ────────────────────────────────────────────────────
-- 1. Create 3 test accounts via the /login flow using Africa's Talking sandbox numbers
-- 2. Manually set identity_level = 2 for the main demo account:
--    UPDATE members SET identity_level = 2 WHERE display_name = 'Demo User';
-- 3. Manually activate all 3 pillars:
--    UPDATE identity_pillars SET
--      pillar_1_done = true, pillar_1_score = 100,
--      pillar_2_done = true, pillar_2_score = 100, p2_days_present = 30,
--      pillar_3_done = true, pillar_3_score = 100, p3_threads = 5
--    WHERE member_id = (SELECT id FROM members WHERE display_name = 'Demo User');
-- 4. Add some transactions so the activity feed is populated:
--    INSERT INTO transactions (member_id, type, amount, direction) VALUES
--      (..., 'contribution', 500, 'out'),
--      (..., 'chama_payout', 1500, 'in');
-- 5. Create a chama and add demo member to it
-- 6. Create a marketplace listing and trigger Cohere embedding via the API

SELECT 'Demo seed ready. See comments for manual steps.' AS status;
