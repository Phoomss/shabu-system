-- Add the display numbers defined in schema.prisma. PostgreSQL assigns values
-- to existing rows when each SERIAL column is added.
ALTER TABLE "User" ADD COLUMN "userNumber" SERIAL NOT NULL;
ALTER TABLE "Session" ADD COLUMN "sessionNumber" SERIAL NOT NULL;
ALTER TABLE "Order" ADD COLUMN "orderNumber" SERIAL NOT NULL;
ALTER TABLE "Invoice" ADD COLUMN "invoiceNumber" SERIAL NOT NULL;

CREATE UNIQUE INDEX "User_userNumber_key" ON "User"("userNumber");
CREATE UNIQUE INDEX "Session_sessionNumber_key" ON "Session"("sessionNumber");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
