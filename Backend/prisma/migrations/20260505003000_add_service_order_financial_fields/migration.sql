-- Garante campos financeiros e de identificação de lote na OS
ALTER TABLE "ServiceOrder"
  ADD COLUMN IF NOT EXISTS "partCode" TEXT,
  ADD COLUMN IF NOT EXISTS "batchCode" TEXT,
  ADD COLUMN IF NOT EXISTS "profitPercent" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxPercent" DOUBLE PRECISION DEFAULT 0;

UPDATE "ServiceOrder"
SET "profitPercent" = COALESCE("profitPercent", 0),
    "taxPercent" = COALESCE("taxPercent", 0)
WHERE "profitPercent" IS NULL OR "taxPercent" IS NULL;
