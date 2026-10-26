CREATE TABLE "password_setup_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "sent_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "password_setup_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_setup_challenges_attempts_check" CHECK ("attempts" BETWEEN 0 AND 5),
    CONSTRAINT "password_setup_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "password_setup_challenges_user_id_key" ON "password_setup_challenges"("user_id");
