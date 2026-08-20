import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Lojas e eventos",
  description: "As lojas e eventos do circuito GLC de São Paulo.",
};

export default async function StoresPage() {
  const venues = await prisma.venue.findMany({
    include: {
      _count: { select: { badges: { where: { status: "ACTIVE" } } } },
      slots: true,
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const stores = venues.filter((v) => v.kind === "STORE");
  const events = venues.filter((v) => v.kind === "EVENT");

  return (
    <>
      <h1>Lojas e eventos</h1>
      <p className="lead">O circuito GLC de São Paulo, loja a loja.</p>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Loja</th>
              <th>Bairro</th>
              <th>Status</th>
              <th className="num">Insígnias entregues</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((v) => (
              <tr key={v.id}>
                <td>
                  <Link href={`/lojas/${v.slug}`}>{v.name}</Link>
                </td>
                <td className="muted">{v.neighborhood ?? "—"}</td>
                <td>
                  {v.status === "ACTIVE" ? (
                    <span className="chip ok">ativa</span>
                  ) : (
                    <span className="chip warn">em hiato</span>
                  )}
                </td>
                <td className="num">{v._count.badges}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {events.length > 0 && (
        <>
          <h2>Eventos</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th className="num">Insígnias entregues</th>
                </tr>
              </thead>
              <tbody>
                {events.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/lojas/${v.slug}`}>{v.name}</Link>
                    </td>
                    <td className="num">{v._count.badges}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
