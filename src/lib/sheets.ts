import { parseCsv } from "./csv";

const SHEET_ID = () => process.env.SHEET_ID ?? "1m4bGPteefWIQfjILnZ8iUbHUZj05hxoe_N907GM5c68";

/**
 * Baixa uma aba como matriz de células.
 * `headers=0` é obrigatório: sem ele o gviz auto-detecta cabeçalho multi-linha
 * e concatena colunas inteiras dentro do header (visto na prática).
 */
export async function fetchTab(title: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID()}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(title)}`;
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!res.ok) throw new Error(`Falha ao baixar aba "${title}": HTTP ${res.status}`);
  const text = await res.text();
  // Aba inexistente/sem acesso retorna HTML de erro com status 200
  if (text.trimStart().startsWith("<")) {
    throw new Error(`Aba "${title}" não encontrada ou sem acesso público`);
  }
  return parseCsv(text);
}

/** Descobre os títulos das abas via /htmlview (contém `{name: "..."}` por aba). */
export async function discoverTabTitles(): Promise<string[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID()}/htmlview`;
  const res = await fetch(url, { redirect: "follow", cache: "no-store" });
  if (!res.ok) throw new Error(`Falha na descoberta de abas: HTTP ${res.status}`);
  const html = await res.text();
  const titles = new Set<string>();
  for (const m of html.matchAll(/\{name:\s*"((?:[^"\\]|\\.)*)"/g)) {
    const title = m[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(.)/g, "$1");
    if (title.trim()) titles.add(title.trim());
  }
  return [...titles];
}

/** Procura a célula solta "Última atualização: ..." nas primeiras linhas. */
export function extractLastUpdatedNote(rows: string[][]): string | null {
  for (const row of rows.slice(0, 4)) {
    for (let c = 0; c < row.length; c++) {
      const cell = row[c] ?? "";
      if (/ltima atualiza/i.test(cell)) {
        const inline = cell.replace(/.*ltima atualiza[cç][aã]o:?\s*/i, "").trim();
        if (inline) return inline;
        const next = (row[c + 1] ?? "").trim();
        if (next) return next;
      }
    }
  }
  return null;
}
