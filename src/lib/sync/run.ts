import type { TabKind } from "@prisma/client";
import { prisma } from "../db";
import { fold } from "../normalize";
import { discoverTabTitles, fetchTab } from "../sheets";
import { SyncContext } from "./context";
import { syncDecklists } from "./decklists";
import { syncLogTab } from "./logs";
import { syncPlayersList } from "./players";
import { parseStoreRankTab, reconcileRanks } from "./reconcile";
import { syncSchedule } from "./schedule";

/**
 * As abas de rank por loja são OCULTAS (não aparecem no /htmlview), mas o gviz
 * as serve por nome. Sonda os nomes das lojas conhecidas; a assinatura do
 * conteúdo evita falsos positivos (para nome inexistente o gviz devolve a
 * primeira aba da planilha em silêncio).
 */
async function probeHiddenStoreTabs(ctx: SyncContext): Promise<number> {
  const known = new Set((await prisma.sheetTab.findMany()).map((t) => fold(t.title)));
  // testa nomes canônicos E aliases (a aba oculta usa o nome curto do log,
  // ex.: "Reserva", enquanto o venue canônico é "Reserva Game Store")
  const [venues, aliases] = await Promise.all([
    prisma.venue.findMany({ select: { name: true } }),
    prisma.venueAlias.findMany({ select: { alias: true } }),
  ]);
  const candidates = new Map<string, string>();
  for (const c of [...venues.map((v) => v.name), ...aliases.map((a) => a.alias)]) {
    const norm = fold(c);
    if (!known.has(norm) && !candidates.has(norm)) candidates.set(norm, c);
  }
  let found = 0;
  for (const name of candidates.values()) {
    try {
      const rows = await fetchTab(name);
      if (parseStoreRankTab(rows)) {
        await prisma.sheetTab.create({ data: { title: name, kind: "RANK" } });
        found++;
      }
    } catch {
      // aba não existe / sem acesso — normal
    }
  }
  return found;
}

/** Classificação automática de abas conhecidas (o admin pode reclassificar). */
function autoClassify(title: string): TabKind {
  const n = fold(title);
  if (n === "dados vitorias") return "LOG_PRESENCIAL";
  if (n === "dados vitorias online") return "LOG_ONLINE";
  if (n === "programacao") return "SCHEDULE";
  if (n.startsWith("rank")) return "RANK";
  if (n === "regras") return "RULES";
  if (n === "lista jogadores") return "PLAYERS";
  if (n === "decklists") return "DECKLISTS";
  return "UNCLASSIFIED";
}

export async function runSync(trigger: "worker" | "manual" | "cli"): Promise<string> {
  const run = await prisma.syncRun.create({ data: { trigger } });
  const ctx = new SyncContext(run.id);
  const stats: Record<string, unknown> = {};
  const errors: string[] = [];

  try {
    await ctx.init();

    // 1. Descoberta dinâmica de abas
    let titles: string[] = [];
    try {
      titles = await discoverTabTitles();
    } catch (e) {
      errors.push(`descoberta de abas: ${(e as Error).message}`);
      titles = (await prisma.sheetTab.findMany()).map((t) => t.title);
    }
    for (const title of titles) {
      const existing = await prisma.sheetTab.findUnique({ where: { title } });
      if (existing) {
        await prisma.sheetTab.update({ where: { title }, data: { lastSeenAt: new Date() } });
      } else {
        const kind = autoClassify(title);
        await prisma.sheetTab.create({ data: { title, kind } });
        if (kind === "UNCLASSIFIED") {
          await ctx.addIssue(
            "NEW_TAB",
            `Aba nova descoberta: "${title}" — classificar no admin (log, rank, ignorar...)`,
            { title },
            true,
          );
        }
      }
    }
    const tabs = await prisma.sheetTab.findMany();

    // 2. Lista canônica de jogadores primeiro (alimenta a resolução de nomes)
    for (const tab of tabs.filter((t) => t.kind === "PLAYERS")) {
      try {
        stats[`players:${tab.title}`] = await syncPlayersList(ctx, tab.title);
      } catch (e) {
        errors.push(`${tab.title}: ${(e as Error).message}`);
      }
    }

    // 3. Logs — a fonte da verdade
    for (const tab of tabs.filter((t) => t.kind === "LOG_PRESENCIAL" || t.kind === "LOG_ONLINE")) {
      try {
        stats[`log:${tab.title}`] = await syncLogTab(
          ctx,
          tab.title,
          tab.kind === "LOG_ONLINE" ? "ONLINE" : "PRESENCIAL",
        );
      } catch (e) {
        errors.push(`${tab.title}: ${(e as Error).message}`);
      }
    }

    // 4. Programação (agenda, lojas, status ativa/hiato)
    for (const tab of tabs.filter((t) => t.kind === "SCHEDULE")) {
      try {
        stats[`schedule:${tab.title}`] = await syncSchedule(ctx, tab.title);
      } catch (e) {
        errors.push(`${tab.title}: ${(e as Error).message}`);
      }
    }

    // 5. Decklists (links externos)
    for (const tab of tabs.filter((t) => t.kind === "DECKLISTS")) {
      try {
        stats[`decklists:${tab.title}`] = await syncDecklists(ctx, tab.title);
      } catch (e) {
        errors.push(`${tab.title}: ${(e as Error).message}`);
      }
    }

    // 6. Sondagem de abas ocultas de rank por loja (endereços + reconciliação)
    try {
      stats.hiddenTabsFound = await probeHiddenStoreTabs(ctx);
    } catch (e) {
      errors.push(`sondagem de abas ocultas: ${(e as Error).message}`);
    }

    // 7. Reconciliação com os ranks derivados (validação, nunca fonte)
    try {
      const rankTabs = await prisma.sheetTab.findMany({ where: { kind: "RANK" } });
      stats.reconcile = await reconcileRanks(ctx, rankTabs);
    } catch (e) {
      errors.push(`reconciliação: ${(e as Error).message}`);
    }

    stats.issuesCreated = ctx.issueCount;
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        ok: errors.length === 0,
        stats: JSON.parse(JSON.stringify(stats)),
        error: errors.length ? errors.join(" | ") : null,
      },
    });
  } catch (e) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        ok: false,
        stats: JSON.parse(JSON.stringify(stats)),
        error: (e as Error).message,
      },
    });
    throw e;
  }
  return run.id;
}
