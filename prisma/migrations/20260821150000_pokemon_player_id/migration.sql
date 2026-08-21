-- Player ID oficial da Pokémon no perfil + pedidos de troca aprovados pelo admin

-- AlterTable
ALTER TABLE "User" ADD COLUMN "pokemonPlayerId" TEXT;

-- CreateTable
CREATE TABLE "PokemonIdRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PokemonIdRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PokemonIdRequest_status_idx" ON "PokemonIdRequest"("status");

-- AddForeignKey
ALTER TABLE "PokemonIdRequest" ADD CONSTRAINT "PokemonIdRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
