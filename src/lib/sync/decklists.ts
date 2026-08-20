import type { DeckSource, ExternalRefKind } from "@prisma/client";
import { prisma } from "../db";
import { fetchTab } from "../sheets";
import type { SyncContext } from "./context";

/**
 * Aba "Decklists": colunas `Link das lista | Jogador`. Hoje os links são
 * perfis de jogador no Cardboard Warriors; o modelo aceita também links
 * diretos de deck (Limitless/CW) para quando aparecerem.
 */
export async function syncDecklists(ctx: SyncContext, tabTitle: string): Promise<number> {
  const rows = await fetchTab(tabTitle);
  let count = 0;
  for (let r = 0; r < rows.length; r++) {
    const url = (rows[r][0] ?? "").trim();
    const rawPlayer = (rows[r][1] ?? "").trim();
    if (!/^https?:\/\//i.test(url)) continue;

    let source: DeckSource;
    if (/cardboardwarrior/i.test(url)) source = "CARDBOARD_WARRIOR";
    else if (/limitless/i.test(url)) source = "LIMITLESS";
    else {
      await ctx.addIssue(
        "PARSE_WARNING",
        `${tabTitle}: link de origem não aceita (só Limitless e Cardboard Warrior): ${url}`,
        { url, rawPlayer },
        true,
      );
      continue;
    }
    const kind: ExternalRefKind = /\/player\//i.test(url) ? "PLAYER_PROFILE" : "DECK";
    const playerId = rawPlayer ? await ctx.resolvePlayer(rawPlayer) : null;

    await prisma.externalDeckRef.upsert({
      where: { url },
      create: { url, kind, source, playerId, rawPlayer: rawPlayer || null },
      update: { playerId, rawPlayer: rawPlayer || null },
    });
    count++;
  }
  return count;
}
