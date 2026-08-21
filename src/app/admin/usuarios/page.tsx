import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { TYPES } from "@/lib/types";
import { deleteUserAction, updateUserAction } from "../actions";

export const metadata = { title: "Admin — usuários", robots: { index: false } };
export const dynamic = "force-dynamic";

const ROLE_LABEL = { PLAYER: "Jogador", STORE: "Loja", ADMIN: "Admin" } as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const ok = one(sp.ok);
  const erro = one(sp.erro);
  const q = one(sp.q)?.trim() ?? "";

  const [users, venues] = await Promise.all([
    prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { displayName: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: {
        player: { select: { name: true } },
        venue: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.venue.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } }),
  ]);

  return (
    <>
      <h1>Usuários</h1>
      <p className="lead">
        Papel de cada conta e vínculos com perfil de jogador e loja. Caso clássico: alguém pediu
        conta de loja e acabou criando uma loja duplicada — troque a loja aqui e exclua a
        duplicata em <Link href="/admin/lojas">Lojas</Link>. Uma conta não pode ser admin e dona
        de loja ao mesmo tempo.
      </p>

      {ok && <p className="form-msg ok">{ok}</p>}
      {erro && <p className="form-msg err">{erro}</p>}

      <form method="get" action="/admin/usuarios" className="filter-bar">
        <label>
          Buscar
          <input type="text" name="q" defaultValue={q} placeholder="e-mail ou nome" />
        </label>
        <button type="submit" className="secondary">
          Buscar
        </button>
      </form>

      <p className="small muted">
        {users.length} conta{users.length === 1 ? "" : "s"}
        {q ? ` para "${q}"` : " (100 mais recentes)"}. No campo jogador, digite o nome exatamente
        como aparece em <Link href="/jogadores">Jogadores</Link> (aliases também valem); vazio =
        sem vínculo.
      </p>

      {users.map((u) => (
        <div key={u.id} className="panel" style={{ padding: "0.9rem 1.1rem" }}>
          <div className="flex-between" style={{ marginBottom: "0.5rem" }}>
            <strong>
              {u.displayName} <span className="muted small">({u.email})</span>
            </strong>
            <span className="chip">{ROLE_LABEL[u.role]}</span>
          </div>

          <form action={updateUserAction} className="admin-entity-form">
            <input type="hidden" name="id" value={u.id} />
            <label>
              Papel
              <select name="role" defaultValue={u.role}>
                <option value="PLAYER">Jogador</option>
                <option value="STORE">Loja</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <label style={{ flex: "1 1 180px" }}>
              Perfil de jogador (nome)
              <input
                type="text"
                name="playerName"
                defaultValue={u.player?.name ?? ""}
                placeholder="sem vínculo"
              />
            </label>
            <label>
              Loja administrada
              <select name="venueId" defaultValue={u.venueId ?? ""}>
                <option value="">nenhuma</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.kind === "EVENT" ? " (evento)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label title="Tipo exibido no perfil do jogador (cor e badge). Automático = tipo com mais vitórias.">
              Tipo signature
              <select name="favoriteType" defaultValue={u.favoriteType ?? ""}>
                <option value="">automático</option>
                {TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.pt}
                  </option>
                ))}
              </select>
            </label>
            <button className="small">Salvar</button>
          </form>

          <div className="flex-row small muted" style={{ marginTop: "0.5rem", gap: "1rem" }}>
            <span>
              criado em {u.createdAt.toLocaleDateString("pt-BR")}
              {u.venue ? ` · administra ${u.venue.name}` : ""}
              {u.player ? ` · perfil ${u.player.name}` : ""}
            </span>
            <span style={{ flex: 1 }} />
            <form action={deleteUserAction} className="flex-row" style={{ gap: "0.4rem" }}>
              <input type="hidden" name="id" value={u.id} />
              <label className="flex-row small" style={{ gap: "0.25rem", cursor: "pointer" }}>
                <input type="checkbox" name="confirm" /> confirmo
              </label>
              <button className="danger small" type="submit">
                Excluir conta
              </button>
            </form>
          </div>
        </div>
      ))}
    </>
  );
}
