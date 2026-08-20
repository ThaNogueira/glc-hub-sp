import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { loginAction } from "../conta/actions";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getSessionUser()) redirect("/conta");
  const sp = await searchParams;
  const erro = typeof sp.erro === "string" ? sp.erro : null;
  const next = typeof sp.next === "string" ? sp.next : "";

  return (
    <div className="auth-card">
      <h1>Entrar na liga</h1>
      <p className="lead">Acesse sua conta para montar decks e reivindicar seu perfil.</p>
      {erro && <p className="form-msg err">{erro}</p>}
      <form action={loginAction} className="form-grid">
        <input type="hidden" name="next" value={next} />
        <label className="field">
          E-mail
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label className="field">
          Senha
          <input type="password" name="password" required autoComplete="current-password" />
        </label>
        <button type="submit">Entrar</button>
      </form>
      <p className="small" style={{ marginTop: "1rem" }}>
        <Link href="/recuperar-senha">Esqueci minha senha</Link>
        {" · "}
        Novo por aqui? <Link href="/cadastro">Criar conta</Link>
      </p>
    </div>
  );
}
