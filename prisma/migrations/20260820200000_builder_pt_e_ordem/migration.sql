-- Deck builder v2: nomes PT-BR pesquisáveis e ordem manual das cartas

-- AlterTable
ALTER TABLE "Card" ADD COLUMN "namePtNormalized" TEXT;

-- AlterTable
ALTER TABLE "DeckCard" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Card_namePtNormalized_idx" ON "Card"("namePtNormalized");

-- Índice trigram para busca fuzzy também em português
CREATE INDEX "Card_namePtNormalized_trgm_idx" ON "Card" USING GIN ("namePtNormalized" gin_trgm_ops);
