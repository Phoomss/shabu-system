BEGIN;

-- Preserve all historical rows; require explicit reconciliation instead of choosing a winner.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Session" WHERE status = 'ACTIVE' GROUP BY "tableId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'PAYMENT_PREFLIGHT_DUPLICATE_ACTIVE_SESSIONS: reconcile active sessions per table before retrying migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "Session_one_active_per_table" ON "Session"("tableId") WHERE (status = 'ACTIVE'::"SessionStatus");

CREATE TABLE "SessionOpenRequest" (
  "actorId" TEXT NOT NULL,
  "key" VARCHAR(128) NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  "sessionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionOpenRequest_pkey" PRIMARY KEY ("actorId", "key"),
  CONSTRAINT "SessionOpenRequest_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SessionOpenRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SessionOpenRequest_sessionId_key" ON "SessionOpenRequest"("sessionId");

CREATE TABLE "PaymentSettings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "promptPayNumber" VARCHAR(64),
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentSettings_singleton" CHECK (id = 1),
  CONSTRAINT "PaymentSettings_reference_syntax" CHECK ("promptPayNumber" IS NULL OR (length(btrim("promptPayNumber")) > 0 AND "promptPayNumber" !~ '[[:cntrl:]]')),
  CONSTRAINT "PaymentSettings_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Old settings were process-local memory; no receiver can be reconstructed safely.
INSERT INTO "PaymentSettings" (id, "promptPayNumber", "updatedAt") VALUES (1, NULL, CURRENT_TIMESTAMP);
COMMIT;
