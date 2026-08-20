"use server";

import type { IssueStatus, TabKind, VenueKind, VenueStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin, loginAdmin, logoutAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { fold } from "@/lib/normalize";
import { setSetting } from "@/lib/settings";
import { runSync } from "@/lib/sync/run";

async function guard() {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function loginAction(formData: FormData) {
  const ok = await loginAdmin(String(formData.get("password") ?? ""));
  redirect(ok ? "/admin" : "/admin/login?erro=1");
}

export async function logoutAction() {
  await logoutAdmin();
  redirect("/admin/login");
}

export async function syncNowAction() {
  await guard();
  await runSync("manual");
  revalidatePath("/", "layout");
  redirect("/admin");
}

export async function setIssueStatusAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as IssueStatus;
  if (!["RESOLVED", "IGNORED", "OPEN"].includes(status)) return;
  await prisma.reconciliationIssue.update({
    where: { id },
    data: { status, resolvedAt: status === "OPEN" ? null : new Date() },
  });
  revalidatePath("/admin/issues");
}

export async function addPlayerAliasAction(formData: FormData) {
  await guard();
  const alias = String(formData.get("alias") ?? "").trim();
  const playerId = String(formData.get("playerId") ?? "");
  if (!alias || !playerId) return;
  await prisma.playerAlias.upsert({
    where: { normalized: fold(alias) },
    create: { alias, normalized: fold(alias), playerId },
    update: { playerId },
  });
  revalidatePath("/admin/aliases");
}

/** Mescla jogador duplicado: move insígnias, aliases e vínculos, apaga o duplicado. */
export async function mergePlayersAction(formData: FormData) {
  await guard();
  const fromId = String(formData.get("fromId") ?? "");
  const toId = String(formData.get("toId") ?? "");
  if (!fromId || !toId || fromId === toId) return;
  const from = await prisma.player.findUnique({ where: { id: fromId } });
  if (!from) return;
  await prisma.$transaction([
    prisma.badgeWin.updateMany({ where: { playerId: fromId }, data: { playerId: toId } }),
    prisma.playerAlias.updateMany({ where: { playerId: fromId }, data: { playerId: toId } }),
    prisma.externalDeckRef.updateMany({ where: { playerId: fromId }, data: { playerId: toId } }),
    prisma.deck.updateMany({ where: { playerId: fromId }, data: { playerId: toId } }),
    prisma.profileClaim.deleteMany({ where: { playerId: fromId } }),
    prisma.player.delete({ where: { id: fromId } }),
  ]);
  // o nome antigo vira alias do jogador canônico
  await prisma.playerAlias.upsert({
    where: { normalized: fold(from.name) },
    create: { alias: from.name, normalized: fold(from.name), playerId: toId },
    update: { playerId: toId },
  });
  revalidatePath("/admin/aliases");
}

export async function mergeVenuesAction(formData: FormData) {
  await guard();
  const fromId = String(formData.get("fromId") ?? "");
  const toId = String(formData.get("toId") ?? "");
  if (!fromId || !toId || fromId === toId) return;
  const from = await prisma.venue.findUnique({ where: { id: fromId } });
  if (!from) return;
  await prisma.$transaction([
    prisma.badgeWin.updateMany({ where: { venueId: fromId }, data: { venueId: toId } }),
    prisma.venueAlias.updateMany({ where: { venueId: fromId }, data: { venueId: toId } }),
    prisma.tournament.updateMany({ where: { venueId: fromId }, data: { venueId: toId } }),
    prisma.weeklySlot.deleteMany({ where: { venueId: fromId } }),
    prisma.venue.delete({ where: { id: fromId } }),
  ]);
  await prisma.venueAlias.upsert({
    where: { normalized: fold(from.name) },
    create: { alias: from.name, normalized: fold(from.name), venueId: toId },
    update: { venueId: toId },
  });
  revalidatePath("/admin/aliases");
}

export async function updateVenueAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind")) as VenueKind;
  const status = String(formData.get("status")) as VenueStatus;
  if (!id || !["STORE", "EVENT"].includes(kind) || !["ACTIVE", "HIATUS"].includes(status)) return;
  await prisma.venue.update({ where: { id }, data: { kind, status } });
  revalidatePath("/admin/aliases");
}

