import type { Modality } from "@prisma/client";
import { prisma } from "../db";
import { fold } from "../normalize";
import { fetchTab } from "../sheets";
import { getSeason2026Start } from "../settings";
import { TYPES } from "../types";
import type { SyncContext } from "./context";

/**
 * As abas de rank são DERIVADAS e têm duplicatas conhecidas — nunca são fonte.
 * Aqui elas viram teste de reconciliação: recalculamos tudo do log bruto e
 * comparamos, reportando divergências como issues no painel admin.
 *
 * Estrutura de bloco (repetida em "Rank por Loja"/"Rank Online por Loja"):
 *   linha-título (nome da loja na col 2) → cabeçalho ("Jogador" na col 2) →
 *   dados: col0 = # Vitórias, col1 = # Insígnias, col2 = Jogador,
 *   col3..13 = contagens dos 11 tipos na ordem canônica.
 */

export type RankEntry = { name: string; wins: number; badges: number };
type RankBlock = { title: string | null; entries: RankEntry[] };

/**
 * Layout das abas OCULTAS por loja (descobertas por sondagem — não aparecem
 * no htmlview): linha 0 = "Rank Geral {Loja} - GLC", linha 1 = "Endereço: ...",
 * cabeçalho com "Nome Jogador" na col 1 e col 0 = "vitórias / insígnias".
 * Retorna null se a aba não tem essa assinatura (importante: o gviz devolve a
 * PRIMEIRA aba da planilha silenciosamente quando o nome não existe).
 */
export function parseStoreRankTab(
  rows: string[][],
): { address: string | null; entries: RankEntry[] } | null {
  const headerIdx = rows.findIndex((r) => fold(r[1] ?? "").includes("nome jogador"));
  const hasTitle = rows
    .slice(0, 3)
    .some((r) => fold(r[1] ?? "").includes("rank geral"));
  if (headerIdx < 0 || !hasTitle) return null;

  let address: string | null = null;
  for (const row of rows.slice(0, headerIdx)) {
    const cell = (row[1] ?? "").trim();
    if (/^endere[cç]o:/i.test(cell)) address = cell.replace(/^endere[cç]o:\s*/i, "").trim();
  }

  const entries: RankEntry[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const name = (rows[r][1] ?? "").trim();
    const m = (rows[r][0] ?? "").match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (!name && !m) break;
    if (!name || !m) continue;
    entries.push({ name, wins: Number(m[1]), badges: Number(m[2]) });
  }
  return { address, entries };
}

export function parseRankBlocks(rows: string[][]): RankBlock[] {
  const blocks: RankBlock[] = [];
  let lastTitle: string | null = null;

  for (let r = 0; r < rows.length; r++) {
    const col2 = (rows[r][2] ?? "").trim();
    if (fold(col2) === "jogador") {
      const block: RankBlock = { title: lastTitle, entries: [] };
      for (let d = r + 1; d < rows.length; d++) {
        const name = (rows[d][2] ?? "").trim();
        const wins = Number.parseInt(rows[d][0] ?? "", 10);
        if (!name || fold(name) === "jogador") break;
        if (Number.isNaN(wins)) break;
        block.entries.push({
          name,
          wins,
          badges: Number.parseInt(rows[d][1] ?? "0", 10) || 0,
        });
        r = d;
      }
      blocks.push(block);
      lastTitle = null;
    } else if (col2 && !/ltima atualiza/i.test(col2)) {
      lastTitle = col2; // candidata a título do próximo bloco
    }
  }
  return blocks;
}

type Computed = Map<string, { wins: number; types: Set<string> }>; // playerId → agregado

async function computeRanking(where: {
  modality?: Modality;
  venueId?: string;
  dateFrom?: Date;
}): Promise<Computed> {
  const badges = await prisma.badgeWin.findMany({
    where: {
      status: "ACTIVE",
      modality: where.modality,
      venueId: where.venueId,
      date: where.dateFrom ? { gte: where.dateFrom } : undefined,
    },
    select: { playerId: true, type: true },
  });
  const map: Computed = new Map();
  for (const b of badges) {
    const agg = map.get(b.playerId) ?? { wins: 0, types: new Set<string>() };
    agg.wins++;
    agg.types.add(b.type);
    map.set(b.playerId, agg);
  }
  return map;
}

type Diff = {
  player: string;
  sheet: { wins: number; badges: number };
  computed: { wins: number; badges: number };
  note?: string;
};

