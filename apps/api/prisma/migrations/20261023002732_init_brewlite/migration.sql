CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- CreateEnum
CREATE TYPE "user_role_enum" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "drink_size_enum" AS ENUM ('S', 'M', 'L');

-- CreateEnum
CREATE TYPE "drink_level_enum" AS ENUM ('ZERO', 'FIFTY', 'HUNDRED', 'ONE_TWENTY');

-- CreateEnum
CREATE TYPE "order_status_enum" AS ENUM ('PENDING_PAYMENT', 'PAID', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "payment_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "payment_method_enum" AS ENUM ('BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "discount_type_enum" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "loyalty_type_enum" AS ENUM ('EARN', 'REDEEM', 'EXPIRED_ROLLBACK', 'REDEMPTION_ROLLBACK');

-- CreateEnum
CREATE TYPE "reward_redemption_status_enum" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "full_name" VARCHAR(100) NOT NULL,
    "google_id" VARCHAR(255),
    "role" "user_role_enum" NOT NULL DEFAULT 'CUSTOMER',
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(12,0) NOT NULL,
    "image_url" VARCHAR(500),
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_sizes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "size" "drink_size_enum" NOT NULL,
    "price_adjustment" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toppings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "price" DECIMAL(12,0) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "toppings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_size_id" UUID NOT NULL,
    "sweetness_level" "drink_level_enum" NOT NULL DEFAULT 'HUNDRED',
    "ice_level" "drink_level_enum" NOT NULL DEFAULT 'HUNDRED',
    "quantity" INTEGER NOT NULL,
    "note" VARCHAR(255),
    "is_selected" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_item_toppings" (
    "cart_item_id" UUID NOT NULL,
    "topping_id" UUID NOT NULL,

    CONSTRAINT "cart_item_toppings_pkey" PRIMARY KEY ("cart_item_id","topping_id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "discount_type" "discount_type_enum" NOT NULL,
    "discount_value" DECIMAL(12,0) NOT NULL,
    "max_discount_amount" DECIMAL(12,0),
    "min_order_amount" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" TIMESTAMPTZ(6),
    "end_date" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_code" VARCHAR(30) NOT NULL,
    "user_id" UUID NOT NULL,
    "promotion_id" UUID,
    "promotion_code" VARCHAR(50),
    "total_amount" DECIMAL(12,0) NOT NULL,
    "discount_amount" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "final_amount" DECIMAL(12,0) NOT NULL,
    "status" "order_status_enum" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "reservation_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "note" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" VARCHAR(100) NOT NULL,
    "size" "drink_size_enum" NOT NULL,
    "sweetness_level" "drink_level_enum" NOT NULL,
    "ice_level" "drink_level_enum" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "base_price" DECIMAL(12,0) NOT NULL,
    "size_price_adjustment" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(12,0) NOT NULL,
    "topping_total" DECIMAL(12,0) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(12,0) NOT NULL,
    "note" VARCHAR(255),

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_toppings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_item_id" UUID NOT NULL,
    "topping_id" UUID NOT NULL,
    "topping_name" VARCHAR(100) NOT NULL,
    "topping_price" DECIMAL(12,0) NOT NULL,

    CONSTRAINT "order_item_toppings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "payment_method" "payment_method_enum" NOT NULL,
    "transaction_id" VARCHAR(255),
    "amount" DECIMAL(12,0) NOT NULL,
    "status" "payment_status_enum" NOT NULL DEFAULT 'PENDING',
    "raw_response" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_size_id" UUID NOT NULL,
    "points_required" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reward_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "reward_product_id" UUID NOT NULL,
    "order_id" UUID,
    "product_name_snapshot" VARCHAR(100) NOT NULL,
    "size_snapshot" "drink_size_enum" NOT NULL,
    "points_required_snapshot" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_points_spent" INTEGER NOT NULL,
    "status" "reward_redemption_status_enum" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "order_id" UUID,
    "reward_redemption_id" UUID,
    "points_change" INTEGER NOT NULL,
    "type" "loyalty_type_enum" NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_display_order_idx" ON "categories"("is_active", "display_order");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_is_active_idx" ON "products"("is_active");

-- CreateIndex
CREATE INDEX "products_category_id_is_active_idx" ON "products"("category_id", "is_active");

-- CreateIndex
CREATE INDEX "product_sizes_product_id_is_active_idx" ON "product_sizes"("product_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_sizes_product_id_size_key" ON "product_sizes"("product_id", "size");

-- CreateIndex
CREATE UNIQUE INDEX "toppings_name_key" ON "toppings"("name");

-- CreateIndex
CREATE INDEX "toppings_is_active_idx" ON "toppings"("is_active");

-- CreateIndex
CREATE INDEX "cart_items_user_id_idx" ON "cart_items"("user_id");

-- CreateIndex
CREATE INDEX "cart_items_product_id_idx" ON "cart_items"("product_id");

-- CreateIndex
CREATE INDEX "cart_items_product_size_id_idx" ON "cart_items"("product_size_id");

-- CreateIndex
CREATE INDEX "cart_items_user_id_is_selected_idx" ON "cart_items"("user_id", "is_selected");

-- CreateIndex
CREATE INDEX "cart_item_toppings_topping_id_idx" ON "cart_item_toppings"("topping_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- CreateIndex
CREATE INDEX "promotions_is_active_start_date_end_date_idx" ON "promotions"("is_active", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_code_key" ON "orders"("order_code");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_promotion_id_idx" ON "orders"("promotion_id");

-- CreateIndex
CREATE INDEX "orders_status_reservation_expires_at_idx" ON "orders"("status", "reservation_expires_at");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_item_toppings_order_item_id_idx" ON "order_item_toppings"("order_item_id");

-- CreateIndex
CREATE INDEX "order_item_toppings_topping_id_idx" ON "order_item_toppings"("topping_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_item_toppings_order_item_id_topping_id_key" ON "order_item_toppings"("order_item_id", "topping_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_order_id_status_idx" ON "payments"("order_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_payment_method_transaction_id_key" ON "payments"("payment_method", "transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_products_product_size_id_key" ON "reward_products"("product_size_id");

-- CreateIndex
CREATE INDEX "reward_products_is_active_idx" ON "reward_products"("is_active");

-- CreateIndex
CREATE INDEX "reward_redemptions_user_id_idx" ON "reward_redemptions"("user_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_reward_product_id_idx" ON "reward_redemptions"("reward_product_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_order_id_idx" ON "reward_redemptions"("order_id");

-- CreateIndex
CREATE INDEX "reward_redemptions_user_id_created_at_idx" ON "reward_redemptions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_transactions_user_id_idx" ON "loyalty_transactions"("user_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_order_id_idx" ON "loyalty_transactions"("order_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_reward_redemption_id_idx" ON "loyalty_transactions"("reward_redemption_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_user_id_created_at_idx" ON "loyalty_transactions"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_size_id_fkey" FOREIGN KEY ("product_size_id") REFERENCES "product_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_toppings" ADD CONSTRAINT "cart_item_toppings_cart_item_id_fkey" FOREIGN KEY ("cart_item_id") REFERENCES "cart_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_toppings" ADD CONSTRAINT "cart_item_toppings_topping_id_fkey" FOREIGN KEY ("topping_id") REFERENCES "toppings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_toppings" ADD CONSTRAINT "order_item_toppings_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_toppings" ADD CONSTRAINT "order_item_toppings_topping_id_fkey" FOREIGN KEY ("topping_id") REFERENCES "toppings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_products" ADD CONSTRAINT "reward_products_product_size_id_fkey" FOREIGN KEY ("product_size_id") REFERENCES "product_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_reward_product_id_fkey" FOREIGN KEY ("reward_product_id") REFERENCES "reward_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_reward_redemption_id_fkey" FOREIGN KEY ("reward_redemption_id") REFERENCES "reward_redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;


--THÊM CÁC CHECK
ALTER TABLE "users"
ADD CONSTRAINT "users_loyalty_points_nonnegative"
CHECK ("loyalty_points" >= 0);

ALTER TABLE "users"
ADD CONSTRAINT "users_auth_method_required"
CHECK (
  "password_hash" IS NOT NULL
  OR "google_id" IS NOT NULL
);

ALTER TABLE "products"
ADD CONSTRAINT "products_base_price_nonnegative"
CHECK ("base_price" >= 0);

ALTER TABLE "products"
ADD CONSTRAINT "products_stock_nonnegative"
CHECK ("stock_quantity" >= 0);

ALTER TABLE "products"
ADD CONSTRAINT "products_version_positive"
CHECK ("version" > 0);

ALTER TABLE "product_sizes"
ADD CONSTRAINT "product_sizes_price_adjustment_nonnegative"
CHECK ("price_adjustment" >= 0);

ALTER TABLE "toppings"
ADD CONSTRAINT "toppings_price_nonnegative"
CHECK ("price" >= 0);

ALTER TABLE "cart_items"
ADD CONSTRAINT "cart_items_quantity_positive"
CHECK ("quantity" > 0);

ALTER TABLE "orders"
ADD CONSTRAINT "orders_total_amount_nonnegative"
CHECK ("total_amount" >= 0);

ALTER TABLE "orders"
ADD CONSTRAINT "orders_discount_amount_nonnegative"
CHECK ("discount_amount" >= 0);

ALTER TABLE "orders"
ADD CONSTRAINT "orders_final_amount_nonnegative"
CHECK ("final_amount" >= 0);

ALTER TABLE "orders"
ADD CONSTRAINT "orders_discount_not_greater_than_total"
CHECK ("discount_amount" <= "total_amount");

ALTER TABLE "orders"
ADD CONSTRAINT "orders_final_amount_calculation"
CHECK ("final_amount" = "total_amount" - "discount_amount");

ALTER TABLE "orders"
ADD CONSTRAINT "orders_reservation_expiry_after_creation"
CHECK ("reservation_expires_at" > "created_at");

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_quantity_positive"
CHECK ("quantity" > 0);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_base_price_nonnegative"
CHECK ("base_price" >= 0);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_size_adjustment_nonnegative"
CHECK ("size_price_adjustment" >= 0);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_unit_price_nonnegative"
CHECK ("unit_price" >= 0);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_topping_total_nonnegative"
CHECK ("topping_total" >= 0);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_total_price_nonnegative"
CHECK ("total_price" >= 0);

ALTER TABLE "order_item_toppings"
ADD CONSTRAINT "order_item_toppings_price_nonnegative"
CHECK ("topping_price" >= 0);

ALTER TABLE "payments"
ADD CONSTRAINT "payments_amount_nonnegative"
CHECK ("amount" >= 0);

ALTER TABLE "promotions"
ADD CONSTRAINT "promotions_discount_value_positive"
CHECK ("discount_value" > 0);

ALTER TABLE "promotions"
ADD CONSTRAINT "promotions_max_discount_nonnegative"
CHECK (
  "max_discount_amount" IS NULL
  OR "max_discount_amount" >= 0
);

ALTER TABLE "promotions"
ADD CONSTRAINT "promotions_min_order_nonnegative"
CHECK ("min_order_amount" >= 0);

ALTER TABLE "promotions"
ADD CONSTRAINT "promotions_valid_date_range"
CHECK (
  "start_date" IS NULL
  OR "end_date" IS NULL
  OR "end_date" > "start_date"
);

ALTER TABLE "promotions"
ADD CONSTRAINT "promotions_percentage_not_greater_than_100"
CHECK (
  "discount_type" <> 'PERCENTAGE'
  OR "discount_value" <= 100
);

ALTER TABLE "reward_products"
ADD CONSTRAINT "reward_products_points_positive"
CHECK ("points_required" > 0);

ALTER TABLE "reward_redemptions"
ADD CONSTRAINT "reward_redemptions_quantity_positive"
CHECK ("quantity" > 0);

ALTER TABLE "reward_redemptions"
ADD CONSTRAINT "reward_redemptions_points_positive"
CHECK (
  "points_required_snapshot" > 0
  AND "total_points_spent" > 0
);

ALTER TABLE "reward_redemptions"
ADD CONSTRAINT "reward_redemptions_points_calculation"
CHECK (
  "total_points_spent" =
  "points_required_snapshot" * "quantity"
);

--PARTIAL CHO ĐƠN HẾT HẠNG
DROP INDEX IF EXISTS "orders_status_reservation_expires_at_idx";

CREATE INDEX "idx_orders_pending_expiration"
ON "orders" ("reservation_expires_at")
WHERE "status" = 'PENDING_PAYMENT';