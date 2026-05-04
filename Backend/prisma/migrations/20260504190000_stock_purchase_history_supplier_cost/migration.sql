-- Histórico de compra por fornecedor e custo por lote no estoque
ALTER TABLE "StockLog"
  ADD COLUMN "supplierPersonId" INTEGER,
  ADD COLUMN "unitCost" DOUBLE PRECISION,
  ADD COLUMN "totalPaid" DOUBLE PRECISION,
  ADD COLUMN "remainingQty" DOUBLE PRECISION;

CREATE INDEX "StockLog_materialId_createdAt_idx" ON "StockLog"("materialId", "createdAt");
CREATE INDEX "StockLog_supplierPersonId_idx" ON "StockLog"("supplierPersonId");

ALTER TABLE "StockLog"
  ADD CONSTRAINT "StockLog_supplierPersonId_fkey"
  FOREIGN KEY ("supplierPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
