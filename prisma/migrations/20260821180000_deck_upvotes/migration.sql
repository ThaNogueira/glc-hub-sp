-- DeckVote vira upvote: um voto por usuário POR DECK (antes: por semana);
-- weekKey passa a registrar a semana do voto (base do "decks em alta")

-- DropIndex
DROP INDEX "DeckVote_userId_weekKey_key";

-- AlterTable
ALTER TABLE "DeckVote" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "DeckVote_userId_deckId_key" ON "DeckVote"("userId", "deckId");
CREATE INDEX "DeckVote_weekKey_idx" ON "DeckVote"("weekKey");
CREATE INDEX "DeckVote_deckId_idx" ON "DeckVote"("deckId");
