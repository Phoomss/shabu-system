-- No stock reset or inferred thresholds/recipe units. Fail on invalid balances for operator review.
ALTER TABLE "Ingredient" ADD COLUMN "reorderThreshold" DECIMAL(65,30);
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_stock_nonnegative" CHECK ("currentStock" >= 0);
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_threshold_nonnegative" CHECK ("reorderThreshold" IS NULL OR "reorderThreshold" >= 0);
ALTER TABLE "Recipe" ADD COLUMN "quantityUnit" TEXT;
CREATE TYPE "StockMovementType" AS ENUM ('OPENING', 'ADJUSTMENT', 'DEDUCTION', 'RESTORATION');
CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sequence" SERIAL NOT NULL UNIQUE,
  "ingredientId" INTEGER NOT NULL REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reference" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "reason" TEXT NOT NULL,
  "quantity" DECIMAL(65,30) NOT NULL,
  "unit" TEXT NOT NULL,
  "balanceAfter" DECIMAL(65,30) NOT NULL,
  "actorId" TEXT REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_balance_nonnegative" CHECK ("balanceAfter" >= 0)
);
CREATE UNIQUE INDEX "StockMovement_ingredientId_reference_key" ON "StockMovement"("ingredientId", "reference");
CREATE INDEX "StockMovement_ingredientId_createdAt_idx" ON "StockMovement"("ingredientId", "createdAt");
-- Opening snapshot only: historical order consumption cannot be reconstructed safely.
INSERT INTO "StockMovement" ("id", "ingredientId", "reference", "type", "reason", "quantity", "unit", "balanceAfter")
SELECT 'inventory-opening-' || "id", "id", 'opening', 'OPENING', 'Migration opening balance snapshot', "currentStock", "unit", "currentStock"
FROM "Ingredient";
-- Ledger rows are immutable. Corrections must be new business events.
CREATE FUNCTION inventory_ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Stock movement ledger is append-only'; END $$;
CREATE TRIGGER stock_movement_immutable BEFORE UPDATE OR DELETE ON "StockMovement"
FOR EACH ROW EXECUTE FUNCTION inventory_ledger_immutable();
