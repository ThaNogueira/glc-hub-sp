import { createHash } from "node:crypto";
import type { Modality, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { fold, normalizeType, parseBrDate } from "../normalize";
import { extractLastUpdatedNote, fetchTab } from "../sheets";
import type { SyncContext } from "./context";

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Acha o índice de uma coluna cujo cabeçalho contém `needle` (após fold). */
function findCol(header: string[], needle: string, fallback: number): number {
  const i = header.findIndex((c) => fold(c).includes(needle));
  return i >= 0 ? i : fallback;
}

export type LogTabStats = {
  rows: number;
  imported: number;
  restored: number;
  skipped: number;
  missing: number;
};

/**
 * Importa uma aba de log ("Dados Vitórias" / "Dados Vitórias Online").
 * Cada linha = uma insígnia. Idempotente via sourceKey determinística
 * (hash de aba + conteúdo + nº da ocorrência), estável sob reordenação.
 */
export async function syncLogTab(
  ctx: SyncContext,
  tabTitle: string,
  modality: Modality,
): Promise<LogTabStats> {
  const rows = await fetchTab(tabTitle);
  const note = extractLastUpdatedNote(rows);

  // Cabeçalho detectado por conteúdo, nunca por posição fixa
  const headerIdx = rows.findIndex((row) => row.some((c) => fold(c).includes("vencedor")));
  if (headerIdx < 0) throw new Error(`Aba "${tabTitle}": cabeçalho (coluna "Vencedor") não encontrado`);
  const header = rows[headerIdx];
  const dateCol = findCol(header, "data", 0);
  const venueCol = findCol(header, "loja", 1);
  const playerCol = findCol(header, "vencedor", 2);
  const typeCol = findCol(header, "tipo", 3);

  const existing = new Map(
    (
      await prisma.badgeWin.findMany({
        where: { tabName: tabTitle, origin: "SHEET" },
        select: { sourceKey: true, status: true },
      })
    ).map((b) => [b.sourceKey, b.status]),
  );

  const occurrences = new Map<string, number>();
  const seen = new Set<string>();
  const toCreate: Prisma.BadgeWinCreateManyInput[] = [];
  const toRestore: string[] = [];
  const stats: LogTabStats = { rows: 0, imported: 0, restored: 0, skipped: 0, missing: 0 };

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const rawDate = (row[dateCol] ?? "").trim();
    const rawVenue = (row[venueCol] ?? "").trim();
    const rawPlayer = (row[playerCol] ?? "").trim();
    const rawType = (row[typeCol] ?? "").trim();

    if (!rawVenue && !rawPlayer && !rawType) continue; // linha vazia
    stats.rows++;

    if (!rawVenue || !rawPlayer || !rawType) {
      stats.skipped++;
      await ctx.addIssue(
        "PARSE_WARNING",
        `${tabTitle}, linha ${r + 1}: campos obrigatórios ausentes`,
        { row: row.slice(0, 4) },
        true,
      );
      continue;
    }

    const type = normalizeType(rawType);
    if (!type) {
      stats.skipped++;
      await ctx.addIssue(
        "UNKNOWN_TYPE",
        `${tabTitle}, linha ${r + 1}: tipo não reconhecido "${rawType}"`,
        { row: row.slice(0, 4) },
        true,
      );
      continue;
    }

    const date = rawDate ? parseBrDate(rawDate) : null;
    if (rawDate && !date) {
      await ctx.addIssue(
        "PARSE_WARNING",
        `${tabTitle}, linha ${r + 1}: data ilegível "${rawDate}" — importada sem data`,
        { row: row.slice(0, 4) },
        true,
      );
    }

    const tupleKey = [tabTitle, fold(rawDate), fold(rawVenue), fold(rawPlayer), fold(rawType)].join("|");
    const n = (occurrences.get(tupleKey) ?? 0) + 1;
    occurrences.set(tupleKey, n);
    const sourceKey = sha256(`${tupleKey}|${n}`);
    seen.add(sourceKey);

    const prior = existing.get(sourceKey);
    if (prior === "ACTIVE" || prior === "PENDING_REVIEW") continue; // já importada
    if (prior === "MISSING_IN_SHEET") {
      toRestore.push(sourceKey); // a linha voltou
      continue;
    }

    const playerId = await ctx.resolvePlayer(rawPlayer);
    const venueId = await ctx.resolveVenue(rawVenue);
    toCreate.push({
      sourceKey,
      tabName: tabTitle,
      rowIndex: r + 1,
      date,
      rawDate: rawDate || null,
      rawVenue,
      rawPlayer,
      rawType,
      modality,
      type,
      playerId,
      venueId,
      origin: "SHEET",
      firstSyncId: ctx.runId,
      lastSeenSyncId: ctx.runId,
    });
  }

  if (toCreate.length) {
    await prisma.badgeWin.createMany({ data: toCreate, skipDuplicates: true });
    stats.imported = toCreate.length;
  }
  if (toRestore.length) {
    await prisma.badgeWin.updateMany({
      where: { sourceKey: { in: toRestore } },
      data: { status: "ACTIVE", lastSeenSyncId: ctx.runId },
    });
    stats.restored = toRestore.length;
  }

  // Linhas que existiam no banco e sumiram da planilha: marcar para revisão
  const missingKeys = [...existing.entries()]
    .filter(([key, status]) => status === "ACTIVE" && !seen.has(key))
    .map(([key]) => key);
  if (missingKeys.length) {
    await prisma.badgeWin.updateMany({
      where: { sourceKey: { in: missingKeys } },
      data: { status: "MISSING_IN_SHEET" },
    });
    stats.missing = missingKeys.length;
    const details = await prisma.badgeWin.findMany({
      where: { sourceKey: { in: missingKeys } },
      select: { rawDate: true, rawVenue: true, rawPlayer: true, rawType: true },
    });
    await ctx.addIssue(
      "ROW_REMOVED",
      `${tabTitle}: ${missingKeys.length} linha(s) importada(s) não estão mais na planilha`,
      { rows: details },
      true,
    );
  }

  await prisma.sheetTab.update({
    where: { title: tabTitle },
    data: { lastUpdatedNote: note ?? undefined },
  });

  return stats;
}
