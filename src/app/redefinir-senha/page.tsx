import Link from "next/link";
import { resetPasswordAction } from "../conta/actions";

export const metadata = { title: "Redefinir senha" };

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const erro = typeof sp.erro === "string" ? sp.erro : null;

  if (!token) {
    return (
      <div className="auth-card">
        <h1>Link inválido</h1>
        <p className="lead">
          Este link de redefinição está incompleto.{" "}
          <Link href="/recuperar-senha">Peça um novo</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Nova senha</h1>
      {erro && <p className="form-msg err">{erro}</p>}
      <form action={resetPasswordAction} className="form-grid">
        <input type="hidden" name="token" value={token} />
        <label className="field">
          Nova senha (mín. 8 caracteres)
          <input type="password" name="password" required minLength={8} autoComplete="new-password" />
        </label>
        <button type="submit">Redefinir</button>
      </form>
    </div>
  );
}
