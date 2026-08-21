import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { deleteVenueAction, updateVenueDetailsAction } from "../actions";

export const metadata = { title: "Admin — lojas e eventos", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminVenuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const ok = one(sp.ok);
  const erro = one(sp.erro);

  const venues = await prisma.venue.findMany({
    include: {
      _count: { select: { badges: true, tournaments: true } },
      user: { select: { id: true, email: true, displayName: true } },
    },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <h1>Lojas e eventos</h1>
      <p className="lead">
        Edite nome, bairro, endereço, tipo e status de cada loja/evento. Excluir só é possível sem
        resultados — duplicatas com resultados se resolvem com o{" "}
        <Link href="/admin/aliases">merge</Link>. A conta que administra cada loja é trocada em{" "}
        <Link href="/admin/usuarios">Usuários</Link>.
      </p>

      {ok && <p className="form-msg ok">{ok}</p>}
      {erro && <p className="form-msg err">{erro}</p>}

      {venues.map((v) => (
        <div key={v.id} className="panel" style={{ padding: "0.9rem 1.1rem" }}>
          <form action={updateVenueDetailsAction} className="admin-entity-form">
            <input type="hidden" name="id" value={v.id} />
            <label>
              Nome
              <input type="text" name="name" defaultValue={v.name} required maxLength={80} />
            </label>
            <label>
              Bairro
              <input
                type="text"
                name="neighborhood"
                defaultValue={v.neighborhood ?? ""}
                maxLength={60}
              />
            </label>
            <label style={{ flex: "1 1 220px" }}>
              Endereço
              <input type="text" name="address" defaultValue={v.address ?? ""} maxLength={160} />
            </label>
            <label>
              Tipo
              <select name="kind" defaultValue={v.kind}>
                <option value="STORE">Loja</option>
                <option value="EVENT">Evento</option>
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue={v.status}>
                <option value="ACTIVE">Ativa</option>
                <option value="HIATUS">Hiato</option>
              </select>
            </label>
            <button className="small">Salvar</button>
          </form>

          <div className="flex-row small muted" style={{ marginTop: "0.5rem", gap: "1rem" }}>
            <span className="tnum">{v._count.badges} resultados</span>
            <span className="tnum">{v._count.tournaments} torneios</span>
            <span>
              conta da loja:{" "}
              {v.user ? (
                <strong title={v.user.email}>
                  {v.user.displayName} ({v.user.email})
                </strong>
              ) : (
                "nenhuma"
              )}
            </span>
            <span style={{ flex: 1 }} />
            {v._count.badges === 0 ? (
              <form action={deleteVenueAction}>
                <input type="hidden" name="id" value={v.id} />
                <button className="danger small" type="submit">
                  Excluir
                </button>
              </form>
            ) : (
              <span title="Tem resultados — use o merge para juntar a outra loja">
                🔒 excluir via merge
              </span>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
