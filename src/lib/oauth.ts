import { randomBytes } from "node:crypto";

/**
 * OAuth 2.0 (authorization code) com Google e Discord, sem dependências.
 * O provedor só autentica; a conta local continua sendo por e-mail — se já
 * existe conta com o mesmo e-mail, o login social entra nela.
 *
 * Env: GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET, DISCORD_CLIENT_ID/DISCORD_CLIENT_SECRET.
 * Redirect URIs a cadastrar nos provedores: {SITE_URL}/api/oauth/{provider}/callback
 */

export type OAuthProvider = "google" | "discord";

export type OAuthProfile = {
  email: string;
  name: string;
  avatarUrl: string | null;
};

function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function config(provider: OAuthProvider) {
  const id = process.env[provider === "google" ? "GOOGLE_CLIENT_ID" : "DISCORD_CLIENT_ID"];
  const secret =
    process.env[provider === "google" ? "GOOGLE_CLIENT_SECRET" : "DISCORD_CLIENT_SECRET"];
  if (!id || !secret) return null;
  return { id, secret, redirectUri: `${siteUrl()}/api/oauth/${provider}/callback` };
}

export function isProviderEnabled(provider: OAuthProvider): boolean {
  return config(provider) !== null;
}

export function enabledProviders(): OAuthProvider[] {
  return (["google", "discord"] as const).filter(isProviderEnabled);
}

export function newOAuthState(): string {
  return randomBytes(24).toString("hex");
}

export function buildAuthUrl(provider: OAuthProvider, state: string): string {
  const cfg = config(provider);
  if (!cfg) throw new Error(`OAuth ${provider} não configurado`);
  if (provider === "google") {
    const p = new URLSearchParams({
      client_id: cfg.id,
      redirect_uri: cfg.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  }
  const p = new URLSearchParams({
    client_id: cfg.id,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "identify email",
    state,
  });
  return `https://discord.com/oauth2/authorize?${p}`;
}

/** Troca o code por token e busca o perfil (e-mail, nome, avatar). */
export async function fetchOAuthProfile(
  provider: OAuthProvider,
  code: string,
): Promise<OAuthProfile> {
  const cfg = config(provider);
  if (!cfg) throw new Error(`OAuth ${provider} não configurado`);

  const tokenUrl =
    provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : "https://discord.com/api/oauth2/token";

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.id,
      client_secret: cfg.secret,
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Token ${provider} falhou (${tokenRes.status})`);
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error(`Token ${provider} sem access_token`);

  if (provider === "google") {
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!res.ok) throw new Error(`Userinfo Google falhou (${res.status})`);
    const u = (await res.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!u.email) throw new Error("Google não retornou e-mail");
    return {
      email: u.email.toLowerCase(),
      name: u.name?.trim() || u.email.split("@")[0],
      avatarUrl: u.picture ?? null,
    };
  }

  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!res.ok) throw new Error(`Perfil Discord falhou (${res.status})`);
  const u = (await res.json()) as {
    id: string;
    email?: string | null;
    verified?: boolean;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
  };
  if (!u.email) throw new Error("Discord não retornou e-mail — libere o e-mail na conta");
  return {
    email: u.email.toLowerCase(),
    name: (u.global_name ?? u.username ?? "Treinador").trim().slice(0, 40),
    avatarUrl: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png` : null,
  };
}
