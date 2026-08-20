import Link from "next/link";
import { consumeAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Verificação de e-mail" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  let ok = false;
  if (token) {
    const userId = await consumeAuthToken(token, "EMAIL_VERIFY");
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });
      ok = true;
    }
  }

  return (
    <div className="auth-card" style={{ textAlign: "center" }}>
      {ok ? (
        <>
          <h1>E-mail confirmado ✓</h1>
          <p className="lead">Sua conta está ativa. Bem-vindo à liga!</p>
          <Link href="/conta" className="btn">
            Ir para minha conta
          </Link>
        </>
      ) : (
        <>
          <h1>Link inválido ou expirado</h1>
          <p className="lead">
            Peça um novo e-mail de verificação na página da sua <Link href="/conta">conta</Link>.
          </p>
        </>
      )}
    </div>
  );
}
