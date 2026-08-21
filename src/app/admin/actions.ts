"use server";

import type { IssueStatus, PokemonType, Role, TabKind, VenueKind, VenueStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin, loginAdmin, logoutAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { fold } from "@/lib/normalize";
import { setSetting } from "@/lib/settings";
import { TYPES } from "@/lib/types";
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
  const req = await prisma.storeRequest.findUnique({
    where: { id },
    include: { user: { select: { role: true, email: true } } },
  });
  if (!req || req.status !== "PENDING") return;

  // uma conta não pode ser admin E dona de loja ao mesmo tempo
  if (approve && req.user.role === "ADMIN") {
    redirect(
      `/admin/contas?erro=${encodeURIComponent(
        `${req.user.email} é admin — uma conta não pode ser admin e loja ao mesmo tempo. Rebaixe o papel em Usuários antes, ou rejeite o pedido.`,
      )}`,
    );
  }

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

/** Aprova/rejeita pedido de troca do Player ID oficial. */
export async function reviewPokemonIdAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const approve = String(formData.get("decision")) === "approve";
  const req = await prisma.pokemonIdRequest.findUnique({ where: { id } });
  if (!req || req.status !== "PENDING") return;

  if (approve) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.userId },
        data: { pokemonPlayerId: req.newValue },
      }),
      prisma.pokemonIdRequest.update({
        where: { id },
        data: { status: "APPROVED", reviewedAt: new Date() },
      }),
    ]);
  } else {
    await prisma.pokemonIdRequest.update({
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

// ---------------------------------------------------------------------------
// Gestão de entidades: lojas/eventos, jogadores e usuários (edição no front)
// ---------------------------------------------------------------------------

/** Edita os dados de uma loja/evento (nome, bairro, endereço, tipo, status). */
export async function updateVenueDetailsAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const neighborhood = String(formData.get("neighborhood") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const kind = String(formData.get("kind")) as VenueKind;
  const status = String(formData.get("status")) as VenueStatus;
  const manualLock = String(formData.get("manualLock")) === "on";
  const back = formData.get("back") ? `/admin/lojas/${id}` : "/admin/lojas";
  if (!id || !name || !["STORE", "EVENT"].includes(kind) || !["ACTIVE", "HIATUS"].includes(status))
    redirect(`${back}?erro=Dados inválidos.`);

  const venue = await prisma.venue.findUnique({ where: { id } });
  if (!venue) redirect("/admin/lojas?erro=Loja não encontrada.");

  try {
    await prisma.venue.update({
      where: { id },
      data: {
        name,
        neighborhood: neighborhood || null,
        address: address || null,
        kind,
        status,
        manualLock,
      },
    });
  } catch {
    redirect(`${back}?erro=Já existe uma loja chamada "${name}".`);
  }

  // o nome antigo e o novo viram aliases (o sync continua reconhecendo os dois)
  for (const alias of [venue.name, name]) {
    await prisma.venueAlias.upsert({
      where: { normalized: fold(alias) },
      create: { alias, normalized: fold(alias), venueId: id },
      update: { venueId: id },
    });
  }

  revalidatePath("/admin/lojas");
  revalidatePath("/lojas");
  revalidatePath("/agenda");
  redirect(`${back}?ok=Loja "${name}" atualizada.`);
}

/**
 * Salva a grade semanal de uma loja. Campo alterado em relação à planilha
 * vira `manual` (o sync não sobrescreve); "seguir planilha" remove a trava.
 */
export async function saveVenueScheduleAction(formData: FormData) {
  await guard();
  const venueId = String(formData.get("venueId") ?? "");
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { slots: true },
  });
  if (!venue) redirect("/admin/lojas?erro=Loja não encontrada.");
  const back = `/admin/lojas/${venueId}`;

  for (let weekday = 1; weekday <= 7; weekday++) {
    const time = String(formData.get(`time_${weekday}`) ?? "").replace(/\s+/g, " ").trim();
    const existing = venue.slots.find((s) => s.weekday === weekday);
    const current = existing?.time ?? "";

    if (time === current) continue; // sem mudança — mantém como está (inclusive a trava)

    if (existing) {
      // vazio = "sem torneio nesse dia": mantém o slot com time NULL + manual,
      // senão o sync recriaria o horário da planilha no próximo ciclo
      await prisma.weeklySlot.update({
        where: { id: existing.id },
        data: { time: time || null, manual: true },
      });
    } else if (time) {
      await prisma.weeklySlot.create({ data: { venueId, weekday, time, manual: true } });
    }
  }

  revalidatePath("/agenda");
  revalidatePath(`/lojas/${venue.slug}`);
  redirect(`${back}?ok=Grade semanal salva.`);
}

/** Remove a trava manual de um slot — volta a seguir a planilha. */
export async function resetSlotAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const slot = await prisma.weeklySlot.findUnique({ where: { id }, include: { venue: true } });
  if (!slot) return;
  // apaga o slot: o próximo sync recria (ou não) conforme a planilha
  await prisma.weeklySlot.delete({ where: { id } });
  revalidatePath("/agenda");
  redirect(`/admin/lojas/${slot.venueId}?ok=Slot voltou a seguir a planilha (aplica no próximo sync).`);
}

