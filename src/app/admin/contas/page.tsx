import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import {
  addBanlistAction,
  removeBanlistAction,
  reviewClaimAction,
  reviewStoreRequestAction,
} from "../actions";

export const metadata = { title: "Contas e banlist", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  await requireAdmin();

  const [claims, storeRequests, banlist, userCount] = await Promise.all([
    prisma.profileClaim.findMany({
      where: { status: "PENDING" },
      include: { user: true, player: { include: { _count: { select: { badges: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.storeRequest.findMany({
      where: { status: "PENDING" },
      include: { user: true, venue: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.banlistEntry.findMany({ orderBy: { cardName: "asc" } }),
    prisma.user.count(),
  ]);

  return (
    <>
      <h1>Contas e banlist</h1>
      <p className="lead">
        {userCount} contas registradas · <Link href="/admin">← voltar ao painel</Link>
      </p>

      <h2>Reivindicações de perfil pendentes</h2>
      {claims.length === 0 ? (
        <p className="muted">Nenhuma pendente.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Conta</th>
                <th>Perfil pedido</th>
                <th className="num">Vitórias</th>
                <th>Observação</th>
                <th>Decisão</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.user.displayName} <span className="muted small">({c.user.email})</span>
                  </td>
                  <td>
                    <Link href={`/jogadores/${c.player.slug}`}>{c.player.name}</Link>
                  </td>
                  <td className="num">{c.player._count.badges}</td>
                  <td className="small muted" style={{ whiteSpace: "normal", maxWidth: 240 }}>
                    {c.note ?? "—"}
                  </td>
                  <td>
                    <div className="flex-row" style={{ gap: "0.4rem" }}>
                      <form action={reviewClaimAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <button className="small">Aprovar</button>
                      </form>
                      <form action={reviewClaimAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <button className="danger small">Rejeitar</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Solicitações de conta de loja</h2>
      {storeRequests.length === 0 ? (
        <p className="muted">Nenhuma pendente.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Conta</th>
                <th>Loja</th>
                <th>Mensagem</th>
                <th>Decisão</th>
              </tr>
            </thead>
            <tbody>
              {storeRequests.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.user.displayName} <span className="muted small">({r.user.email})</span>
                  </td>
                  <td>
                    {r.venue ? (
                      <Link href={`/lojas/${r.venue.slug}`}>{r.venue.name}</Link>
                    ) : (
                      <>
                        {r.venueName} <span className="chip warn">nova loja</span>
                      </>
                    )}
                  </td>
                  <td className="small muted" style={{ whiteSpace: "normal", maxWidth: 280 }}>
                    {r.message ?? "—"}
                  </td>
                  <td>
                    <div className="flex-row" style={{ gap: "0.4rem" }}>
                      <form action={reviewStoreRequestAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <button className="small">Aprovar</button>
                      </form>
                      <form action={reviewStoreRequestAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <button className="danger small">Rejeitar</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Banlist GLC</h2>
      <p className="lead small">
        Cartas banidas por nome (além das regras automáticas de Rule Box / ACE SPEC / pool BW+). A
        legalidade no deck builder reflete esta lista imediatamente.
      </p>
      <form action={addBanlistAction} className="filter-bar">
        <label>
          Nome exato da carta
          <input type="text" name="cardName" required placeholder="ex.: Lysandre's Trump Card" />
        </label>
        <label>
          Motivo (opcional)
          <input type="text" name="reason" />
        </label>
        <button type="submit" className="secondary">
          Banir carta
        </button>
      </form>
      {banlist.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Carta</th>
                <th>Motivo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {banlist.map((b) => (
                <tr key={b.id}>
                  <td>{b.cardName}</td>
                  <td className="muted small">{b.reason ?? "—"}</td>
                  <td>
                    <form action={removeBanlistAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="ghost small">remover</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
