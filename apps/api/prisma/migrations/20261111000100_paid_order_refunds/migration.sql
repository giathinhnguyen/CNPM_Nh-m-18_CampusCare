ALTER TYPE "inventory_status_enum" ADD VALUE 'RESTORED';
ALTER TYPE "order_status_enum" ADD VALUE 'REFUND_PENDING';
ALTER TYPE "order_status_enum" ADD VALUE 'REFUNDED';
ALTER TYPE "loyalty_type_enum" ADD VALUE 'REFUND_EARN';
ALTER TYPE "loyalty_type_enum" ADD VALUE 'REFUND_REDEEM';
CREATE TYPE "refund_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
ALTER TABLE "users" ADD COLUMN "loyalty_debt" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "users_loyalty_debt_nonnegative" CHECK ("loyalty_debt" >= 0);
ALTER TABLE "loyalty_transactions" ADD COLUMN "debt_change" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "paid_at" TIMESTAMPTZ(6);
-- Old paid orders predate this feature; retain their last recorded paid transition.
UPDATE "orders" SET "paid_at" = "updated_at" WHERE "status"::text = 'PAID';
CREATE TABLE "refunds" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
  "payment_id" UUID REFERENCES "payments"("id") ON DELETE RESTRICT,
  "requested_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "provider_reference" VARCHAR(45) NOT NULL UNIQUE,
  "amount" DECIMAL(12,0) NOT NULL CHECK ("amount" >= 0),
  "reason" VARCHAR(100) NOT NULL,
  "status" "refund_status_enum" NOT NULL DEFAULT 'PENDING',
  "provider_refund_id" VARCHAR(64),
  "submitted_at" TIMESTAMPTZ(6),
  "last_checked_at" TIMESTAMPTZ(6),
  "raw_response" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Full refunds only: a pending or successful refund excludes any second request.
CREATE UNIQUE INDEX "refunds_one_active_per_order" ON "refunds"("order_id") WHERE "status" IN ('PENDING', 'SUCCESS');
CREATE INDEX "refunds_status_last_checked_at_idx" ON "refunds"("status", "last_checked_at");
CREATE INDEX "refunds_order_id_created_at_idx" ON "refunds"("order_id", "created_at");
