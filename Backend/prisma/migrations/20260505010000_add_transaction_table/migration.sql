CREATE TABLE IF NOT EXISTS "Transaction" (
  "id" SERIAL NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "category" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "description" TEXT,
  "orderId" INTEGER,

  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Transaction_orderId_fkey'
  ) THEN
    ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
