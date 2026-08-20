import { headers } from "next/headers";

/**
 * Rate limiting em memória (janela deslizante) para os endpoints de auth.
 * O site roda em um único processo (container web), então memória basta;
 * reinício do processo zera a janela, o que é aceitável para este uso.
 */

const hits = new Map<string, number[]>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, arr] of hits) {
    const alive = arr.filter((t) => now - t < 3_600_000);
    if (alive.length === 0) hits.delete(key);
    else hits.set(key, alive);
  }
}

/** true = permitido; false = estourou o limite na janela. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}

/** IP do request (atrás do reverse proxy → primeiro X-Forwarded-For). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
