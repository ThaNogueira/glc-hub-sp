import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { fetchOAuthProfile, isProviderEnabled, type OAuthProvider } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/**
 * Callback OAuth: valida o state, busca o perfil no provedor e loga —
 * criando a conta local se for a primeira vez (match por e-mail).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  // atrás do proxy, req.url é o host interno (0.0.0.0:3000) — os redirects
  // precisam usar a URL pública
  const base = process.env.SITE_URL ?? req.url;
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/entrar?erro=${encodeURIComponent(msg)}`, base));

  if (
    (provider !== "google" && provider !== "discord") ||
    !isProviderEnabled(provider as OAuthProvider)
  ) {
    return fail("Login social indisponível.");
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("glc_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("Sessão de login expirou — tente de novo.");
  }

  try {
    const profile = await fetchOAuthProfile(provider as OAuthProvider, code);

    let user = await prisma.user.findUnique({ where: { email: profile.email } });
    let isNew = false;
    if (!user) {
      isNew = true;
      user = await prisma.user.create({
        data: {
          email: profile.email,
          displayName: profile.name.slice(0, 40),
          // conta social: senha aleatória (dá pra definir uma via "esqueci minha senha")
          passwordHash: await hashPassword(randomBytes(32).toString("hex")),
          emailVerifiedAt: new Date(),
          avatarUrl: profile.avatarUrl,
        },
      });
    } else if (!user.avatarUrl && profile.avatarUrl) {
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: profile.avatarUrl },
      });
    }

    await createSession(user.id);
    const res = NextResponse.redirect(
      new URL(isNew ? "/conta?bemvindo=1" : "/conta", base),
    );
    res.cookies.delete("glc_oauth_state");
    return res;
  } catch (e) {
    console.error(`[oauth ${provider}]`, e);
    return fail("Falha no login social — tente de novo ou use e-mail e senha.");
  }
}