/** Cria ou edita um torneio (inclusive trocando a loja associada). */
export async function saveTournamentAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const rawDate = String(formData.get("date") ?? "").trim(); // yyyy-mm-dd (input date)
  const time = String(formData.get("time") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const backVenue = String(formData.get("backVenue") ?? venueId);
  const back = `/admin/lojas/${backVenue}`;

  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? new Date(`${rawDate}T12:00:00Z`) : null;
  if (!venueId || !date) redirect(`${back}?erro=Data ou loja inválida.`);

  try {
    if (id) {
      await prisma.tournament.update({
        where: { id },
        data: { venueId, date, time: time || null, name, manual: true },
      });
    } else {
      await prisma.tournament.create({
        data: { venueId, date, time: time || null, name, origin: "SITE", manual: true },
      });
    }
  } catch {
    redirect(`${back}?erro=Já existe um torneio igual (mesma loja, data e nome).`);
  }

  revalidatePath("/agenda");
  revalidatePath("/lojas");
  redirect(`${back}?ok=Torneio salvo.`);
}

/** Exclui um torneio. Vindos da planilha ficam ocultos (para o sync não recriar). */
export async function deleteTournamentAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t) return;
  const back = `/admin/lojas/${String(formData.get("backVenue") ?? t.venueId)}`;

  if (t.origin === "SHEET") {
    await prisma.tournament.update({ where: { id }, data: { hidden: true, manual: true } });
  } else {
    await prisma.tournament.delete({ where: { id } });
  }
  revalidatePath("/agenda");
  redirect(`${back}?ok=Torneio removido da agenda.`);
}

/** Exclui uma loja/evento sem resultados (com resultados, use o merge). */
export async function deleteVenueAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const venue = await prisma.venue.findUnique({
    where: { id },
    include: { _count: { select: { badges: true } }, user: { select: { id: true } } },
  });
  if (!venue) redirect("/admin/lojas?erro=Loja não encontrada.");
  if (venue._count.badges > 0)
    redirect(
      `/admin/lojas?erro="${venue.name}" tem ${venue._count.badges} resultados — use o merge em Aliases para juntá-la a outra loja.`,
    );

  // conta de loja vinculada volta a ser jogador comum
  if (venue.user) {
    await prisma.user.update({
      where: { id: venue.user.id },
      data: { venueId: null, role: "PLAYER" },
    });
  }
  await prisma.venue.delete({ where: { id } });
  revalidatePath("/admin/lojas");
  revalidatePath("/lojas");
  redirect(`/admin/lojas?ok=Loja "${venue.name}" excluída.`);
}

/** Renomeia um jogador (o nome antigo vira alias). */
export async function renamePlayerAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").replace(/\s+/g, " ").trim();
  if (!id || !name) redirect("/admin/aliases?erro=Nome inválido.");

  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) redirect("/admin/aliases?erro=Jogador não encontrado.");
  if (player.name === name) redirect("/admin/aliases");

  try {
    await prisma.player.update({ where: { id }, data: { name } });
  } catch {
    redirect(
      `/admin/aliases?erro=Já existe "${name}" — se for a mesma pessoa, use o merge.`,
    );
  }
  for (const alias of [player.name, name]) {
    await prisma.playerAlias.upsert({
      where: { normalized: fold(alias) },
      create: { alias, normalized: fold(alias), playerId: id },
      update: { playerId: id },
    });
  }
  revalidatePath("/admin/aliases");
  revalidatePath("/jogadores");
  redirect(`/admin/aliases?ok=Renomeado para "${name}".`);
}

