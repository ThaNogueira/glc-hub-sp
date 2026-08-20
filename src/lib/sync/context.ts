import type { IssueKind, Prisma, VenueKind } from "@prisma/client";
import { prisma } from "../db";
import { fold, slugify } from "../normalize";

/**
 * Estado compartilhado de uma execução de sync: caches de alias → id
 * (jogadores e lojas) e criação de issues para o painel admin.
 */
export class SyncContext {
  private playerByNorm = new Map<string, string>();
  private venueByNorm = new Map<string, string>();
  stats: Record<string, unknown> = {};
  issueCount = 0;

  constructor(public runId: string) {}

  async init() {
    const [players, playerAliases, venues, venueAliases] = await Promise.all([
      prisma.player.findMany({ select: { id: true, name: true } }),
      prisma.playerAlias.findMany({ select: { normalized: true, playerId: true } }),
      prisma.venue.findMany({ select: { id: true, name: true } }),
      prisma.venueAlias.findMany({ select: { normalized: true, venueId: true } }),
    ]);
    for (const a of playerAliases) this.playerByNorm.set(a.normalized, a.playerId);
    for (const p of players) this.playerByNorm.set(fold(p.name), p.id);
    for (const a of venueAliases) this.venueByNorm.set(a.normalized, a.venueId);
    for (const v of venues) this.venueByNorm.set(fold(v.name), v.id);
  }

  async addIssue(
    kind: IssueKind,
    message: string,
    payload?: Prisma.InputJsonValue,
    dedupe = false,
  ) {
    if (dedupe) {
      const existing = await prisma.reconciliationIssue.findFirst({
        where: { kind, message, status: "OPEN" },
      });
      if (existing) {
        await prisma.reconciliationIssue.update({
          where: { id: existing.id },
          data: { payload: payload ?? undefined, syncRunId: this.runId },
        });
        return;
      }
    }
    await prisma.reconciliationIssue.create({
      data: { kind, message, payload: payload ?? undefined, syncRunId: this.runId },
    });
    this.issueCount++;
  }

  lookupPlayer(raw: string): string | undefined {
    return this.playerByNorm.get(fold(raw));
  }

  lookupVenue(raw: string): string | undefined {
    return this.venueByNorm.get(fold(raw));
  }

  /**
   * Resolve um nome de jogador para id; se desconhecido, cria (com alias
   * próprio) e — a menos que venha da lista canônica — abre issue para o
   * admin confirmar ou mesclar via alias.
   */
  async resolvePlayer(raw: string, opts?: { canonical?: boolean }): Promise<string> {
    const norm = fold(raw);
    const hit = this.playerByNorm.get(norm);
    if (hit) return hit;

    const name = raw.replace(/\s+/g, " ").trim();
    let id: string;
    try {
      const player = await prisma.player.create({
        data: {
          name,
          slug: await uniqueSlug("player", name),
          aliases: { create: { alias: name, normalized: norm } },
        },
      });
      id = player.id;
      if (!opts?.canonical) {
        await this.addIssue(
          "UNKNOWN_PLAYER",
          `Jogador criado automaticamente: "${name}" — confirmar ou mesclar via alias`,
          { raw: name },
        );
      }
    } catch {
      // corrida ou colisão de unicidade: alguém já criou — re-consulta
      const again = await prisma.player.findFirst({
        where: { OR: [{ name }, { aliases: { some: { normalized: norm } } }] },
      });
      if (!again) throw new Error(`Não foi possível criar/resolver jogador "${name}"`);
      id = again.id;
    }
    this.playerByNorm.set(norm, id);
    return id;
  }

  /** Idem para lojas/eventos. */
  async resolveVenue(
    raw: string,
    opts?: { silent?: boolean; kind?: VenueKind },
  ): Promise<string> {
    const norm = fold(raw);
    const hit = this.venueByNorm.get(norm);
    if (hit) return hit;

    const name = raw.replace(/\s+/g, " ").trim();
    let id: string;
    try {
      const venue = await prisma.venue.create({
        data: {
          name,
          slug: await uniqueSlug("venue", name),
          kind: opts?.kind ?? "STORE",
          aliases: { create: { alias: name, normalized: norm } },
        },
      });
      id = venue.id;
      if (!opts?.silent) {
        await this.addIssue(
          "UNKNOWN_VENUE",
          `Loja/evento criado automaticamente: "${name}" — revisar tipo (loja × evento) e aliases`,
          { raw: name },
        );
      }
    } catch {
      const again = await prisma.venue.findFirst({
        where: { OR: [{ name }, { aliases: { some: { normalized: norm } } }] },
      });
      if (!again) throw new Error(`Não foi possível criar/resolver loja "${name}"`);
      id = again.id;
    }
    this.venueByNorm.set(norm, id);
    return id;
  }
}

async function uniqueSlug(kind: "player" | "venue", name: string): Promise<string> {
  const base = slugify(name) || "sem-nome";
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const exists =
      kind === "player"
        ? await prisma.player.findUnique({ where: { slug: candidate }, select: { id: true } })
        : await prisma.venue.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
}
