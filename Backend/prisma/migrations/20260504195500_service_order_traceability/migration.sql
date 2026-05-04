ALTER TABLE "ServiceOrder"
ADD COLUMN IF NOT EXISTS "traceCode" TEXT,
ADD COLUMN IF NOT EXISTS "partCode" TEXT,
ADD COLUMN IF NOT EXISTS "batchCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceOrder_traceCode_key" ON "ServiceOrder"("traceCode");

CREATE TABLE IF NOT EXISTS "ServiceOrderTrace" (
  "id" SERIAL NOT NULL,
  "serviceOrderId" INTEGER,
  "serviceOrderCode" TEXT,
  "action" TEXT NOT NULL,
  "changedByUserId" INTEGER,
  "changedByEmail" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceOrderTrace_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ServiceOrderTrace_serviceOrderId_idx" ON "ServiceOrderTrace"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "ServiceOrderTrace_createdAt_idx" ON "ServiceOrderTrace"("createdAt");

ALTER TABLE "ServiceOrderTrace"
ADD CONSTRAINT "ServiceOrderTrace_serviceOrderId_fkey"
FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceOrderTrace"
ADD CONSTRAINT "ServiceOrderTrace_changedByUserId_fkey"
FOREIGN KEY ("changedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;