/** Exclui um jogador sem resultados (com resultados, use o merge). */
export async function deletePlayerAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const player = await prisma.player.findUnique({
    where: { id },
    include: { _count: { select: { badges: true } }, user: { select: { id: true } } },
  });
  if (!player) redirect("/admin/aliases?erro=Jogador não encontrado.");
  if (player._count.badges > 0)
    redirect(
      `/admin/aliases?erro="${player.name}" tem ${player._count.badges} vitórias — use o merge.`,
    );
  if (player.user) {
    await prisma.user.update({ where: { id: player.user.id }, data: { playerId: null } });
  }
  await prisma.player.delete({ where: { id } });
  revalidatePath("/admin/aliases");
  revalidatePath("/jogadores");
  redirect(`/admin/aliases?ok=Jogador "${player.name}" excluído.`);
}

/** Edita um usuário: papel e vínculos com jogador (por nome) e loja. */
export async function updateUserAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role")) as Role;
  const playerName = String(formData.get("playerName") ?? "").trim();
  const venueId = String(formData.get("venueId") ?? "");
  const favoriteRaw = String(formData.get("favoriteType") ?? "");
  if (!id || !["PLAYER", "STORE", "ADMIN"].includes(role))
    redirect("/admin/usuarios?erro=Dados inválidos.");
  const favoriteType = TYPES.some((t) => t.id === favoriteRaw)
    ? (favoriteRaw as PokemonType)
    : null;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) redirect("/admin/usuarios?erro=Usuário não encontrado.");

  // jogador: vazio desvincula; nome resolve por canônico ou alias
  let playerId: string | null = null;
  if (playerName) {
    const player = await prisma.player.findFirst({
      where: {
        OR: [
          { name: { equals: playerName, mode: "insensitive" } },
          { aliases: { some: { normalized: fold(playerName) } } },
        ],
      },
      include: { user: { select: { id: true } } },
    });
    if (!player)
      redirect(`/admin/usuarios?erro=Jogador "${playerName}" não encontrado — confira o nome.`);
    if (player.user && player.user.id !== id)
      redirect(`/admin/usuarios?erro=O perfil "${player.name}" já pertence a outra conta.`);
    playerId = player.id;
  }

  // uma conta não pode ser admin E dona de loja ao mesmo tempo
  if (role === "ADMIN" && venueId)
    redirect(
      "/admin/usuarios?erro=Uma conta não pode ser admin e dona de loja ao mesmo tempo — escolha um dos dois.",
    );

  // loja: vazio desvincula; ocupada por outra conta é bloqueada
  if (venueId) {
    const taken = await prisma.user.findFirst({
      where: { venueId, id: { not: id } },
      select: { email: true },
    });
    if (taken)
      redirect(`/admin/usuarios?erro=Essa loja já é administrada por ${taken.email}.`);
  }

  await prisma.user.update({
    where: { id },
    data: { role, playerId, venueId: venueId || null, favoriteType },
  });
  revalidatePath("/admin/usuarios");
  revalidatePath("/jogadores");
  redirect(`/admin/usuarios?ok=Usuário ${user.email} atualizado.`);
}

/** Exclui uma conta de usuário (decks publicados ficam, sem autor). */
export async function deleteUserAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  if (String(formData.get("confirm")) !== "on")
    redirect("/admin/usuarios?erro=Marque a caixa de confirmação para excluir.");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) redirect("/admin/usuarios?erro=Usuário não encontrado.");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios?ok=Conta ${user.email} excluída.`);
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
  const shinyGifUrl = String(formData.get("shinyGifUrl") ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(season)) await setSetting("season2026Start", season);
  if (badgeRule) await setSetting("badgeRule", badgeRule);
  if (/^https:\/\/.+\.(gif|png|webp)$/i.test(shinyGifUrl)) {
    await setSetting("shinyGifUrl", shinyGifUrl);
  }
  revalidatePath("/", "layout");
  redirect("/admin");
}
