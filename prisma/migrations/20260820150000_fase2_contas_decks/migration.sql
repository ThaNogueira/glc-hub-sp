-- Fase 2: contas, decks e base de cartas (pokemon-tcg-data)

-- Busca fuzzy de cartas (deck builder): trigram local, sem depender de serviço externo
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "description" TEXT,
ADD COLUMN     "priceInfo" TEXT,
ADD COLUMN     "prizeInfo" TEXT,
ADD COLUMN     "registrationUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "favoriteType" "PokemonType";

-- AlterTable (DEFAULT temporário em nameNormalized para não quebrar caso a
-- tabela já tenha linhas; o importador preenche o valor real)
ALTER TABLE "Card" ADD COLUMN     "attacks" JSONB,
ADD COLUMN     "evolvesFrom" TEXT,
ADD COLUMN     "glcLegal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hp" INTEGER,
ADD COLUMN     "isAceSpec" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isBasicEnergy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legalities" JSONB,
ADD COLUMN     "nameNormalized" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "regulationMark" TEXT,
ADD COLUMN     "rules" TEXT[],
ADD COLUMN     "setPtcgoCode" TEXT,
ADD COLUMN     "setReleaseDate" TEXT,
ADD COLUMN     "setSeries" TEXT;

ALTER TABLE "Card" ALTER COLUMN "nameNormalized" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Deck" ADD COLUMN     "coverCardId" TEXT,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StoreRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "venueId" TEXT,
    "venueName" TEXT NOT NULL,
    "message" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "StoreRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreRequest_status_idx" ON "StoreRequest"("status");

-- CreateIndex
CREATE INDEX "Card_nameNormalized_idx" ON "Card"("nameNormalized");

-- CreateIndex
CREATE INDEX "Card_supertype_idx" ON "Card"("supertype");

-- CreateIndex
CREATE INDEX "Card_setId_idx" ON "Card"("setId");

-- Índice trigram para busca fuzzy por nome (além do índice btree de prefixo)
CREATE INDEX "Card_nameNormalized_trgm_idx" ON "Card" USING GIN ("nameNormalized" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "StoreRequest" ADD CONSTRAINT "StoreRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRequest" ADD CONSTRAINT "StoreRequest_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_coverCardId_fkey" FOREIGN KEY ("coverCardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
