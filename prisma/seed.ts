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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