export async function updateTabKindAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind")) as TabKind;
  const valid: TabKind[] = [
    "LOG_PRESENCIAL",
    "LOG_ONLINE",
    "RANK",
    "SCHEDULE",
    "RULES",
    "PLAYERS",
    "DECKLISTS",
    "IGNORE",
    "UNCLASSIFIED",
  ];
  if (!id || !valid.includes(kind)) return;
  await prisma.sheetTab.update({ where: { id }, data: { kind } });
  revalidatePath("/admin/tabs");
}

// ---------------------------------------------------------------------------
// Fase 2: contas (reivindicações de perfil e solicitações de loja) e banlist
// ---------------------------------------------------------------------------

export async function reviewClaimAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const approve = String(formData.get("decision")) === "approve";
  const claim = await prisma.profileClaim.findUnique({
    where: { id },
    include: { player: { include: { user: { select: { id: true } } } } },
  });
  if (!claim || claim.status !== "PENDING") return;

  if (approve) {
    if (claim.player.user) return; // outro usuário levou o perfil antes
    await prisma.$transaction([
      prisma.user.update({ where: { id: claim.userId }, data: { playerId: claim.playerId } }),
      prisma.profileClaim.update({
        where: { id },
        data: { status: "APPROVED", reviewedAt: new Date() },
      }),
      // rejeita pedidos concorrentes pelo mesmo perfil
      prisma.profileClaim.updateMany({
        where: { playerId: claim.playerId, status: "PENDING", id: { not: id } },
        data: { status: "REJECTED", reviewedAt: new Date() },
      }),
    ]);
  } else {
    await prisma.profileClaim.update({
      where: { id },
      data: { status: "REJECTED", reviewedAt: new Date() },
    });
  }
  revalidatePath("/admin/contas");
}

export async function reviewStoreRequestAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const approve = String(formData.get("decision")) === "approve";
  const req = await prisma.storeRequest.findUnique({ where: { id } });
  if (!req || req.status !== "PENDING") return;

  if (approve) {
    const { fold: foldName, slugify } = await import("@/lib/normalize");
    let venueId = req.venueId;
    if (!venueId) {
      // a loja ainda não existe no circuito — cria como STORE ativa
      const venue = await prisma.venue.create({
        data: {
          name: req.venueName,
          slug: slugify(req.venueName) || `loja-${Date.now()}`,
          aliases: { create: { alias: req.venueName, normalized: foldName(req.venueName) } },
        },
      });
      venueId = venue.id;
    }
    const taken = await prisma.user.findFirst({ where: { venueId } });
    if (taken) return; // outra conta já administra essa loja
    await prisma.$transaction([
      prisma.user.update({ where: { id: req.userId }, data: { role: "STORE", venueId } }),
      prisma.storeRequest.update({
        where: { id },
        data: { status: "APPROVED", venueId, reviewedAt: new Date() },
      }),
    ]);
  } else {
    await prisma.storeRequest.update({
      where: { id },
      data: { status: "REJECTED", reviewedAt: new Date() },
    });
  }
  revalidatePath("/admin/contas");
}

export async function addBanlistAction(formData: FormData) {
  await guard();
  const cardName = String(formData.get("cardName") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!cardName) return;
  await prisma.banlistEntry.upsert({
    where: { cardName },
    create: { cardName, reason: reason || null },
    update: { reason: reason || null },
  });
  const { invalidateBanlistCache } = await import("@/lib/cards/search");
  invalidateBanlistCache();
  revalidatePath("/admin/contas");
}

export async function removeBanlistAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.banlistEntry.delete({ where: { id } }).catch(() => {});
  const { invalidateBanlistCache } = await import("@/lib/cards/search");
  invalidateBanlistCache();
  revalidatePath("/admin/contas");
}

export async function importCardsAction() {
  await guard();
  const { importCards } = await import("@/lib/cards/import");
  await importCards((m) => console.log(`[admin cards] ${m}`));
  revalidatePath("/admin");
  redirect("/admin?cartas=ok");
}

export async function updateSettingsAction(formData: FormData) {
  await guard();
  const season = String(formData.get("season2026Start") ?? "").trim();
  const badgeRule = String(formData.get("badgeRule") ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(season)) await setSetting("season2026Start", season);
  if (badgeRule) await setSetting("badgeRule", badgeRule);
  revalidatePath("/", "layout");
  redirect("/admin");
}
