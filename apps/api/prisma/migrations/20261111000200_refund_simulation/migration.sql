CREATE TYPE "refund_mode_enum" AS ENUM ('GATEWAY', 'SIMULATION');
ALTER TABLE "refunds" ADD COLUMN "mode" "refund_mode_enum" NOT NULL DEFAULT 'GATEWAY';
ALTER TABLE "refunds" ADD CONSTRAINT "simulated_refund_has_no_bank_reference"
  CHECK ("mode" <> 'SIMULATION' OR "provider_refund_id" IS NULL);
