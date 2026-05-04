CREATE TABLE "ReportEmission" (
  "id" SERIAL NOT NULL,
  "reportKey" TEXT NOT NULL,
  "exportFormat" TEXT NOT NULL,
  "fileName" TEXT,
  "fileHash" TEXT,
  "filters" JSONB,
  "generatedByUserId" INTEGER,
  "generatedByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReportEmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportEmission_reportKey_createdAt_idx" ON "ReportEmission"("reportKey", "createdAt");
CREATE INDEX "ReportEmission_exportFormat_idx" ON "ReportEmission"("exportFormat");
CREATE INDEX "ReportEmission_generatedByUserId_idx" ON "ReportEmission"("generatedByUserId");

ALTER TABLE "ReportEmission"
  ADD CONSTRAINT "ReportEmission_generatedByUserId_fkey"
  FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
