CREATE TABLE IF NOT EXISTS "PurchaseQuotation" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "purchaseRequestId" INTEGER NOT NULL,
  "supplierPersonId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "validUntil" TIMESTAMP(3),
  "createdByEmail" TEXT,
  "approvedByEmail" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseQuotation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseQuotation_code_key" ON "PurchaseQuotation"("code");
CREATE INDEX IF NOT EXISTS "PurchaseQuotation_purchaseRequestId_idx" ON "PurchaseQuotation"("purchaseRequestId");
CREATE INDEX IF NOT EXISTS "PurchaseQuotation_supplierPersonId_idx" ON "PurchaseQuotation"("supplierPersonId");
CREATE INDEX IF NOT EXISTS "PurchaseQuotation_status_idx" ON "PurchaseQuotation"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseQuotation_purchaseRequestId_fkey'
  ) THEN
    ALTER TABLE "PurchaseQuotation"
    ADD CONSTRAINT "PurchaseQuotation_purchaseRequestId_fkey"
    FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseQuotation_supplierPersonId_fkey'
  ) THEN
    ALTER TABLE "PurchaseQuotation"
    ADD CONSTRAINT "PurchaseQuotation_supplierPersonId_fkey"
    FOREIGN KEY ("supplierPersonId") REFERENCES "Person"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PurchaseQuotationItem" (
  "id" SERIAL NOT NULL,
  "quotationId" INTEGER NOT NULL,
  "purchaseRequestItemId" INTEGER NOT NULL,
  "materialId" INTEGER NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unitCost" DOUBLE PRECISION NOT NULL,
  "totalPaid" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseQuotationItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PurchaseQuotationItem_quotationId_idx" ON "PurchaseQuotationItem"("quotationId");
CREATE INDEX IF NOT EXISTS "PurchaseQuotationItem_purchaseRequestItemId_idx" ON "PurchaseQuotationItem"("purchaseRequestItemId");
CREATE INDEX IF NOT EXISTS "PurchaseQuotationItem_materialId_idx" ON "PurchaseQuotationItem"("materialId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseQuotationItem_quotationId_fkey'
  ) THEN
    ALTER TABLE "PurchaseQuotationItem"
    ADD CONSTRAINT "PurchaseQuotationItem_quotationId_fkey"
    FOREIGN KEY ("quotationId") REFERENCES "PurchaseQuotation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseQuotationItem_purchaseRequestItemId_fkey'
  ) THEN
    ALTER TABLE "PurchaseQuotationItem"
    ADD CONSTRAINT "PurchaseQuotationItem_purchaseRequestItemId_fkey"
    FOREIGN KEY ("purchaseRequestItemId") REFERENCES "PurchaseRequestItem"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseQuotationItem_materialId_fkey'
  ) THEN
    ALTER TABLE "PurchaseQuotationItem"
    ADD CONSTRAINT "PurchaseQuotationItem_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "Material"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
