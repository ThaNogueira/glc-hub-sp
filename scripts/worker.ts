import { loadDotEnv } from "../src/lib/env";
loadDotEnv();

const MIN = 60_000;

async function main() {
  const { runSync } = await import("../src/lib/sync/run");
  // Intervalo configurável (5 min a 6 h; padrão 2 h)
  const minutes = Math.min(360, Math.max(5, Number(process.env.SYNC_INTERVAL_MINUTES) || 120));
  console.log(`Worker de sync iniciado — intervalo: ${minutes} min`);

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
    await new Promise((r) => setTimeout(r, minutes * MIN));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
