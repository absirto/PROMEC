CREATE TABLE IF NOT EXISTS "PurchaseRequest" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "serviceOrderId" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "requestedByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseRequest_code_key" ON "PurchaseRequest"("code");
CREATE INDEX IF NOT EXISTS "PurchaseRequest_serviceOrderId_idx" ON "PurchaseRequest"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

CREATE TABLE IF NOT EXISTS "PurchaseRequestItem" (
  "id" SERIAL NOT NULL,
  "purchaseRequestId" INTEGER NOT NULL,
  "materialId" INTEGER NOT NULL,
  "requestedQty" DOUBLE PRECISION NOT NULL,
  "stockQty" DOUBLE PRECISION NOT NULL,
  "shortageQty" DOUBLE PRECISION NOT NULL,
  "unit" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PurchaseRequestItem_purchaseRequestId_idx" ON "PurchaseRequestItem"("purchaseRequestId");
CREATE INDEX IF NOT EXISTS "PurchaseRequestItem_materialId_idx" ON "PurchaseRequestItem"("materialId");

ALTER TABLE "PurchaseRequest"
ADD CONSTRAINT "PurchaseRequest_serviceOrderId_fkey"
FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequestItem"
ADD CONSTRAINT "PurchaseRequestItem_purchaseRequestId_fkey"
FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseRequestItem"
ADD CONSTRAINT "PurchaseRequestItem_materialId_fkey"
FOREIGN KEY ("materialId") REFERENCES "Material"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
