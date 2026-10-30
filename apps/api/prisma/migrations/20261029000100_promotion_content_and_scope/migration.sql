-- Giữ các cột nội dung nếu database đã áp dụng bản khuyến mãi trước đây.
ALTER TABLE "promotions"
ADD COLUMN IF NOT EXISTS "title" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "display_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "applies_to_all_products" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "promotion_products" (
    "promotion_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    CONSTRAINT "promotion_products_pkey" PRIMARY KEY ("promotion_id", "product_id"),
    CONSTRAINT "promotion_products_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "promotion_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "promotion_products_product_id_idx" ON "promotion_products"("product_id");
