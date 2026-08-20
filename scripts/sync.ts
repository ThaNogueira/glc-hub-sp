import { loadDotEnv } from "../src/lib/env";
loadDotEnv();

async function main() {
  const { runSync } = await import("../src/lib/sync/run");
  const { prisma } = await import("../src/lib/db");
  console.log("Sincronizando com a planilha GLC - Circuito SP...");
  const runId = await runSync("cli");
  const run = await prisma.syncRun.findUnique({ where: { id: runId } });
  console.log(JSON.stringify(run?.stats, null, 2));
  if (run?.error) console.error("Avisos/erros:", run.error);
  console.log(run?.ok ? "Sync concluído com sucesso." : "Sync concluído com erros.");
  await prisma.$disconnect();
  process.exit(run?.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
