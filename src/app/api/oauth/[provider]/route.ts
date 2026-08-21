import { NextResponse, type NextRequest } from "next/server";
import { buildAuthUrl, isProviderEnabled, newOAuthState, type OAuthProvider } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** Início do fluxo OAuth: gera state anti-CSRF e manda pro provedor. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if ((provider !== "google" && provider !== "discord") || !isProviderEnabled(provider as OAuthProvider)) {
    return NextResponse.redirect(new URL("/entrar?erro=Login social indisponível.", req.url));
  }

  const state = newOAuthState();
  const res = NextResponse.redirect(buildAuthUrl(provider as OAuthProvider, state));
  res.cookies.set("glc_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
