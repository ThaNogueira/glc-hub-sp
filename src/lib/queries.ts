import type { Modality, PokemonType, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getSeason2026Start } from "./settings";
import { TYPES } from "./types";

// ---------------------------------------------------------------------------
// Filtros comuns (modalidade / loja / temporada) usados no meta e nos rankings
// ---------------------------------------------------------------------------

export type MetaFilters = {
  modality?: "presencial" | "online";
  venue?: string; // slug
  season?: "2026" | "historico";
};

export function parseFilters(sp: Record<string, string | string[] | undefined>): MetaFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const modality = one(sp.modalidade);
  const season = one(sp.temporada);
  return {
    modality: modality === "presencial" || modality === "online" ? modality : undefined,
    venue: one(sp.loja) || undefined,
    season: season === "2026" || season === "historico" ? season : undefined,
  };
}

export async function buildBadgeWhere(f: MetaFilters): Promise<Prisma.BadgeWinWhereInput> {
  const where: Prisma.BadgeWinWhereInput = { status: "ACTIVE" };
  if (f.modality) where.modality = (f.modality === "online" ? "ONLINE" : "PRESENCIAL") as Modality;
  if (f.venue) where.venue = { slug: f.venue };
  if (f.season === "2026") {
    where.date = { gte: await getSeason2026Start() };
  } else if (f.season === "historico") {
    // registros sem data contam apenas no histórico
    where.OR = [{ date: null }, { date: { lt: await getSeason2026Start() } }];
  }
  return where;
}

export async function getVenuesForFilter() {
  return prisma.venue.findMany({
    where: { badges: { some: { status: "ACTIVE" } } },
    select: { slug: true, name: true, kind: true },
    orderBy: { name: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Meta view
// ---------------------------------------------------------------------------

export type MetaShareRow = {
  type: PokemonType;
  count: number;
  share: number; // 0..1
  delta: number | null; // vitórias últimos 60 dias − 60 dias anteriores
  topPlayer: { name: string; slug: string; wins: number } | null;
};

export async function getMetaShare(f: MetaFilters) {
  const where = await buildBadgeWhere(f);
  const badges = await prisma.badgeWin.findMany({
    where,
    select: { type: true, playerId: true, date: true },
  });
  const total = badges.length;
  const players = new Set(badges.map((b) => b.playerId));

  // variação: janela de 60 dias vs os 60 dias anteriores (só registros datados)
  const now = Date.now();
  const d60 = new Date(now - 60 * 86_400_000);
  const d120 = new Date(now - 120 * 86_400_000);
  const recentByType = new Map<PokemonType, number>();
  const priorByType = new Map<PokemonType, number>();
  let hasDated = false;
  for (const b of badges) {
    if (!b.date) continue;
    hasDated = true;
    if (b.date >= d60) recentByType.set(b.type, (recentByType.get(b.type) ?? 0) + 1);
    else if (b.date >= d120) priorByType.set(b.type, (priorByType.get(b.type) ?? 0) + 1);
  }

  const byType = new Map<PokemonType, Map<string, number>>();
  for (const b of badges) {
    const m = byType.get(b.type) ?? new Map<string, number>();
    m.set(b.playerId, (m.get(b.playerId) ?? 0) + 1);
    byType.set(b.type, m);
  }

  const playerIds = [...players];
  const playerRows = playerIds.length
    ? await prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const playerById = new Map(playerRows.map((p) => [p.id, p]));

  const rows: MetaShareRow[] = TYPES.map((t) => {
    const m = byType.get(t.id) ?? new Map<string, number>();
    let count = 0;
    let top: MetaShareRow["topPlayer"] = null;
    for (const [pid, wins] of m) {
      count += wins;
      if (!top || wins > top.wins) {
        const p = playerById.get(pid);
        if (p) top = { name: p.name, slug: p.slug, wins };
      }
    }
    return {
      type: t.id,
      count,
      share: total ? count / total : 0,
      delta: hasDated
        ? (recentByType.get(t.id) ?? 0) - (priorByType.get(t.id) ?? 0)
        : null,
      topPlayer: top,
    };
  }).sort((a, b) => b.count - a.count);

  return { total, distinctPlayers: players.size, rows };
}

// ---------------------------------------------------------------------------
// Rankings recalculados (sem duplicatas — direto do log bruto)
// ---------------------------------------------------------------------------

export type RankingRow = {
  player: { id: string; name: string; slug: string };
  wins: number;
  badges: number; // tipos distintos
  signature: PokemonType | null; // tipo com mais vitórias do jogador
  perType: Partial<Record<PokemonType, number>>;
};

export async function getRankings(
  f: MetaFilters,
  sort: "vitorias" | "insignias" = "vitorias",
): Promise<RankingRow[]> {
  const where = await buildBadgeWhere(f);
  const badges = await prisma.badgeWin.findMany({
    where,
    select: { playerId: true, type: true },
  });
  const agg = new Map<string, { wins: number; perType: Map<PokemonType, number> }>();
  for (const b of badges) {
    const a = agg.get(b.playerId) ?? { wins: 0, perType: new Map<PokemonType, number>() };
    a.wins++;
    a.perType.set(b.type, (a.perType.get(b.type) ?? 0) + 1);
    agg.set(b.playerId, a);
  }
  const players = agg.size
    ? await prisma.player.findMany({
        where: { id: { in: [...agg.keys()] } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const playerById = new Map(players.map((p) => [p.id, p]));

  const rows: RankingRow[] = [...agg.entries()]
    .map(([playerId, a]) => ({
      player: playerById.get(playerId) ?? { id: playerId, name: "?", slug: "" },
      wins: a.wins,
      badges: a.perType.size,
      signature:
        [...a.perType.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null,
      perType: Object.fromEntries(a.perType) as Partial<Record<PokemonType, number>>,
    }))
    .sort((a, b) =>
      sort === "insignias"
        ? b.badges - a.badges || b.wins - a.wins || a.player.name.localeCompare(b.player.name)
        : b.wins - a.wins || b.badges - a.badges || a.player.name.localeCompare(b.player.name),
    );
  return rows;
}

// ---------------------------------------------------------------------------
// Rodapé: frescor dos dados
// ---------------------------------------------------------------------------

export async function getDataFreshness() {
  const [lastSync, logTabs] = await Promise.all([
    prisma.syncRun.findFirst({
      where: { ok: true },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
    prisma.sheetTab.findMany({
      where: { kind: { in: ["LOG_PRESENCIAL", "LOG_ONLINE"] }, lastUpdatedNote: { not: null } },
      select: { title: true, lastUpdatedNote: true },
    }),
  ]);
  return { lastSyncAt: lastSync?.finishedAt ?? null, sheetNotes: logTabs };
}
