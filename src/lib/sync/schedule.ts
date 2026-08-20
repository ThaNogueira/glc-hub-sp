import { prisma } from "../db";
import { fold, parseBrDate, splitVenueHeader } from "../normalize";
import { fetchTab } from "../sheets";
import type { SyncContext } from "./context";

const WEEKDAY_LOOKUP: Record<string, number> = {
  segunda: 1,
  "segunda-feira": 1,
  terca: 2,
  "terca-feira": 2,
  quarta: 3,
  "quarta-feira": 3,
  quinta: 4,
  "quinta-feira": 4,
  sexta: 5,
  "sexta-feira": 5,
  sabado: 6,
  domingo: 7,
};

export type ScheduleStats = {
  activeStores: number;
  hiatusStores: number;
  slots: number;
  specials: number;
};

/**
 * Aba "Programação": grade semanal (linhas = dias, colunas = lojas com
 * "Nome (Bairro)" no cabeçalho), grupos "Lojas Ativas" / "Lojas em hiato"
 * separados por coluna vazia, e seção "Torneios especiais" com
 * DATA | LOJA | HORÁRIO | Nome torneio.
 */
export async function syncSchedule(ctx: SyncContext, tabTitle: string): Promise<ScheduleStats> {
  const rows = await fetchTab(tabTitle);
  const stats: ScheduleStats = { activeStores: 0, hiatusStores: 0, slots: 0, specials: 0 };

  // Linhas de dia da semana localizam a grade; o cabeçalho de lojas é a linha anterior
  const weekdayIdxs = rows
    .map((row, i) => ({ i, wd: WEEKDAY_LOOKUP[fold(row[0] ?? "")] }))
    .filter((x) => x.wd !== undefined);
  if (!weekdayIdxs.length) throw new Error(`Aba "${tabTitle}": linhas de dias da semana não encontradas`);
  const headerRow = rows[weekdayIdxs[0].i - 1] ?? [];

  // Segmentos de colunas não-vazias: 1º = lojas ativas, 2º = lojas em hiato
  type StoreCol = { col: number; name: string; neighborhood: string | null; active: boolean };
  const storeCols: StoreCol[] = [];
  let segment = 0;
  let inSegment = false;
  for (let c = 1; c < headerRow.length; c++) {
    const cell = (headerRow[c] ?? "").trim();
    if (cell) {
      if (!inSegment) {
        segment++;
        inSegment = true;
      }
      const { name, neighborhood } = splitVenueHeader(cell);
      storeCols.push({ col: c, name, neighborhood, active: segment === 1 });
    } else {
      inSegment = false;
    }
  }

  const venueIdByCol = new Map<number, string>();
  for (const sc of storeCols) {
    const venueId = await ctx.resolveVenue(sc.name, { silent: true });
    await prisma.venue.update({
      where: { id: venueId },
      data: {
        neighborhood: sc.neighborhood ?? undefined,
        status: sc.active ? "ACTIVE" : "HIATUS",
        kind: "STORE",
      },
    });
    venueIdByCol.set(sc.col, venueId);
    if (sc.active) stats.activeStores++;
    else stats.hiatusStores++;
  }

  // Grade semanal: substitui os slots existentes pelos da planilha
  const seenSlots: { venueId: string; weekday: number; time: string }[] = [];
  for (const { i, wd } of weekdayIdxs) {
    for (const [col, venueId] of venueIdByCol) {
      const time = (rows[i][col] ?? "").replace(/\s+/g, " ").trim();
      if (time) seenSlots.push({ venueId, weekday: wd!, time });
    }
  }
  for (const slot of seenSlots) {
    await prisma.weeklySlot.upsert({
      where: { venueId_weekday: { venueId: slot.venueId, weekday: slot.weekday } },
      create: slot,
      update: { time: slot.time },
    });
  }
  if (seenSlots.length) {
    // remove slots que saíram da grade (sem tocar em nada se o parse vier vazio)
    await prisma.weeklySlot.deleteMany({
      where: {
        NOT: { OR: seenSlots.map((s) => ({ venueId: s.venueId, weekday: s.weekday })) },
      },
    });
  }
  stats.slots = seenSlots.length;

  // Torneios especiais: cabeçalho DATA | LOJA | HORÁRIO | Nome torneio
  const specialHeaderIdx = rows.findIndex(
    (row) => fold(row[0] ?? "") === "data" && fold(row[1] ?? "").includes("loja"),
  );
  if (specialHeaderIdx >= 0) {
    for (let r = specialHeaderIdx + 1; r < rows.length; r++) {
      const [rawDate, rawVenue, rawTime, rawName] = [0, 1, 2, 3].map((c) =>
        (rows[r][c] ?? "").trim(),
      );
      if (!rawDate && !rawVenue) continue;
      const date = parseBrDate(rawDate);
      if (!date || !rawVenue) {
        await ctx.addIssue(
          "PARSE_WARNING",
          `${tabTitle}: torneio especial ilegível na linha ${r + 1}`,
          { row: rows[r].slice(0, 4) },
          true,
        );
        continue;
      }
      const venueId = await ctx.resolveVenue(rawVenue);
      await prisma.tournament.upsert({
        where: { venueId_date_name: { venueId, date, name: rawName || "" } },
        create: {
          venueId,
          date,
          name: rawName || null,
          time: rawTime || null,
          origin: "SHEET",
        },
        update: { time: rawTime || null },
      });
      stats.specials++;
    }
  }

  return stats;
}
