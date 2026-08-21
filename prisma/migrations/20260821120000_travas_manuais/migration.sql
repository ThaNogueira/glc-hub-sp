-- Travas manuais: edições feitas no admin não são sobrescritas pelo sync

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN "manualLock" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WeeklySlot" ADD COLUMN "manual" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "manual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tournament" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;

-- Torneios sem nome: normaliza NULL -> '' para o upsert do sync casar com a
-- unique (venueId, date, name) e não duplicar a cada sincronização
UPDATE "Tournament" SET "name" = '' WHERE "name" IS NULL;
