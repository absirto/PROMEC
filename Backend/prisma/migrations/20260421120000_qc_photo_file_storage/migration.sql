-- QualityPhoto: ficheiros em disco (storagePath), base64 opcional (legado)
ALTER TABLE "QualityPhoto" DROP CONSTRAINT IF EXISTS "QualityPhoto_qualityControlId_fkey";

ALTER TABLE "QualityPhoto" ALTER COLUMN "base64" DROP NOT NULL;

ALTER TABLE "QualityPhoto" ADD COLUMN "storagePath" TEXT;

ALTER TABLE "QualityPhoto" ADD CONSTRAINT "QualityPhoto_qualityControlId_fkey"
  FOREIGN KEY ("qualityControlId") REFERENCES "QualityControl"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
