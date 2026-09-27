-- CreateTable
CREATE TABLE "tournaments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalized_at" TIMESTAMPTZ(3),

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_bet_id" VARCHAR(128) NOT NULL,
    "player_id" VARCHAR(128) NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_bets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID NOT NULL,
    "bet_id" UUID NOT NULL,
    "external_bet_id" VARCHAR(128) NOT NULL,
    "player_id" VARCHAR(128) NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "inserted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT transaction_timestamp(),

    CONSTRAINT "tournament_bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final_placements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID NOT NULL,
    "player_id" VARCHAR(128) NOT NULL,
    "score" BIGINT NOT NULL,
    "placement" INTEGER NOT NULL,

    CONSTRAINT "final_placements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bets_external_bet_id_key" ON "bets"("external_bet_id");

-- CreateIndex
CREATE INDEX "idx_contrib_tournament_player" ON "tournament_bets"("tournament_id", "player_id");

-- CreateIndex
CREATE INDEX "idx_tournament_bets_bet_id" ON "tournament_bets"("bet_id");

-- CreateIndex
CREATE INDEX "idx_tournament_bets_inserted_at" ON "tournament_bets"("inserted_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_bets_tournament_id_external_bet_id_key" ON "tournament_bets"("tournament_id", "external_bet_id");

-- CreateIndex
CREATE UNIQUE INDEX "final_placements_tournament_id_player_id_key" ON "final_placements"("tournament_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "final_placements_tournament_id_placement_key" ON "final_placements"("tournament_id", "placement");

-- AddForeignKey
ALTER TABLE "tournament_bets" ADD CONSTRAINT "tournament_bets_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_bets" ADD CONSTRAINT "tournament_bets_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "bets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_placements" ADD CONSTRAINT "final_placements_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Invariants Prisma's schema language can't express. The DTOs validate them
-- too; the database is the last line of defense.
ALTER TABLE "tournaments" ADD CONSTRAINT "chk_tournaments_window" CHECK ("ends_at" > "starts_at");
ALTER TABLE "bets" ADD CONSTRAINT "chk_bets_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "tournament_bets" ADD CONSTRAINT "chk_tournament_bets_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "final_placements" ADD CONSTRAINT "chk_final_placements_placement_positive" CHECK ("placement" > 0);

-- Bet ingestion (window contains createdAt) and the finalization sweep (ended,
-- not finalized) only look at open tournaments, so the index stays the size
-- of the open set. Prisma 5 can't declare a partial index and ignores it when
-- diffing, so it lives only here.
CREATE INDEX "idx_tournaments_open_ends_at" ON "tournaments" ("ends_at") WHERE "finalized_at" IS NULL;
