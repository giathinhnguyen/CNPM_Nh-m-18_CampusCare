-- CreateEnum
CREATE TYPE "inventory_status_enum" AS ENUM ('NOT_RESERVED', 'RESERVED', 'DEDUCTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "IngredientAdjustment" AS ENUM ('FIXED', 'SUGAR');

-- CreateEnum
CREATE TYPE "CustomizationAxis" AS ENUM ('SUGAR', 'ICE');

-- AlterEnum
ALTER TYPE "payment_method_enum" ADD VALUE 'VNPAY';

-- AlterTable
ALTER TABLE "product_sizes" ADD COLUMN     "cup_volume_ml" INTEGER;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customer_name" VARCHAR(100),
ADD COLUMN     "customer_phone" VARCHAR(20),
ADD COLUMN     "inventory_deducted_at" TIMESTAMPTZ(6),
ADD COLUMN     "inventory_released_at" TIMESTAMPTZ(6),
ADD COLUMN     "inventory_reserved_at" TIMESTAMPTZ(6),
ADD COLUMN     "inventory_status" "inventory_status_enum" NOT NULL DEFAULT 'NOT_RESERVED',
ADD COLUMN     "reserved_ingredients" JSONB;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "needs_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payment_url" TEXT;

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "unit" VARCHAR(5) NOT NULL,
    "unit_cost_vnd" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "reorder_level" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_ingredients" (
    "product_size_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "adjustment_group" "IngredientAdjustment" NOT NULL DEFAULT 'FIXED',

    CONSTRAINT "product_ingredients_pkey" PRIMARY KEY ("product_size_id","ingredient_id")
);

-- CreateTable
CREATE TABLE "customization_policies" (
    "product_size_id" UUID NOT NULL,
    "axis" "CustomizationAxis" NOT NULL,
    "allowed_levels" INTEGER[],
    "default_level" INTEGER NOT NULL DEFAULT 100,
    "policy_note" TEXT,

    CONSTRAINT "customization_policies_pkey" PRIMARY KEY ("product_size_id","axis")
);

-- CreateTable
CREATE TABLE "ingredient_stocks" (
    "ingredient_id" UUID NOT NULL,
    "on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ingredient_stocks_pkey" PRIMARY KEY ("ingredient_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_code_key" ON "ingredients"("code");

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_product_size_id_fkey" FOREIGN KEY ("product_size_id") REFERENCES "product_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customization_policies" ADD CONSTRAINT "customization_policies_product_size_id_fkey" FOREIGN KEY ("product_size_id") REFERENCES "product_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_stocks" ADD CONSTRAINT "ingredient_stocks_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE ingredients ADD CONSTRAINT ingredients_valid_values CHECK (unit IN ('g','ml','pcs') AND unit_cost_vnd >= 0 AND reorder_level >= 0);
ALTER TABLE ingredient_stocks ADD CONSTRAINT ingredient_stock_balance CHECK (reserved >= 0 AND on_hand >= reserved);
ALTER TABLE product_ingredients ADD CONSTRAINT ingredient_quantity_positive CHECK (quantity > 0);
ALTER TABLE product_sizes ADD CONSTRAINT cup_volume_positive CHECK (cup_volume_ml IS NULL OR cup_volume_ml > 0);
ALTER TABLE customization_policies ALTER COLUMN allowed_levels SET NOT NULL;
ALTER TABLE customization_policies ADD CONSTRAINT valid_customization_levels CHECK (
  cardinality(allowed_levels) > 0 AND allowed_levels <@ ARRAY[0,50,100,120]
  AND array_position(allowed_levels, NULL) IS NULL AND default_level = ANY(allowed_levels));
CREATE UNIQUE INDEX payments_one_pending_per_order ON payments(order_id) WHERE status = 'PENDING';
CREATE UNIQUE INDEX loyalty_one_earn_per_order ON loyalty_transactions(order_id) WHERE type = 'EARN';
