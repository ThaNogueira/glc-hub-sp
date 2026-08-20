/**
 * Postgres embutido para desenvolvimento sem Docker:
 *   node scripts/dev-db.mjs start   (porta 55432, dados em .devdb/)
 *   node scripts/dev-db.mjs stop
 * DATABASE_URL correspondente:
 *   postgresql://glchub:glchub@localhost:55432/glchub?schema=public
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const dataDir = process.env.PG_DATA_DIR ?? resolve(process.cwd(), ".devdb");
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "glchub",
  password: "glchub",
  port: 55432,
  persistent: true,
  // UTF8 explícito: no Windows o initdb herdaria WIN1252 do locale e
  // rejeitaria nomes de carta como "Nidoran♂"
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

const cmd = process.argv[2];
if (cmd === "start") {
  if (!existsSync(join(dataDir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  await pg.createDatabase("glchub").catch(() => {});
  console.log("postgres dev em localhost:55432 (db glchub) — Ctrl+C para parar");
  // mantém o processo vivo: o servidor é filho deste processo
  process.stdin.resume();
  const stop = async () => {
    await pg.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} else if (cmd === "stop") {
  await pg.stop();
  console.log("parado");
  process.exit(0);
} else {
  console.log("uso: node scripts/dev-db.mjs start|stop");
  process.exit(1);
}
