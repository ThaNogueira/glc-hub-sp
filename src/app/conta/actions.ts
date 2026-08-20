"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PokemonType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createAuthToken,
  consumeAuthToken,
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/mailer";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { fold } from "@/lib/normalize";
import { TYPES } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function back(path: string, params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`${path}${qs ? `?${qs}` : ""}`);
}

// ---------------------------------------------------------------------------
// Cadastro / login / logout
// ---------------------------------------------------------------------------

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!EMAIL_RE.test(email)) back("/cadastro", { erro: "E-mail inválido." });
  if (displayName.length < 2 || displayName.length > 40)
    back("/cadastro", { erro: "Nome de exibição deve ter entre 2 e 40 caracteres." });
  if (password.length < 8) back("/cadastro", { erro: "A senha precisa de pelo menos 8 caracteres." });

  if (!rateLimit(`register:${await clientIp()}`, 5, 3_600_000))
    back("/cadastro", { erro: "Muitas tentativas — aguarde um pouco e tente de novo." });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) back("/cadastro", { erro: "Já existe uma conta com esse e-mail." });

  const user = await prisma.user.create({
    data: { email, displayName, passwordHash: await hashPassword(password) },
  });

  const token = await createAuthToken(user.id, "EMAIL_VERIFY");
  await sendVerificationEmail(email, token);
  await createSession(user.id);
  redirect("/conta?bemvindo=1");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!rateLimit(`login:${await clientIp()}:${email}`, 10, 900_000))
    back("/entrar", { erro: "Muitas tentativas — aguarde 15 minutos." });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    back("/entrar", { erro: "E-mail ou senha incorretos." });

  await createSession(user.id);
  redirect(next.startsWith("/") ? next : "/conta");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Verificação de e-mail / recuperação de senha
// ---------------------------------------------------------------------------

export async function resendVerificationAction() {
  const user = await requireUser();
  if (user.emailVerifiedAt) redirect("/conta");
  if (!rateLimit(`verify:${user.id}`, 3, 3_600_000))
    back("/conta", { erro: "Aguarde antes de reenviar o e-mail." });
  const token = await createAuthToken(user.id, "EMAIL_VERIFY");
  await sendVerificationEmail(user.email, token);
  back("/conta", { ok: "E-mail de verificação reenviado." });
}

export async function requestResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) back("/recuperar-senha", { erro: "E-mail inválido." });
  if (!rateLimit(`reset:${await clientIp()}`, 3, 3_600_000))
    back("/recuperar-senha", { erro: "Muitas tentativas — aguarde um pouco." });

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = await createAuthToken(user.id, "PASSWORD_RESET");
    await sendPasswordResetEmail(email, token);
  }
  // resposta idêntica com ou sem conta (não vaza quem tem cadastro)
  back("/recuperar-senha", { ok: "Se o e-mail existir, enviamos o link de redefinição." });
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8)
    back(`/redefinir-senha`, { token, erro: "A senha precisa de pelo menos 8 caracteres." });

  const userId = await consumeAuthToken(token, "PASSWORD_RESET");
  if (!userId) back("/recuperar-senha", { erro: "Link inválido ou expirado — peça um novo." });

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.authSession.deleteMany({ where: { userId } }), // encerra sessões antigas
  ]);
  await createSession(userId);
  back("/conta", { ok: "Senha redefinida." });
}

// ---------------------------------------------------------------------------
// Configurações da conta
// ---------------------------------------------------------------------------

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();
  const favorite = String(formData.get("favoriteType") ?? "");

  if (displayName.length < 2 || displayName.length > 40)
    back("/conta", { erro: "Nome de exibição deve ter entre 2 e 40 caracteres." });
  if (avatarUrl && !/^https:\/\/.+/i.test(avatarUrl))
    back("/conta", { erro: "URL do avatar deve começar com https://" });

  const favoriteType = TYPES.some((t) => t.id === favorite) ? (favorite as PokemonType) : null;

  await prisma.user.update({
    where: { id: user.id },
    data: { displayName, avatarUrl: avatarUrl || null, favoriteType },
  });
  revalidatePath("/conta");
  back("/conta", { ok: "Perfil atualizado." });
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8)
    back("/conta", { erro: "A nova senha precisa de pelo menos 8 caracteres." });
  if (!(await verifyPassword(current, user.passwordHash)))
    back("/conta", { erro: "Senha atual incorreta." });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });
  back("/conta", { ok: "Senha alterada." });
}

// ---------------------------------------------------------------------------
// Reivindicação de perfil de jogador
// ---------------------------------------------------------------------------

export async function claimProfileAction(formData: FormData) {
  const user = await requireUser();
  if (user.playerId) back("/conta", { erro: "Sua conta já está vinculada a um perfil." });
  const playerId = String(formData.get("playerId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { user: { select: { id: true } } },
  });
  if (!player) back("/conta/reivindicar", { erro: "Jogador não encontrado." });
  if (player.user) back("/conta/reivindicar", { erro: "Esse perfil já foi reivindicado." });

  await prisma.profileClaim.upsert({
    where: { userId_playerId: { userId: user.id, playerId } },
    create: { userId: user.id, playerId, note: note || null },
    update: { status: "PENDING", note: note || null },
  });
  back("/conta", { ok: "Pedido enviado! O admin revisa e aprova o vínculo." });
}

// ---------------------------------------------------------------------------
// Solicitação de conta de loja
// ---------------------------------------------------------------------------

export async function requestStoreAction(formData: FormData) {
  const user = await requireUser();
  if (user.role === "STORE") back("/conta", { erro: "Sua conta já é de loja." });
  const venueName = String(formData.get("venueName") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim().slice(0, 500);
  if (venueName.length < 2) back("/conta", { erro: "Informe o nome da loja." });

  const pending = await prisma.storeRequest.findFirst({
    where: { userId: user.id, status: "PENDING" },
  });
  if (pending) back("/conta", { erro: "Você já tem uma solicitação de loja pendente." });

  const venue = await prisma.venue.findFirst({
    where: {
      OR: [{ name: { equals: venueName, mode: "insensitive" } }, { aliases: { some: { normalized: fold(venueName) } } }],
    },
  });

  await prisma.storeRequest.create({
    data: { userId: user.id, venueId: venue?.id, venueName, message: message || null },
  });
  back("/conta", { ok: "Solicitação enviada! O admin entra em contato para validar a loja." });
}
