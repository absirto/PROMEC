-- Cria StockLog que estava faltando nas migrations anteriores
CREATE TABLE "StockLog" (
  "id" SERIAL NOT NULL,
  "materialId" INTEGER NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockLog_materialId_idx" ON "StockLog"("materialId");

ALTER TABLE "StockLog"
  ADD CONSTRAINT "StockLog_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
