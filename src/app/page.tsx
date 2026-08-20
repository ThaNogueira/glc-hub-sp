import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { TypePill } from "@/components/TypePill";
import { getMetaShare, getVenuesForFilter, parseFilters } from "@/lib/queries";
import { TYPE_BY_ID } from "@/lib/types";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Meta do circuito",
  description:
    "Meta share por tipo do Gym Leader Challenge em São Paulo — vitórias por tipo, filtros por loja, temporada e modalidade.",
};

export default async function MetaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const [meta, venues, activeStores] = await Promise.all([
    getMetaShare(filters),
    getVenuesForFilter(),
    prisma.venue.count({ where: { status: "ACTIVE", kind: "STORE" } }),
  ]);

  const maxCount = Math.max(1, ...meta.rows.map((r) => r.count));

  return (
    <>
      <h1>Meta do circuito</h1>
      <p className="lead">
        No GLC o arquétipo é o tipo: cada insígnia registrada na planilha conta uma vitória para o
        tipo usado.
      </p>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-value">{meta.total}</div>
          <div className="stat-label">insígnias registradas</div>
        </div>
        <div className="stat">
          <div className="stat-value">{meta.distinctPlayers}</div>
          <div className="stat-label">jogadores premiados</div>
        </div>
        <div className="stat">
          <div className="stat-value">{activeStores}</div>
          <div className="stat-label">lojas ativas</div>
        </div>
      </div>

      <FilterBar filters={filters} venues={venues} action="/" />

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Tipo</th>
              <th className="num">Vitórias</th>
              <th className="num">Share</th>
              <th style={{ width: "40%" }}>Distribuição</th>
              <th>Líder do tipo</th>
            </tr>
          </thead>
          <tbody>
            {meta.rows.map((r) => (
              <tr key={r.type}>
                <td>
                  <TypePill type={r.type} />
                </td>
                <td className="num">{r.count}</td>
                <td className="num">{(r.share * 100).toFixed(1)}%</td>
                <td>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(r.count / maxCount) * 100}%`,
                        background: TYPE_BY_ID[r.type].color,
                      }}
                    />
                  </div>
                </td>
                <td>
                  {r.topPlayer ? (
                    <>
                      <Link href={`/jogadores/${r.topPlayer.slug}`}>{r.topPlayer.name}</Link>{" "}
                      <span className="muted small">({r.topPlayer.wins})</span>
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta.total === 0 && (
        <p className="muted">
          Nenhum registro para esses filtros. Os dados chegam via sincronização com a planilha —
          se o site acabou de subir, rode o primeiro sync.
        </p>
      )}
    </>
  );
}
