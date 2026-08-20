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

export async function updateSettingsAction(formData: FormData) {
  await guard();
  const season = String(formData.get("season2026Start") ?? "").trim();
  const badgeRule = String(formData.get("badgeRule") ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(season)) await setSetting("season2026Start", season);
  if (badgeRule) await setSetting("badgeRule", badgeRule);
  revalidatePath("/", "layout");
  redirect("/admin");
}
