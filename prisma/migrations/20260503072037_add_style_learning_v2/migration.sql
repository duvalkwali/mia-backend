-- CreateTable
CREATE TABLE "learned_style_rules" (
    "id" TEXT NOT NULL,
    "styleProfileId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "trigger" TEXT,
    "ruleHash" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "exampleCount" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learned_style_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generic_avoid_phrases" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "variants" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generic_avoid_phrases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learned_style_rules_styleProfileId_active_idx" ON "learned_style_rules"("styleProfileId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "learned_style_rules_styleProfileId_ruleHash_key" ON "learned_style_rules"("styleProfileId", "ruleHash");

-- CreateIndex
CREATE UNIQUE INDEX "generic_avoid_phrases_key_key" ON "generic_avoid_phrases"("key");

-- AddForeignKey
ALTER TABLE "learned_style_rules" ADD CONSTRAINT "learned_style_rules_styleProfileId_fkey" FOREIGN KEY ("styleProfileId") REFERENCES "style_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
