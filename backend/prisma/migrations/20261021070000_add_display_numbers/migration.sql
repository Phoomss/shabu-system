-- Add display numbers without changing UUID primary/foreign keys or existing rows.
-- nextval backfills unique values; chronology is intentionally not inferred.
BEGIN;

CREATE SEQUENCE "User_userNumber_seq";
ALTER TABLE "User" ADD COLUMN "userNumber" INTEGER;
ALTER SEQUENCE "User_userNumber_seq" OWNED BY "User"."userNumber";
ALTER TABLE "User" ALTER COLUMN "userNumber" SET DEFAULT nextval('"User_userNumber_seq"');
UPDATE "User" SET "userNumber" = nextval('"User_userNumber_seq"') WHERE "userNumber" IS NULL;
ALTER TABLE "User" ALTER COLUMN "userNumber" SET NOT NULL;
CREATE UNIQUE INDEX "User_userNumber_key" ON "User"("userNumber");

CREATE SEQUENCE "Session_sessionNumber_seq";
ALTER TABLE "Session" ADD COLUMN "sessionNumber" INTEGER;
ALTER SEQUENCE "Session_sessionNumber_seq" OWNED BY "Session"."sessionNumber";
ALTER TABLE "Session" ALTER COLUMN "sessionNumber" SET DEFAULT nextval('"Session_sessionNumber_seq"');
UPDATE "Session" SET "sessionNumber" = nextval('"Session_sessionNumber_seq"') WHERE "sessionNumber" IS NULL;
ALTER TABLE "Session" ALTER COLUMN "sessionNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Session_sessionNumber_key" ON "Session"("sessionNumber");

CREATE SEQUENCE "Order_orderNumber_seq";
ALTER TABLE "Order" ADD COLUMN "orderNumber" INTEGER;
ALTER SEQUENCE "Order_orderNumber_seq" OWNED BY "Order"."orderNumber";
ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET DEFAULT nextval('"Order_orderNumber_seq"');
UPDATE "Order" SET "orderNumber" = nextval('"Order_orderNumber_seq"') WHERE "orderNumber" IS NULL;
ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

CREATE SEQUENCE "Invoice_invoiceNumber_seq";
ALTER TABLE "Invoice" ADD COLUMN "invoiceNumber" INTEGER;
ALTER SEQUENCE "Invoice_invoiceNumber_seq" OWNED BY "Invoice"."invoiceNumber";
ALTER TABLE "Invoice" ALTER COLUMN "invoiceNumber" SET DEFAULT nextval('"Invoice_invoiceNumber_seq"');
UPDATE "Invoice" SET "invoiceNumber" = nextval('"Invoice_invoiceNumber_seq"') WHERE "invoiceNumber" IS NULL;
ALTER TABLE "Invoice" ALTER COLUMN "invoiceNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

COMMIT;
