import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { fold } from "../normalize";

/**
 * Busca local de cartas para o deck builder: prefixo (btree) + fuzzy
 * (pg_trgm), deduplicada por nome (no GLC a carta é o nome — a impressão
 * mais recente com imagem representa todas).
 */

export type CardHit = {
  id: string;
  name: string;
  supertype: string;
  subtypes: string[];
  types: string[];
  hp: number | null;
  rules: string[];
  attacks: { name: string; cost?: string[]; convertedEnergyCost?: number }[] | null;
  setId: string;
  setName: string;
  setPtcgoCode: string | null;
  number: string;
  rarity: string | null;
  imageSmall: string | null;
  imageLarge: string | null;
  hasRuleBox: boolean;
  isAceSpec: boolean;
  isBasicEnergy: boolean;
  glcLegal: boolean;
  banned: boolean;
};

// cache leve da banlist (editável no admin) — evita um hit por tecla digitada
let banlistCache: { at: number; names: Set<string> } | null = null;

export async function getBanlistNormalized(): Promise<Set<string>> {
  if (banlistCache && Date.now() - banlistCache.at < 60_000) return banlistCache.names;
  const rows = await prisma.banlistEntry.findMany({ select: { cardName: true } });
  banlistCache = { at: Date.now(), names: new Set(rows.map((r) => fold(r.cardName))) };
  return banlistCache.names;
}

export function invalidateBanlistCache() {
  banlistCache = null;
}

export type CardSearchParams = {
  q?: string;
  type?: string; // tipo em inglês do dataset ("Fire", "Water"...)
  supertype?: string; // Pokémon | Trainer | Energy
  subtype?: string;
  setId?: string;
  glcOnly?: boolean;
  limit?: number;
};

export async function searchCards(params: CardSearchParams): Promise<CardHit[]> {
  const q = fold(params.q ?? "");
  const limit = Math.min(Math.max(params.limit ?? 40, 1), 60);

  const conds: Prisma.Sql[] = [];
  if (q.length >= 2) {
    // prefixo (btree) + palavra interna + fuzzy via operador % (usa o índice GIN trigram)
    conds.push(
      Prisma.sql`("nameNormalized" LIKE ${q + "%"} OR "nameNormalized" LIKE ${"% " + q + "%"} OR "nameNormalized" % ${q})`,
    );
  }
  if (params.type) conds.push(Prisma.sql`${params.type} = ANY(types)`);
  if (params.supertype) conds.push(Prisma.sql`supertype = ${params.supertype}`);
  if (params.subtype) conds.push(Prisma.sql`${params.subtype} = ANY(subtypes)`);
  if (params.setId) conds.push(Prisma.sql`"setId" = ${params.setId}`);
  if (params.glcOnly) conds.push(Prisma.sql`"glcLegal" = true`);

  if (conds.length === 0) return [];
  const where = Prisma.join(conds, " AND ");

  const relevance =
    q.length >= 2
      ? Prisma.sql`CASE WHEN "nameNormalized" LIKE ${q + "%"} THEN 0 WHEN "nameNormalized" LIKE ${"% " + q + "%"} THEN 1 ELSE 2 END, similarity("nameNormalized", ${q}) DESC,`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<Omit<CardHit, "banned">[]>(Prisma.sql`
    SELECT id, name, supertype, subtypes, types, hp, rules, attacks, "setId", "setName",
           "setPtcgoCode", number, rarity, "imageSmall", "imageLarge",
           "hasRuleBox", "isAceSpec", "isBasicEnergy", "glcLegal", "nameNormalized"
    FROM (
      SELECT DISTINCT ON ("nameNormalized") *
      FROM "Card"
      WHERE ${where}
      ORDER BY "nameNormalized", "imageSmall" IS NULL, "setReleaseDate" DESC NULLS LAST
    ) dedup
    ORDER BY ${relevance} name ASC
    LIMIT ${limit}
  `);

  const banlist = await getBanlistNormalized();
  return rows.map((r) => ({
    ...r,
    banned: banlist.has(fold(r.name)),
  }));
}

/** Lookup exato por código TCG Live/Limitless ("SVI 191") para importar listas. */
export async function findByPtcgoCode(code: string, number: string) {
  return prisma.card.findFirst({
    where: { setPtcgoCode: { equals: code, mode: "insensitive" }, number },
  });
}

/** Lookup por nome exato (fold), impressão mais recente com imagem. */
export async function findByName(name: string) {
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM "Card"
    WHERE "nameNormalized" = ${fold(name)}
    ORDER BY "imageSmall" IS NULL, "setReleaseDate" DESC NULLS LAST
    LIMIT 1
  `);
  if (rows.length === 0) return null;
  return prisma.card.findUnique({ where: { id: rows[0].id } });
}
