import { loadDotEnv } from "../src/lib/env";
loadDotEnv();

const MIN = 60_000;
const HOUR = 3_600_000;

async function main() {
  const { runSync } = await import("../src/lib/sync/run");
  const { importCards } = await import("../src/lib/cards/import");
  const { prisma } = await import("../src/lib/db");

  // Intervalo do sync da planilha (5 min a 6 h; padrão 2 h)
  const minutes = Math.min(360, Math.max(5, Number(process.env.SYNC_INTERVAL_MINUTES) || 120));
  // Atualização da base de cartas — novos sets (mín. 24h; padrão semanal)
  const cardsHours = Math.max(24, Number(process.env.CARDS_REFRESH_HOURS) || 168);
  console.log(
    `Worker iniciado — sync planilha: ${minutes} min · refresh de cartas: ${cardsHours} h`,
  );

  let lastCardsRefresh = 0;
  // Se a base de cartas já está populada, não força refresh no boot
  try {
    const count = await prisma.card.count();
    if (count > 0) lastCardsRefresh = Date.now();
    console.log(`Base de cartas: ${count} cartas.`);
  } catch {}

  for (;;) {
    try {
      const started = Date.now();
      const runId = await runSync("worker");
      console.log(
        `[${new Date().toISOString()}] sync ${runId} concluído em ${Math.round((Date.now() - started) / 1000)}s`,
      );
    } catch (e) {
      console.error(`[${new Date().toISOString()}] sync falhou:`, (e as Error).message);
    }

    if (Date.now() - lastCardsRefresh >= cardsHours * HOUR) {
      try {
        const stats = await importCards((m) => console.log(`[cards] ${m}`));
        console.log(
          `[${new Date().toISOString()}] cartas atualizadas: ${stats.created} novas, ${stats.updated} atualizadas (${Math.round(stats.ms / 1000)}s)`,
        );
      } catch (e) {
        console.error(`[${new Date().toISOString()}] refresh de cartas falhou:`, (e as Error).message);
      }
      lastCardsRefresh = Date.now();
    }

    await new Promise((r) => setTimeout(r, minutes * MIN));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
