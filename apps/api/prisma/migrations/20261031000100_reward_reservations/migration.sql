ALTER TABLE "users" ADD COLUMN "reserved_points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD CONSTRAINT "users_points_balance_check"
  CHECK ("reserved_points" >= 0 AND "loyalty_points" >= "reserved_points");
ALTER TABLE "cart_items" ADD COLUMN "reward_redemption_id" UUID;
ALTER TABLE "reward_redemptions" ADD COLUMN "idempotency_key" UUID;
ALTER TABLE "orders" ADD COLUMN "checkout_key" UUID;
ALTER TABLE "orders" ADD COLUMN "checkout_payload_hash" VARCHAR(64);
ALTER TABLE "order_items" ADD COLUMN "reward_redemption_id" UUID;
ALTER TABLE "order_items" ADD COLUMN "reward_points" INTEGER;
CREATE UNIQUE INDEX "cart_items_reward_redemption_id_key" ON "cart_items"("reward_redemption_id");
CREATE UNIQUE INDEX "cart_items_one_reward_per_user" ON "cart_items"("user_id") WHERE "reward_redemption_id" IS NOT NULL;
CREATE UNIQUE INDEX "reward_redemptions_user_id_idempotency_key_key" ON "reward_redemptions"("user_id", "idempotency_key");
CREATE UNIQUE INDEX "orders_user_id_checkout_key_key" ON "orders"("user_id", "checkout_key");
CREATE UNIQUE INDEX "order_items_reward_redemption_id_key" ON "order_items"("reward_redemption_id");
CREATE UNIQUE INDEX "loyalty_transactions_reward_redemption_id_type_key" ON "loyalty_transactions"("reward_redemption_id", "type");
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_reward_redemption_id_fkey" FOREIGN KEY ("reward_redemption_id") REFERENCES "reward_redemptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_reward_redemption_id_fkey" FOREIGN KEY ("reward_redemption_id") REFERENCES "reward_redemptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_reward_quantity_check" CHECK ("quantity" > 0 AND ("reward_redemption_id" IS NULL OR "quantity" = 1));
ALTER TABLE "reward_products" ADD CONSTRAINT "reward_products_points_check" CHECK ("points_required" > 0);
