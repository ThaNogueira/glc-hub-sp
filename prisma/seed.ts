import { loadDotEnv } from "../src/lib/env";
loadDotEnv();

import { PrismaClient, type TabKind, type VenueKind, type VenueStatus } from "@prisma/client";
import { fold, slugify } from "../src/lib/normalize";
import { SETTING_DEFAULTS } from "../src/lib/settings";

const prisma = new PrismaClient();

// Lojas conhecidas (validadas na aba Programação em 20/08/2026) + eventos do log.
const VENUES: {
  name: string;
  neighborhood?: string;
  status?: VenueStatus;
  kind?: VenueKind;
  aliases?: string[];
}[] = [
  { name: "Citadel", neighborhood: "Santana" },
  { name: "TamerShop", neighborhood: "Mooca" },
  { name: "Epic", neighborhood: "Liberdade" },
  { name: "Flow", neighborhood: "Vila Prudente" },
  { name: "Kooper", neighborhood: "Vila Leopoldina" },
  { name: "Bazar de Bagdá", neighborhood: "Santana", status: "HIATUS", aliases: ["Bazar"] },
  { name: "Dream Up", neighborhood: "Santa Cruz", status: "HIATUS", aliases: ["DreamUp"] },
  { name: "PlayerStop", neighborhood: "Guarulhos", status: "HIATUS" },
  { name: "MagicRaiz", neighborhood: "Osasco", status: "HIATUS" },
  { name: "Reserva Game Store", neighborhood: "Mooca", status: "HIATUS", aliases: ["Reserva"] },
  { name: "Lendário Card Games", status: "HIATUS", aliases: ["Lendário"] },
  { name: "Mega Geek", neighborhood: "Cambuci", status: "HIATUS" },
  { name: "GLC Brasil", kind: "EVENT" },
  { name: "NZTCG", kind: "EVENT" },
  { name: "LAIC 2025", kind: "EVENT" },
];

const TABS: { title: string; kind: TabKind }[] = [
  { title: "Dados Vitórias", kind: "LOG_PRESENCIAL" },
  { title: "Dados Vitórias Online", kind: "LOG_ONLINE" },
  { title: "Programação", kind: "SCHEDULE" },
  { title: "Rank Geral", kind: "RANK" },
  { title: "Rank Geral 2026", kind: "RANK" },
  { title: "Rank por Loja", kind: "RANK" },
  { title: "Rank Online por Loja", kind: "RANK" },
  { title: "Regras", kind: "RULES" },
  { title: "Lista Jogadores", kind: "PLAYERS" },
  { title: "Decklists", kind: "DECKLISTS" },
];

async function main() {
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }

  for (const tab of TABS) {
    await prisma.sheetTab.upsert({
      where: { title: tab.title },
      create: tab,
      update: {},
    });
  }

  for (const v of VENUES) {
    const venue = await prisma.venue.upsert({
      where: { name: v.name },
      create: {
        name: v.name,
        slug: slugify(v.name),
        neighborhood: v.neighborhood,
        status: v.status ?? "ACTIVE",
        kind: v.kind ?? "STORE",
      },
      update: { neighborhood: v.neighborhood, kind: v.kind ?? "STORE" },
    });
    for (const alias of [v.name, ...(v.aliases ?? [])]) {
      await prisma.venueAlias.upsert({
        where: { normalized: fold(alias) },
        create: { alias, normalized: fold(alias), venueId: venue.id },
        update: {},
      });
    }
  }

  if (process.env.SEED_SAMPLE === "true") {
    await seedSample();
    await seedPhase2Sample();
  }

  console.log("Seed concluído.");
}

