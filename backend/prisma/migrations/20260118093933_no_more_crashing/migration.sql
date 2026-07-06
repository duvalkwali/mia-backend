-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "StyleTone" AS ENUM ('FRIENDLY', 'PROFESSIONAL', 'PLAYFUL', 'PREMIUM');

-- CreateEnum
CREATE TYPE "EmojiUsage" AS ENUM ('NONE', 'LIGHT', 'FREQUENT');

-- CreateEnum
CREATE TYPE "HumorLevel" AS ENUM ('OFF', 'PLAYFUL', 'SARCASTIC');

-- CreateEnum
CREATE TYPE "SentenceLength" AS ENUM ('SHORT', 'MEDIUM', 'LONG');

-- CreateEnum
CREATE TYPE "CTAStyle" AS ENUM ('DIRECT', 'SOFT', 'CONSULTATIVE');

-- CreateEnum
CREATE TYPE "LearningEventType" AS ENUM ('APPROVAL', 'EDIT', 'REJECTION');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('WHATSAPP', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "Intent" AS ENUM ('PRICING', 'AVAILABILITY', 'OBJECTION', 'BOOKING', 'QUESTION', 'GREETING', 'COMPLAINT', 'FOLLOWUP');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'HESITANT', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "FunnelStage" AS ENUM ('LEAD', 'INTERESTED', 'NEGOTIATING', 'CLOSED', 'CHURNED');

-- CreateEnum
CREATE TYPE "ReplyStatus" AS ENUM ('PENDING', 'APPROVED', 'EDITED', 'REJECTED', 'SENT');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pricingRanges" JSONB NOT NULL,
    "primaryGoals" TEXT[],
    "constraints" JSONB,
    "allowedClaims" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "tags" TEXT[],
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isEmbedded" BOOLEAN NOT NULL DEFAULT false,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "embeddedAt" TIMESTAMP(3),
    "manuallyApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tone" "StyleTone" NOT NULL,
    "emojiUsage" "EmojiUsage" NOT NULL,
    "humorLevel" "HumorLevel" NOT NULL,
    "formality" INTEGER NOT NULL,
    "sentenceLengthPref" "SentenceLength" NOT NULL,
    "ctaStyle" "CTAStyle" NOT NULL,
    "signaturePhrases" TEXT[],
    "vocabularyPreferences" JSONB,
    "conversationGoal" TEXT NOT NULL,
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "approvalCount" INTEGER NOT NULL DEFAULT 0,
    "rejectionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_learning_events" (
    "id" TEXT NOT NULL,
    "styleProfileId" TEXT NOT NULL,
    "eventType" "LearningEventType" NOT NULL,
    "originalReply" TEXT,
    "editedReply" TEXT,
    "extractedPatterns" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "style_learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_signals" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "intent" "Intent" NOT NULL,
    "sentiment" "Sentiment" NOT NULL,
    "urgency" "Urgency" NOT NULL,
    "funnelStage" "FunnelStage" NOT NULL,
    "keyTopics" TEXT[],
    "questionsAsked" TEXT[],
    "objectionsRaised" TEXT[],
    "extractionMethod" TEXT NOT NULL DEFAULT 'rules',
    "extractionCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_replies" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "generatedText" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "ReplyStatus" NOT NULL DEFAULT 'PENDING',
    "editedText" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "promptVersion" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "generationCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_tracking" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_email_key" ON "tenants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "businesses_tenantId_key" ON "businesses"("tenantId");

-- CreateIndex
CREATE INDEX "faqs_businessId_idx" ON "faqs"("businessId");

-- CreateIndex
CREATE INDEX "faqs_tags_idx" ON "faqs" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "faqs_businessId_isEmbedded_idx" ON "faqs"("businessId", "isEmbedded");

-- CreateIndex
CREATE INDEX "faqs_businessId_usageCount_idx" ON "faqs"("businessId", "usageCount");

-- CreateIndex
CREATE UNIQUE INDEX "style_profiles_tenantId_key" ON "style_profiles"("tenantId");

-- CreateIndex
CREATE INDEX "style_learning_events_styleProfileId_createdAt_idx" ON "style_learning_events"("styleProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "contacts_tenantId_platform_idx" ON "contacts"("tenantId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenantId_externalId_platform_key" ON "contacts"("tenantId", "externalId", "platform");

-- CreateIndex
CREATE INDEX "contact_signals_contactId_extractedAt_idx" ON "contact_signals"("contactId", "extractedAt");

-- CreateIndex
CREATE INDEX "generated_replies_contactId_status_idx" ON "generated_replies"("contactId", "status");

-- CreateIndex
CREATE INDEX "generated_replies_createdAt_idx" ON "generated_replies"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "cost_tracking_tenantId_timestamp_idx" ON "cost_tracking"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "cost_tracking_operation_timestamp_idx" ON "cost_tracking"("operation", "timestamp");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_profiles" ADD CONSTRAINT "style_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_learning_events" ADD CONSTRAINT "style_learning_events_styleProfileId_fkey" FOREIGN KEY ("styleProfileId") REFERENCES "style_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_signals" ADD CONSTRAINT "contact_signals_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
