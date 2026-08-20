import { loginAction } from "../actions";

export const metadata = { title: "Admin — entrar", robots: { index: false } };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <div className="panel" style={{ maxWidth: 380, margin: "3rem auto" }}>
      <h1 className="mt0">Painel admin</h1>
      {sp.erro && <p style={{ color: "var(--warn)" }}>Senha incorreta.</p>}
      <form action={loginAction} style={{ display: "grid", gap: "0.6rem" }}>
        <input type="password" name="password" placeholder="Senha do admin" required autoFocus />
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}
