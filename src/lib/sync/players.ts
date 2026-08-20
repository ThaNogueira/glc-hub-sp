import { fetchTab } from "../sheets";
import type { SyncContext } from "./context";

/** Aba "Lista Jogadores": nomes canônicos, um por linha (linha 1 é título). */
export async function syncPlayersList(ctx: SyncContext, tabTitle: string): Promise<number> {
  const rows = await fetchTab(tabTitle);
  let count = 0;
  for (const row of rows) {
    const name = (row[0] ?? "").trim();
    if (!name || /lista jogadores/i.test(name)) continue;
    await ctx.resolvePlayer(name, { canonical: true });
    count++;
  }
  return count;
}
