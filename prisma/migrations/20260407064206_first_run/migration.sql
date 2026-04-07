-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auth_id" UUID,
    "phone_hash" TEXT NOT NULL,
    "identity_level" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT NOT NULL DEFAULT 'member',
    "display_name" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "origin_country" TEXT,
    "origin_region" TEXT,
    "paystack_customer_id" TEXT,
    "paystack_recipient_code" TEXT,
    "cloudinary_profile_id" TEXT,
    "credit_narrative" TEXT,
    "credit_narrative_at" TIMESTAMPTZ(6),
    "internal_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reputation_score" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_pillars" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "pillar_1_score" DECIMAL(5,2) DEFAULT 0,
    "pillar_2_score" DECIMAL(5,2) DEFAULT 0,
    "pillar_3_score" DECIMAL(5,2) DEFAULT 0,
    "pillar_1_done" BOOLEAN NOT NULL DEFAULT false,
    "pillar_2_done" BOOLEAN NOT NULL DEFAULT false,
    "pillar_3_done" BOOLEAN NOT NULL DEFAULT false,
    "p2_days_present" INTEGER DEFAULT 0,
    "p3_threads" INTEGER DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_pillars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "old_level" INTEGER,
    "new_level" INTEGER,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "flag_type" TEXT NOT NULL,
    "confidence" DECIMAL(4,3),
    "reasoning" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origin_corroborations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subject_id" UUID NOT NULL,
    "corroborator_id" UUID NOT NULL,
    "origin_country" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "origin_corroborations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chamas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'forming',
    "contribution_amount" DECIMAL(14,2) NOT NULL,
    "cycle_days" INTEGER NOT NULL DEFAULT 30,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "current_cycle_end" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chamas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chama_members" (
    "chama_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_contributed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payout_received" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "chama_members_pkey" PRIMARY KEY ("chama_id","member_id")
);

-- CreateTable
CREATE TABLE "chama_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chama_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chama_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chama_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paystack_reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "operator_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chama_id" UUID,
    "borrower_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "paystack_reference" TEXT,
    "disbursed_at" TIMESTAMPTZ(6),
    "due_at" TIMESTAMPTZ(6),
    "repaid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guarantees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "loan_id" UUID NOT NULL,
    "guarantor_id" UUID NOT NULL,
    "stake_score" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "accepted" BOOLEAN,
    "outcome" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guarantees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "direction" TEXT NOT NULL,
    "paystack_reference" TEXT,
    "counterpart_id" UUID,
    "operator_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seller_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "cloudinary_public_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "quality_score" DECIMAL(3,1),
    "listing_embedding" vector(1024),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "listing_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paystack_reference" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "raised_by" UUID NOT NULL,
    "description" TEXT,
    "cohere_summary" TEXT,
    "recommended_resolution" TEXT,
    "cohere_confidence" DECIMAL(4,3),
    "resolved_by" UUID,
    "outcome" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proposal" TEXT NOT NULL,
    "proposer_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "window_closes_at" TIMESTAMPTZ(6) NOT NULL,
    "yes_weight" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "no_weight" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "result" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vote_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "choice" TEXT NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_rules" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_rules_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "transfer_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sender_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "destination_city" TEXT NOT NULL,
    "agent_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'open',
    "expires_at" TIMESTAMPTZ(6) NOT NULL DEFAULT (now() + '24:00:00'::interval),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ussd_sessions" (
    "session_id" TEXT NOT NULL,
    "member_id" UUID,
    "phone_hash" TEXT,
    "current_menu" TEXT NOT NULL DEFAULT 'main',
    "pending_data" JSONB,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ussd_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "members_auth_id_key" ON "members"("auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "members_phone_hash_key" ON "members"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "origin_corroborations_subject_id_corroborator_id_key" ON "origin_corroborations"("subject_id", "corroborator_id");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_paystack_reference_key" ON "contributions"("paystack_reference");

-- CreateIndex
CREATE UNIQUE INDEX "orders_paystack_reference_key" ON "orders"("paystack_reference");

-- CreateIndex
CREATE UNIQUE INDEX "vote_responses_vote_id_member_id_key" ON "vote_responses"("vote_id", "member_id");