async function diffScope(
  ctx: SyncContext,
  scope: string,
  entries: RankEntry[],
  computed: Computed,
): Promise<Diff[]> {
  // Duplicatas na planilha (problema conhecido) são somadas antes de comparar
  const sheetByNorm = new Map<string, RankEntry>();
  for (const e of entries) {
    if (e.wins === 0 && e.badges === 0) continue; // participantes 0/0: irrelevantes
    const norm = fold(e.name);
    const prev = sheetByNorm.get(norm);
    if (prev) {
      prev.wins += e.wins;
      prev.badges = Math.max(prev.badges, e.badges);
    } else {
      sheetByNorm.set(norm, { ...e });
    }
  }

  const players = await prisma.player.findMany({ select: { id: true, name: true } });
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  const diffs: Diff[] = [];
  const matchedPlayerIds = new Set<string>();

  for (const [norm, e] of sheetByNorm) {
    const playerId = ctx.lookupPlayer(norm);
    if (!playerId) {
      diffs.push({
        player: e.name,
        sheet: { wins: e.wins, badges: e.badges },
        computed: { wins: 0, badges: 0 },
        note: "jogador do rank não reconhecido no log (alias faltando?)",
      });
      continue;
    }
    matchedPlayerIds.add(playerId);
    const c = computed.get(playerId) ?? { wins: 0, types: new Set<string>() };
    if (c.wins !== e.wins || c.types.size !== e.badges) {
      diffs.push({
        player: nameById.get(playerId) ?? e.name,
        sheet: { wins: e.wins, badges: e.badges },
        computed: { wins: c.wins, badges: c.types.size },
      });
    }
  }

  // Jogadores com vitórias calculadas que não aparecem no rank da planilha
  for (const [playerId, c] of computed) {
    if (matchedPlayerIds.has(playerId) || c.wins === 0) continue;
    diffs.push({
      player: nameById.get(playerId) ?? playerId,
      sheet: { wins: 0, badges: 0 },
      computed: { wins: c.wins, badges: c.types.size },
      note: "presente no log, ausente no rank da planilha",
    });
  }

  return diffs;
}

export type ReconcileStats = { scopes: number; scopesWithDiffs: number; diffs: number };

export async function reconcileRanks(
  ctx: SyncContext,
  rankTabs: { title: string }[],
): Promise<ReconcileStats> {
  const season2026 = await getSeason2026Start();
  const stats: ReconcileStats = { scopes: 0, scopesWithDiffs: 0, diffs: 0 };

  for (const tab of rankTabs) {
    const norm = fold(tab.title);
    let rows: string[][];
    try {
      rows = await fetchTab(tab.title);
    } catch {
      continue; // aba de rank inacessível não é crítico
    }

    // Formato "aba oculta por loja"? (título da aba = nome da loja)
    const storeRank = parseStoreRankTab(rows);
    if (storeRank) {
      stats.scopes++;
      const venueId = ctx.lookupVenue(tab.title);
      const scope = `Aba da loja "${tab.title}" (presencial)`;
      if (!venueId) {
        await ctx.addIssue(
          "RANK_MISMATCH",
          `Reconciliação: aba de rank "${tab.title}" não corresponde a nenhuma loja conhecida`,
          { scope },
          true,
        );
        stats.scopesWithDiffs++;
        continue;
      }
      if (storeRank.address) {
        await prisma.venue.update({
          where: { id: venueId },
          data: { address: storeRank.address },
        });
      }
      const computed = await computeRanking({ venueId, modality: "PRESENCIAL" });
      const diffs = await diffScope(ctx, scope, storeRank.entries, computed);
      if (diffs.length) {
        stats.scopesWithDiffs++;
        stats.diffs += diffs.length;
        await ctx.addIssue(
          "RANK_MISMATCH",
          `Reconciliação divergente: ${scope} (${diffs.length} jogador(es))`,
          { scope, diffs: JSON.parse(JSON.stringify(diffs)) },
          true,
        );
      }
      continue;
    }

    const blocks = parseRankBlocks(rows);

    for (const block of blocks) {
      if (!block.entries.length) continue;
      stats.scopes++;

      let scope: string;
      let computed: Computed;
      if (norm === "rank geral") {
        scope = "Rank Geral (combinado, histórico completo)";
        computed = await computeRanking({});
      } else if (norm === "rank geral 2026") {
        scope = "Rank Geral 2026 (combinado, registros datados)";
        computed = await computeRanking({ dateFrom: season2026 });
      } else {
        const venueName = block.title ?? "?";
        const venueId = ctx.lookupVenue(venueName);
        const modality: Modality = norm.includes("online") ? "ONLINE" : "PRESENCIAL";
        scope = `${tab.title} → ${venueName}`;
        if (!venueId) {
          await ctx.addIssue(
            "RANK_MISMATCH",
            `Reconciliação: bloco "${venueName}" em "${tab.title}" não corresponde a nenhuma loja conhecida`,
            { scope },
            true,
          );
          stats.scopesWithDiffs++;
          continue;
        }
        computed = await computeRanking({ venueId, modality });
      }

      const diffs = await diffScope(ctx, scope, block.entries, computed);
      if (diffs.length) {
        stats.scopesWithDiffs++;
        stats.diffs += diffs.length;
        await ctx.addIssue(
          "RANK_MISMATCH",
          `Reconciliação divergente: ${scope} (${diffs.length} jogador(es))`,
          { scope, typeOrder: TYPES.map((t) => t.pt), diffs: JSON.parse(JSON.stringify(diffs)) },
          true,
        );
      }
    }
  }
  return stats;
}
