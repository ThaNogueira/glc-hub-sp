import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Role, TokenKind } from "@prisma/client";
import { prisma } from "./db";

/**
 * Contas da Fase 2: sessões opacas (token aleatório no cookie httpOnly,
 * hash SHA-256 no banco) + tokens de verificação de e-mail / reset de senha.
 */

const SESSION_COOKIE = "glc_session";
const SESSION_DAYS = 30;
const TOKEN_TTL_MS: Record<TokenKind, number> = {
  EMAIL_VERIFY: 24 * 3_600_000,
  PASSWORD_RESET: 60 * 60_000,
};

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// ---------------------------------------------------------------------------
// Senhas
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---------------------------------------------------------------------------
// Sessões
// ---------------------------------------------------------------------------

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.authSession.create({
    data: { userId, tokenHash: sha256(token), expiresAt },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.authSession.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Usuário logado (com perfil de jogador e loja vinculados), por request. */
export const getSessionUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { player: true, venue: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

// ---------------------------------------------------------------------------
// Tokens de e-mail (verificação / recuperação de senha)
// ---------------------------------------------------------------------------

export async function createAuthToken(userId: string, kind: TokenKind): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.authToken.create({
    data: {
      userId,
      kind,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS[kind]),
    },
  });
  return token;
}

/** Valida e consome (uso único) um token; retorna o userId ou null. */
export async function consumeAuthToken(raw: string, kind: TokenKind): Promise<string | null> {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!row || row.kind !== kind || row.usedAt || row.expiresAt < new Date()) return null;
  await prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}
