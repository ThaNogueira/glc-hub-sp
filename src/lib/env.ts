import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Carrega .env para scripts fora do Next (sync CLI, worker, seed).
 * Variáveis já definidas no ambiente (ex.: docker-compose) têm precedência.
 */
export function loadDotEnv() {
  const file = resolve(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
