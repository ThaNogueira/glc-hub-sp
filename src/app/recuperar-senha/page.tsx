import Link from "next/link";
import { requestResetAction } from "../conta/actions";

export const metadata = { title: "Recuperar senha" };

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const erro = typeof sp.erro === "string" ? sp.erro : null;
  const ok = typeof sp.ok === "string" ? sp.ok : null;

  return (
    <div className="auth-card">
      <h1>Recuperar senha</h1>
      <p className="lead">Enviamos um link de redefinição para o seu e-mail cadastrado.</p>
      {erro && <p className="form-msg err">{erro}</p>}
      {ok && <p className="form-msg ok">{ok}</p>}
      <form action={requestResetAction} className="form-grid">
        <label className="field">
          E-mail
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <button type="submit">Enviar link</button>
      </form>
      <p className="small" style={{ marginTop: "1rem" }}>
        <Link href="/entrar">Voltar ao login</Link>
      </p>
    </div>
  );
}