/** Dados de exemplo no formato real da planilha (dev sem depender da rede). */
async function seedSample() {
  const rows: [string | null, string, string, string][] = [
    // [data DD/MM/YYYY | null (histórico sem data), loja, jogador, tipo]
    [null, "Flow", "Virginia Cardoso", "Fogo"],
    [null, "Flow", "Virginia Cardoso", "Lutador"],
    [null, "Flow", "Virginia Cardoso", "Lutador"],
    [null, "Flow", "Vinicius Toniatto", "Água"],
    [null, "Citadel", "Rennan Voi", "Psíquico"],
    [null, "Citadel", "Rennan Voi", "Dragão"],
    [null, "Bazar", "Vitor Sikura", "Noturno"],
    [null, "Reserva", "Raphael Morgado", "Planta"],
    ["11/08/2026", "Citadel", "Rennan Voi", "Psíquico"],
    ["11/08/2026", "TamerShop", "Vitor Yukio", "Psíquico"],
    ["19/08/2026", "Citadel", "Guilherme Hitsu", "Lutador"],
    ["19/08/2026", "Citadel", "Weslen Silva", "Incolor"],
    ["19/08/2026", "TamerShop", "Vitor Yukio", "Dragão"],
    ["19/08/2026", "TamerShop", "Akira Hangai", "Incolor"],
  ];

  const { normalizeType, parseBrDate } = await import("../src/lib/normalize");
  const { SyncContext } = await import("../src/lib/sync/context");
  const run = await prisma.syncRun.create({ data: { trigger: "cli" } });
  const ctx = new SyncContext(run.id);
  await ctx.init();

  let i = 0;
  for (const [rawDate, rawVenue, rawPlayer, rawType] of rows) {
    i++;
    const type = normalizeType(rawType);
    if (!type) continue;
    const playerId = await ctx.resolvePlayer(rawPlayer, { canonical: true });
    const venueId = await ctx.resolveVenue(rawVenue, { silent: true });
    await prisma.badgeWin.upsert({
      where: { sourceKey: `seed-${i}` },
      create: {
        sourceKey: `seed-${i}`,
        tabName: "Seed",
        rowIndex: i,
        date: rawDate ? parseBrDate(rawDate) : null,
        rawDate,
        rawVenue,
        rawPlayer,
        rawType,
        modality: "PRESENCIAL",
        type,
        playerId,
        venueId,
      },
      update: {},
    });
  }
  await prisma.syncRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), ok: true, stats: { seedSample: rows.length } },
  });
  console.log(`Seed de exemplo: ${rows.length} insígnias.`);
}

/**
 * Fase 2 (dev): contas fake, cartas de exemplo e um deck publicado, para
 * trabalhar no deck builder sem rodar o import completo do pokemon-tcg-data.
 * Senha de todas as contas: "senha123".
 */
