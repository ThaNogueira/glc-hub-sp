"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { fold, normalizeType, parseBrDate, slugify } from "@/lib/normalize";

function back(params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`/loja${qs ? `?${qs}` : ""}`);
}

async function requireStore() {
  const user = await requireRole("STORE", "ADMIN");
  if (!user.venueId || !user.venue) redirect("/conta");
  return { user, venueId: user.venueId, venue: user.venue };
}

// ---------------------------------------------------------------------------
// Torneios publicados pela loja
// ---------------------------------------------------------------------------

export async function createTournamentAction(formData: FormData) {
  const { user, venueId } = await requireStore();
  const dateRaw = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "").trim().slice(0, 40);
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const priceInfo = String(formData.get("priceInfo") ?? "").trim().slice(0, 120);
  const prizeInfo = String(formData.get("prizeInfo") ?? "").trim().slice(0, 200);
  const registrationUrl = String(formData.get("registrationUrl") ?? "").trim().slice(0, 300);
  const description = String(formData.get("description") ?? "").trim().slice(0, 1000);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) back({ erro: "Data inválida." });
  const date = new Date(`${dateRaw}T12:00:00Z`);
  if (registrationUrl && !/^https?:\/\//i.test(registrationUrl))
    back({ erro: "Link de inscrição deve começar com http(s)://" });

  // deduplicação com a planilha: mesmo venue+data+nome não duplica
  const existing = await prisma.tournament.findFirst({
    where: { venueId, date, name: name || null },
  });
  if (existing) back({ erro: "Já existe um torneio nessa data com esse nome." });

  await prisma.tournament.create({
    data: {
      venueId,
      date,
      time: time || null,
      name: name || null,
      priceInfo: priceInfo || null,
      prizeInfo: prizeInfo || null,
      registrationUrl: registrationUrl || null,
      description: description || null,
      origin: "SITE",
      createdByUserId: user.id,
    },
  });
  revalidatePath("/agenda");
  back({ ok: "Torneio publicado na agenda." });
}

export async function deleteTournamentAction(formData: FormData) {
  const { venueId } = await requireStore();
  const id = String(formData.get("id") ?? "");
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t || t.venueId !== venueId || t.origin !== "SITE") return;
  await prisma.tournament.delete({ where: { id } });
  revalidatePath("/agenda");
  revalidatePath("/loja");
}

// ---------------------------------------------------------------------------
// Resultados pós-evento (alimentam meta e insígnias)
// ---------------------------------------------------------------------------

export async function postResultAction(formData: FormData) {
  const { user, venueId, venue } = await requireStore();
  const dateRaw = String(formData.get("date") ?? "");
  const playerName = String(formData.get("playerName") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) back({ erro: "Data inválida." });
  const [y, m, d] = dateRaw.split("-");
  const brDate = `${d}/${m}/${y}`;
  const date = parseBrDate(brDate);
  if (!date) back({ erro: "Data inválida." });
  if (playerName.length < 2) back({ erro: "Informe o nome do vencedor." });
  const type = normalizeType(typeRaw);
  if (!type) back({ erro: "Tipo inválido." });

  // resolve o jogador (mesma lógica do sync: alias → jogador; cria se novo)
  const norm = fold(playerName);
  let player = await prisma.player.findFirst({
    where: { OR: [{ name: { equals: playerName, mode: "insensitive" } }, { aliases: { some: { normalized: norm } } }] },
  });
  if (!player) {
    const base = slugify(playerName) || "jogador";
    let slug = base;
    for (let i = 2; await prisma.player.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
    player = await prisma.player.create({
      data: {
        name: playerName,
        slug,
        aliases: { create: { alias: playerName, normalized: norm } },
      },
    });
    await prisma.reconciliationIssue.create({
      data: {
        kind: "UNKNOWN_PLAYER",
        message: `Jogador criado pela loja ${venue.name}: "${playerName}" — confirmar ou mesclar via alias`,
        payload: { raw: playerName, via: "store-panel" },
      },
    });
  }

  // suspeita de duplicata: a planilha pode registrar o mesmo resultado depois
  const duplicate = await prisma.badgeWin.findFirst({
    where: { venueId, playerId: player.id, type, date, status: "ACTIVE" },
  });

  const badge = await prisma.badgeWin.create({
    data: {
      sourceKey: `site-${randomBytes(10).toString("hex")}`,
      tabName: "Site",
      rowIndex: 0,
      date,
      rawDate: brDate,
      rawVenue: venue.name,
      rawPlayer: playerName,
      rawType: typeRaw,
      modality: "PRESENCIAL",
      type,
      playerId: player.id,
      venueId,
      origin: "SITE",
      status: duplicate ? "PENDING_REVIEW" : "ACTIVE",
    },
  });

  if (duplicate) {
    await prisma.reconciliationIssue.create({
      data: {
        kind: "DUPLICATE_SUSPECT",
        message: `Resultado da loja ${venue.name} (${playerName}, ${brDate}) já existe — possivelmente duplicado com a planilha`,
        payload: { badgeWinId: badge.id, duplicateOfId: duplicate.id },
      },
    });
    back({
      ok: "Resultado registrado, mas parece duplicado com um registro existente — o admin vai revisar.",
    });
  }

  revalidatePath("/");
  revalidatePath(`/jogadores/${player.slug}`);
  back({ ok: `Insígnia registrada para ${player.name}. Já conta no meta e no perfil.` });
}

export async function deleteResultAction(formData: FormData) {
  const { user, venueId } = await requireStore();
  const id = String(formData.get("id") ?? "");
  const b = await prisma.badgeWin.findUnique({ where: { id } });
  if (!b || b.venueId !== venueId || b.origin !== "SITE") return;
  await prisma.badgeWin.delete({ where: { id } });
  revalidatePath("/loja");
  revalidatePath("/");
}
