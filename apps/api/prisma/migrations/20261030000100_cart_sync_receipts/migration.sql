CREATE TABLE "cart_syncs" (
  "user_id" UUID NOT NULL,
  "sync_id" UUID NOT NULL,
  "payload_hash" VARCHAR(64) NOT NULL,
  "warnings" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cart_syncs_pkey" PRIMARY KEY ("user_id", "sync_id"),
  CONSTRAINT "cart_syncs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