async function seedPhase2Sample() {
  const bcrypt = (await import("bcryptjs")).default;
  const { fold: foldStr } = await import("../src/lib/normalize");
  const passwordHash = await bcrypt.hash("senha123", 12);

  // --- cartas de exemplo (deck Lutador + cartas ilegais p/ testar bloqueio) ---
  const cards: {
    id: string;
    name: string;
    supertype: string;
    subtypes?: string[];
    types?: string[];
    hp?: number;
    rules?: string[];
    setId: string;
    setName: string;
    setPtcgoCode?: string;
    setReleaseDate?: string;
    number: string;
    rarity?: string;
    hasRuleBox?: boolean;
    isAceSpec?: boolean;
    isBasicEnergy?: boolean;
    glcLegal?: boolean;
    attacks?: object[];
  }[] = [
    { id: "sv3pt5-56", name: "Riolu", supertype: "Pokémon", subtypes: ["Basic"], types: ["Fighting"], hp: 70, setId: "sv3pt5", setName: "151", setPtcgoCode: "MEW", setReleaseDate: "2023/09/22", number: "56", attacks: [{ name: "Jab", convertedEnergyCost: 1 }] },
    { id: "sv3pt5-57", name: "Lucario", supertype: "Pokémon", subtypes: ["Stage 1"], types: ["Fighting"], hp: 120, setId: "sv3pt5", setName: "151", setPtcgoCode: "MEW", setReleaseDate: "2023/09/22", number: "57", attacks: [{ name: "Aura Sphere", convertedEnergyCost: 2 }] },
    { id: "sv1-107", name: "Sudowoodo", supertype: "Pokémon", subtypes: ["Basic"], types: ["Fighting"], hp: 110, setId: "sv1", setName: "Scarlet & Violet", setPtcgoCode: "SVI", setReleaseDate: "2023/03/31", number: "107", attacks: [{ name: "Watch and Learn", convertedEnergyCost: 2 }] },
    { id: "sm115-33", name: "Hitmonchan", supertype: "Pokémon", subtypes: ["Basic"], types: ["Fighting"], hp: 90, setId: "sm115", setName: "Hidden Fates", setPtcgoCode: "HIF", setReleaseDate: "2019/08/23", number: "33", attacks: [{ name: "Jab", convertedEnergyCost: 1 }, { name: "Magnum Punch", convertedEnergyCost: 3 }] },
    { id: "swsh9-79", name: "Regirock", supertype: "Pokémon", subtypes: ["Basic"], types: ["Fighting"], hp: 120, setId: "swsh9", setName: "Brilliant Stars", setPtcgoCode: "BRS", setReleaseDate: "2022/02/25", number: "79", attacks: [{ name: "Rock Throw", convertedEnergyCost: 2 }] },
    { id: "sv2-135", name: "Rabsca", supertype: "Pokémon", subtypes: ["Stage 1"], types: ["Psychic"], hp: 80, setId: "sv2", setName: "Paldea Evolved", setPtcgoCode: "PAL", setReleaseDate: "2023/06/09", number: "135", attacks: [{ name: "Revival Blessing", convertedEnergyCost: 1 }] },
    { id: "sv1-196", name: "Arven", supertype: "Trainer", subtypes: ["Supporter"], rules: ["Search your deck for an Item card and a Pokémon Tool card, reveal them, and put them into your hand. Then, shuffle your deck."], setId: "sv1", setName: "Scarlet & Violet", setPtcgoCode: "SVI", setReleaseDate: "2023/03/31", number: "196" },
    { id: "sv1-181", name: "Professor's Research", supertype: "Trainer", subtypes: ["Supporter"], rules: ["Discard your hand and draw 7 cards."], setId: "sv1", setName: "Scarlet & Violet", setPtcgoCode: "SVI", setReleaseDate: "2023/03/31", number: "181" },
    { id: "sv1-190", name: "Ultra Ball", supertype: "Trainer", subtypes: ["Item"], rules: ["Discard 2 cards from your hand. Search your deck for a Pokémon, reveal it, and put it into your hand."], setId: "sv1", setName: "Scarlet & Violet", setPtcgoCode: "SVI", setReleaseDate: "2023/03/31", number: "190" },
    { id: "sv1-191", name: "Rare Candy", supertype: "Trainer", subtypes: ["Item"], rules: ["Choose 1 of your Basic Pokémon in play. If you have a Stage 2 card in your hand that evolves from that Pokémon, put that card onto the Basic Pokémon."], setId: "sv1", setName: "Scarlet & Violet", setPtcgoCode: "SVI", setReleaseDate: "2023/03/31", number: "191" },
    { id: "sv2-188", name: "Super Rod", supertype: "Trainer", subtypes: ["Item"], rules: ["Shuffle up to 3 in any combination of Pokémon and Basic Energy cards from your discard pile into your deck."], setId: "sv2", setName: "Paldea Evolved", setPtcgoCode: "PAL", setReleaseDate: "2023/06/09", number: "188" },
    { id: "sve-6", name: "Basic Fighting Energy", supertype: "Energy", subtypes: ["Basic"], isBasicEnergy: true, setId: "sve", setName: "Scarlet & Violet Energies", setPtcgoCode: "SVE", setReleaseDate: "2023/03/31", number: "6" },
    // ilegais — para testar o bloqueio visual no builder
    { id: "sv4-70", name: "Great Tusk ex", supertype: "Pokémon", subtypes: ["Basic", "ex"], types: ["Fighting"], hp: 250, rules: ["Pokémon ex rule: When your Pokémon ex is Knocked Out, your opponent takes 2 Prize cards."], hasRuleBox: true, glcLegal: false, setId: "sv4", setName: "Paradox Rift", setPtcgoCode: "PAR", setReleaseDate: "2023/11/03", number: "70" },
    { id: "sv4-186", name: "Awakening Drum", supertype: "Trainer", subtypes: ["Item", "ACE SPEC"], rules: ["ACE SPEC: You can't have more than 1 ACE SPEC card in your deck."], isAceSpec: true, glcLegal: false, setId: "sv4", setName: "Paradox Rift", setPtcgoCode: "PAR", setReleaseDate: "2023/11/03", number: "186" },
  ];

  for (const c of cards) {
    await prisma.card.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        name: c.name,
        nameNormalized: foldStr(c.name),
        supertype: c.supertype,
        subtypes: c.subtypes ?? [],
        types: c.types ?? [],
        hp: c.hp ?? null,
        rules: c.rules ?? [],
        attacks: c.attacks ?? undefined,
        setId: c.setId,
        setName: c.setName,
        setPtcgoCode: c.setPtcgoCode ?? null,
        setReleaseDate: c.setReleaseDate ?? null,
        number: c.number,
        rarity: c.rarity ?? null,
        imageSmall: `https://images.pokemontcg.io/${c.setId}/${c.number}.png`,
        imageLarge: `https://images.pokemontcg.io/${c.setId}/${c.number}_hires.png`,
        hasRuleBox: c.hasRuleBox ?? false,
        isAceSpec: c.isAceSpec ?? false,
        isBasicEnergy: c.isBasicEnergy ?? false,
        glcLegal: c.glcLegal ?? true,
      },
      update: {},
    });
  }

  // --- contas ---
  const admin = await prisma.user.upsert({
    where: { email: "admin@glchub.local" },
    create: {
      email: "admin@glchub.local",
      displayName: "Admin da Liga",
      passwordHash,
      role: "ADMIN",
      emailVerifiedAt: new Date(),
    },
    update: {},
  });

  const flow = await prisma.venue.findUnique({ where: { name: "Flow" } });
  await prisma.user.upsert({
    where: { email: "loja@glchub.local" },
    create: {
      email: "loja@glchub.local",
      displayName: "Flow TCG",
      passwordHash,
      role: "STORE",
      emailVerifiedAt: new Date(),
      venueId: flow?.id,
    },
    update: {},
  });

  const virginia = await prisma.player.findFirst({ where: { name: "Virginia Cardoso" } });
  const playerUser = await prisma.user.upsert({
    where: { email: "jogador@glchub.local" },
    create: {
      email: "jogador@glchub.local",
      displayName: "Virginia",
      passwordHash,
      role: "PLAYER",
      emailVerifiedAt: new Date(),
      favoriteType: "FIGHTING",
      playerId: virginia?.id,
    },
    update: {},
  });
  if (virginia) {
    await prisma.profileClaim.upsert({
      where: { userId_playerId: { userId: playerUser.id, playerId: virginia.id } },
      create: {
        userId: playerUser.id,
        playerId: virginia.id,
        status: "APPROVED",
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
      update: {},
    });
  }

  // --- deck de exemplo publicado ---
  const deckEntries: { id: string; qty: number; category: "POKEMON" | "TRAINER" | "ENERGY" }[] = [
    { id: "sv3pt5-56", qty: 1, category: "POKEMON" },
    { id: "sv3pt5-57", qty: 1, category: "POKEMON" },
    { id: "sv1-107", qty: 1, category: "POKEMON" },
    { id: "sm115-33", qty: 1, category: "POKEMON" },
    { id: "swsh9-79", qty: 1, category: "POKEMON" },
    { id: "sv1-196", qty: 1, category: "TRAINER" },
    { id: "sv1-181", qty: 1, category: "TRAINER" },
    { id: "sv1-190", qty: 1, category: "TRAINER" },
    { id: "sv1-191", qty: 1, category: "TRAINER" },
    { id: "sv2-188", qty: 1, category: "TRAINER" },
    { id: "sve-6", qty: 50, category: "ENERGY" }, // completa 60 no exemplo
  ];
  const existingDeck = await prisma.deck.findUnique({ where: { slug: "lutador-exemplo" } });
  if (!existingDeck) {
    await prisma.deck.create({
      data: {
        slug: "lutador-exemplo",
        title: "Lutador de exemplo (seed)",
        type: "FIGHTING",
        guide: "## Deck de exemplo\nCriado pelo seed para desenvolvimento do builder e da galeria.",
        isPublic: true,
        source: "BUILDER",
        authorUserId: playerUser.id,
        playerId: virginia?.id,
        coverCardId: "swsh9-79",
        versions: {
          create: {
            version: 1,
            changelog: "versão inicial (seed)",
            cards: {
              create: deckEntries.map((e) => ({
                cardId: e.id,
                rawName: cards.find((c) => c.id === e.id)?.name ?? e.id,
                quantity: e.qty,
                category: e.category,
              })),
            },
          },
        },
      },
    });
  }

  // banlist inicial (editável no admin)
  await prisma.banlistEntry.upsert({
    where: { cardName: "Lysandre's Trump Card" },
    create: { cardName: "Lysandre's Trump Card", reason: "banida em todos os formatos" },
    update: {},
  });

  console.log(
    "Seed Fase 2: contas admin@glchub.local / loja@glchub.local / jogador@glchub.local (senha: senha123), cartas e deck de exemplo.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
