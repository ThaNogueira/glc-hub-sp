/**
 * Dry-run do parse: baixa a planilha real e mostra o que seria importado,
 * sem tocar no banco. Útil para validar mudanças na planilha ou no parser.
 *   npm run sync:dry
 */
import { loadDotEnv } from "../src/lib/env";
loadDotEnv();

import { fold, normalizeType, parseBrDate, splitVenueHeader } from "../src/lib/normalize";
import { discoverTabTitles, extractLastUpdatedNote, fetchTab } from "../src/lib/sheets";
import { parseRankBlocks, parseStoreRankTab } from "../src/lib/sync/reconcile";

/** Nomes de loja/evento vistos no log — candidatos a abas ocultas de rank. */
const seenVenues = new Set<string>();

async function main() {
  const titles = await discoverTabTitles();
  console.log(`Abas descobertas (${titles.length}):`, titles.join(" | "));

  for (const title of titles.filter((t) => fold(t).startsWith("dados vitorias"))) {
    const rows = await fetchTab(title);
    const headerIdx = rows.findIndex((r) => r.some((c) => fold(c).includes("vencedor")));
    let ok = 0;
    let dated = 0;
    let badType = 0;
    let badDate = 0;
    let empty = 0;
    const types = new Map<string, number>();
    const players = new Set<string>();
    const venues = new Set<string>();
    for (let r = headerIdx + 1; r < rows.length; r++) {
      const [rawDate, rawVenue, rawPlayer, rawType] = [0, 1, 2, 3].map((c) =>
        (rows[r][c] ?? "").trim(),
      );
      if (!rawVenue && !rawPlayer && !rawType) {
        empty++;
        continue;
      }
      const type = normalizeType(rawType);
      if (!type) {
        badType++;
        console.log(`  [${title}] linha ${r + 1}: tipo não reconhecido: "${rawType}"`);
        continue;
      }
      if (rawDate && !parseBrDate(rawDate)) {
        badDate++;
        console.log(`  [${title}] linha ${r + 1}: data ilegível: "${rawDate}"`);
      }
      if (rawDate && parseBrDate(rawDate)) dated++;
      ok++;
      types.set(type, (types.get(type) ?? 0) + 1);
      players.add(fold(rawPlayer));
      venues.add(fold(rawVenue));
      seenVenues.add(rawVenue);
    }
    console.log(
      `\n${title} — atualização da planilha: ${extractLastUpdatedNote(rows) ?? "?"}\n` +
        `  ${ok} insígnias (${dated} datadas) · ${players.size} jogadores · ${venues.size} lojas/eventos · ` +
        `${badType} tipos inválidos · ${badDate} datas ilegíveis · ${empty} linhas vazias`,
    );
    console.log(
      "  por tipo:",
      [...types.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}:${n}`).join(" "),
    );
    console.log("  lojas/eventos:", [...venues].sort().join(", "));
  }

  for (const title of titles.filter((t) => fold(t) === "programacao")) {
    const rows = await fetchTab(title);
    const weekdaySet = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
    const firstWeekday = rows.findIndex((r) => weekdaySet.includes(fold(r[0] ?? "")));
    const header = rows[firstWeekday - 1] ?? [];
    const groups: string[][] = [[]];
    for (let c = 1; c < header.length; c++) {
      const cell = (header[c] ?? "").trim();
      if (cell) {
        const { name, neighborhood } = splitVenueHeader(cell);
        groups[groups.length - 1].push(`${name}${neighborhood ? ` [${neighborhood}]` : ""}`);
      } else if (groups[groups.length - 1].length) {
        groups.push([]);
      }
    }
    console.log(`\n${title}:`);
    console.log("  ativas:", groups[0]?.join(", ") || "—");
    console.log("  hiato:", groups[1]?.join(", ") || "—");
    const specialIdx = rows.findIndex(
      (r) => fold(r[0] ?? "") === "data" && fold(r[1] ?? "").includes("loja"),
    );
    const specials = specialIdx < 0 ? [] : rows.slice(specialIdx + 1).filter((r) => parseBrDate((r[0] ?? "").trim()));
    console.log(`  torneios especiais datados: ${specials.length}`);
    for (const s of specials) console.log(`    ${s[0]} | ${s[1]} | ${s[2]} | ${s[3]}`);
  }

  for (const title of titles.filter((t) => fold(t).startsWith("rank"))) {
    const rows = await fetchTab(title);
    const blocks = parseRankBlocks(rows);
    console.log(
      `\n${title}: ${blocks.length} bloco(s):`,
      blocks.map((b) => `${b.title ?? "(geral)"}=${b.entries.length} jogadores`).join(" | "),
    );
  }

  console.log("\nSondando abas ocultas de rank por loja...");
  const visible = new Set(titles.map(fold));
  for (const name of [...seenVenues].sort()) {
    if (visible.has(fold(name))) continue;
    try {
      const rows = await fetchTab(name);
      const store = parseStoreRankTab(rows);
      if (store) {
        console.log(
          `  [oculta] ${name}: ${store.entries.length} jogadores · endereço: ${store.address ?? "—"}`,
        );
      }
    } catch {
      // aba não existe
    }
  }

  for (const title of titles.filter((t) => fold(t) === "decklists")) {
    const rows = await fetchTab(title);
    const links = rows.filter((r) => /^https?:\/\//i.test((r[0] ?? "").trim()));
    console.log(`\n${title}: ${links.length} link(s) externos`);
    for (const l of links) console.log(`  ${l[0]} → ${l[1]}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
