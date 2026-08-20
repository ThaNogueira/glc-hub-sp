-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PokemonType" AS ENUM ('GRASS', 'WATER', 'FIRE', 'LIGHTNING', 'COLORLESS', 'FIGHTING', 'PSYCHIC', 'DRAGON', 'DARKNESS', 'METAL', 'FAIRY');

-- CreateEnum
CREATE TYPE "Modality" AS ENUM ('PRESENCIAL', 'ONLINE');

-- CreateEnum
CREATE TYPE "VenueKind" AS ENUM ('STORE', 'EVENT');

-- CreateEnum
CREATE TYPE "VenueStatus" AS ENUM ('ACTIVE', 'HIATUS');

-- CreateEnum
CREATE TYPE "RecordOrigin" AS ENUM ('SHEET', 'SITE');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'MISSING_IN_SHEET', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLAYER', 'STORE', 'ADMIN');

-- CreateEnum
CREATE TYPE "TabKind" AS ENUM ('LOG_PRESENCIAL', 'LOG_ONLINE', 'RANK', 'SCHEDULE', 'RULES', 'PLAYERS', 'DECKLISTS', 'IGNORE', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "IssueKind" AS ENUM ('UNKNOWN_PLAYER', 'UNKNOWN_VENUE', 'UNKNOWN_TYPE', 'PARSE_WARNING', 'ROW_REMOVED', 'DUPLICATE_SUSPECT', 'RANK_MISMATCH', 'NEW_TAB');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TokenKind" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "DeckSource" AS ENUM ('BUILDER', 'TEXT', 'LIMITLESS', 'CARDBOARD_WARRIOR', 'SHEET');

-- CreateEnum
CREATE TYPE "CardCategory" AS ENUM ('POKEMON', 'TRAINER', 'ENERGY');

-- CreateEnum
CREATE TYPE "ExternalRefKind" AS ENUM ('DECK', 'PLAYER_PROFILE');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAlias" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "PlayerAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "neighborhood" TEXT,
    "address" TEXT,
    "kind" "VenueKind" NOT NULL DEFAULT 'STORE',
    "status" "VenueStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueAlias" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,

    CONSTRAINT "VenueAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklySlot" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "time" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT,
    "name" TEXT,
    "origin" "RecordOrigin" NOT NULL DEFAULT 'SHEET',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeWin" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "tabName" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "date" DATE,
    "rawDate" TEXT,
    "rawVenue" TEXT NOT NULL,
    "rawPlayer" TEXT NOT NULL,
    "rawType" TEXT NOT NULL,
    "modality" "Modality" NOT NULL,
    "type" "PokemonType" NOT NULL,
    "playerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "tournamentId" TEXT,
    "origin" "RecordOrigin" NOT NULL DEFAULT 'SHEET',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstSyncId" TEXT,
    "lastSeenSyncId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeWin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN,
    "trigger" TEXT NOT NULL,
    "stats" JSONB,
    "error" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetTab" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "TabKind" NOT NULL DEFAULT 'UNCLASSIFIED',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedNote" TEXT,

    CONSTRAINT "SheetTab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationIssue" (
    "id" TEXT NOT NULL,
    "kind" "IssueKind" NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "syncRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReconciliationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playerId" TEXT,
    "venueId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TokenKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ProfileClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "namePt" TEXT,
    "supertype" TEXT NOT NULL,
    "subtypes" TEXT[],
    "types" TEXT[],
    "setId" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "rarity" TEXT,
    "imageSmall" TEXT,
    "imageLarge" TEXT,
    "hasRuleBox" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanlistEntry" (
    "id" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "PokemonType" NOT NULL,
    "guide" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isChampion" BOOLEAN NOT NULL DEFAULT false,
    "source" "DeckSource" NOT NULL DEFAULT 'BUILDER',
    "sourceUrl" TEXT,
    "authorUserId" TEXT,
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckVersion" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changelog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckCard" (
    "id" TEXT NOT NULL,
    "deckVersionId" TEXT NOT NULL,
    "cardId" TEXT,
    "rawName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "category" "CardCategory" NOT NULL,

    CONSTRAINT "DeckCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckResultLink" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "badgeWinId" TEXT NOT NULL,

    CONSTRAINT "DeckResultLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalDeckRef" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "ExternalRefKind" NOT NULL,
    "source" "DeckSource" NOT NULL,
    "playerId" TEXT,
    "rawPlayer" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalDeckRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckVote" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,

    CONSTRAINT "DeckVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAlias_normalized_key" ON "PlayerAlias"("normalized");

-- CreateIndex
CREATE INDEX "PlayerAlias_playerId_idx" ON "PlayerAlias"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_name_key" ON "Venue"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "VenueAlias_normalized_key" ON "VenueAlias"("normalized");

-- CreateIndex
CREATE INDEX "VenueAlias_venueId_idx" ON "VenueAlias"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklySlot_venueId_weekday_key" ON "WeeklySlot"("venueId", "weekday");

-- CreateIndex
CREATE INDEX "Tournament_date_idx" ON "Tournament"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_venueId_date_name_key" ON "Tournament"("venueId", "date", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeWin_sourceKey_key" ON "BadgeWin"("sourceKey");

-- CreateIndex
CREATE INDEX "BadgeWin_playerId_idx" ON "BadgeWin"("playerId");

-- CreateIndex
CREATE INDEX "BadgeWin_venueId_idx" ON "BadgeWin"("venueId");

-- CreateIndex
CREATE INDEX "BadgeWin_type_idx" ON "BadgeWin"("type");

-- CreateIndex
CREATE INDEX "BadgeWin_date_idx" ON "BadgeWin"("date");

-- CreateIndex
CREATE INDEX "BadgeWin_modality_status_idx" ON "BadgeWin"("modality", "status");

-- CreateIndex
CREATE INDEX "BadgeWin_tabName_status_idx" ON "BadgeWin"("tabName", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SheetTab_title_key" ON "SheetTab"("title");

-- CreateIndex
CREATE INDEX "ReconciliationIssue_status_kind_idx" ON "ReconciliationIssue"("status", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_playerId_key" ON "User"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_venueId_key" ON "User"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileClaim_userId_playerId_key" ON "ProfileClaim"("userId", "playerId");

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "Card"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BanlistEntry_cardName_key" ON "BanlistEntry"("cardName");

-- CreateIndex
CREATE UNIQUE INDEX "Deck_slug_key" ON "Deck"("slug");

-- CreateIndex
CREATE INDEX "Deck_type_isPublic_idx" ON "Deck"("type", "isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "DeckVersion_deckId_version_key" ON "DeckVersion"("deckId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DeckResultLink_deckId_badgeWinId_key" ON "DeckResultLink"("deckId", "badgeWinId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalDeckRef_url_key" ON "ExternalDeckRef"("url");

-- CreateIndex
CREATE UNIQUE INDEX "DeckVote_userId_weekKey_key" ON "DeckVote"("userId", "weekKey");

-- AddForeignKey
ALTER TABLE "PlayerAlias" ADD CONSTRAINT "PlayerAlias_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueAlias" ADD CONSTRAINT "VenueAlias_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklySlot" ADD CONSTRAINT "WeeklySlot_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeWin" ADD CONSTRAINT "BadgeWin_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeWin" ADD CONSTRAINT "BadgeWin_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeWin" ADD CONSTRAINT "BadgeWin_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationIssue" ADD CONSTRAINT "ReconciliationIssue_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileClaim" ADD CONSTRAINT "ProfileClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileClaim" ADD CONSTRAINT "ProfileClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckVersion" ADD CONSTRAINT "DeckVersion_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_deckVersionId_fkey" FOREIGN KEY ("deckVersionId") REFERENCES "DeckVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckResultLink" ADD CONSTRAINT "DeckResultLink_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckResultLink" ADD CONSTRAINT "DeckResultLink_badgeWinId_fkey" FOREIGN KEY ("badgeWinId") REFERENCES "BadgeWin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalDeckRef" ADD CONSTRAINT "ExternalDeckRef_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckVote" ADD CONSTRAINT "DeckVote_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckVote" ADD CONSTRAINT "DeckVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

