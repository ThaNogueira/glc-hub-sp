import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "./auth";

/**
 * Autenticação do admin: contas com role ADMIN (Fase 2) ou, como fallback
 * de emergência, o cookie HMAC da senha ADMIN_PASSWORD (Fase 1).
 */

const COOKIE = "glc_admin";
const SESSION_MS = 7 * 86_400_000;

function sign(value: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "dev-secret").update(value).digest("hex");
}

async function hasLegacyCookie(): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  return (
    sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  );
}

export async function isAdmin(): Promise<boolean> {
  if (await hasLegacyCookie()) return true;
  const user = await getSessionUser();
  return user?.role === "ADMIN";
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function loginAdmin(password: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const exp = String(Date.now() + SESSION_MS);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MS / 1000,
  });
  return true;
}

export async function logoutAdmin() {
  (await cookies()).delete(COOKIE);
}
