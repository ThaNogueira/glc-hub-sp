import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { registerAction } from "../conta/actions";

export const metadata = { title: "Criar conta" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getSessionUser()) redirect("/conta");
  const sp = await searchParams;
  const erro = typeof sp.erro === "string" ? sp.erro : null;

  return (
    <div className="auth-card">
      <h1>Criar conta</h1>
      <p className="lead">
        Com uma conta você monta decks GLC, publica na galeria e reivindica seu histórico de
        insígnias.
      </p>
      {erro && <p className="form-msg err">{erro}</p>}
      <form action={registerAction} className="form-grid">
        <label className="field">
          Nome de exibição
          <input type="text" name="displayName" required minLength={2} maxLength={40} />
        </label>
        <label className="field">
          E-mail
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label className="field">
          Senha (mín. 8 caracteres)
          <input type="password" name="password" required minLength={8} autoComplete="new-password" />
        </label>
        <button type="submit">Criar conta</button>
      </form>
      <p className="small" style={{ marginTop: "1rem" }}>
        Já tem conta? <Link href="/entrar">Entrar</Link>
      </p>
    </div>
  );
}
