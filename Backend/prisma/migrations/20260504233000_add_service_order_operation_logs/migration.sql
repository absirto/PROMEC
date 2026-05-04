CREATE TABLE IF NOT EXISTS "ServiceOrderOperationLog" (
  "id" SERIAL NOT NULL,
  "serviceOrderId" INTEGER NOT NULL,
  "employeeId" INTEGER,
  "operationType" TEXT NOT NULL,
  "shift" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3),
  "workedHours" DOUBLE PRECISION,
  "downtimeMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "downtimeReason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceOrderOperationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ServiceOrderOperationLog_serviceOrderId_idx" ON "ServiceOrderOperationLog"("serviceOrderId");
CREATE INDEX IF NOT EXISTS "ServiceOrderOperationLog_operationType_idx" ON "ServiceOrderOperationLog"("operationType");
CREATE INDEX IF NOT EXISTS "ServiceOrderOperationLog_startAt_idx" ON "ServiceOrderOperationLog"("startAt");

ALTER TABLE "ServiceOrderOperationLog"
ADD CONSTRAINT "ServiceOrderOperationLog_serviceOrderId_fkey"
FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceOrderOperationLog"
ADD CONSTRAINT "ServiceOrderOperationLog_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
