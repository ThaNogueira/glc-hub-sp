import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { getRankings, getVenuesForFilter, parseFilters } from "@/lib/queries";
import { TYPES } from "@/lib/types";

export const metadata = {
  title: "Rankings",
  description:
    "Rankings do GLC São Paulo recalculados do log bruto — vitórias e insígnias (tipos distintos), sem duplicatas.",
};

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const sort = sp.ordenar === "insignias" ? "insignias" : "vitorias";
  const [rows, venues] = await Promise.all([getRankings(filters, sort), getVenuesForFilter()]);

  return (
    <>
      <h1>Rankings</h1>
      <p className="lead">
        Recalculados diretamente do log de vitórias da planilha (sem duplicatas).{" "}
        <strong>Vitórias</strong> = total de insígnias conquistadas; <strong>Insígnias</strong> =
        quantidade de tipos distintos.
      </p>

      <FilterBar
        filters={filters}
        venues={venues}
        action="/rankings"
        extra={
          <label>
            Ordenar por
            <select name="ordenar" defaultValue={sort}>
              <option value="vitorias">Vitórias</option>
              <option value="insignias">Insígnias (tipos)</option>
            </select>
          </label>
        }
      />

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Jogador</th>
              <th className="num">Vitórias</th>
              <th className="num">Insígnias</th>
              {TYPES.map((t) => (
                <th key={t.id} className="num" title={t.pt}>
                  <span className="type-dot" style={{ background: t.color }} /> {t.pt.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.player.id}>
                <td className="num muted">{i + 1}</td>
                <td>
                  <Link href={`/jogadores/${r.player.slug}`}>{r.player.name}</Link>
                </td>
                <td className="num">
                  <strong>{r.wins}</strong>
                </td>
                <td className="num">
                  <strong>{r.badges}</strong>/11
                </td>
                {TYPES.map((t) => {
                  const c = r.perType[t.id] ?? 0;
                  return (
                    <td key={t.id} className={`num${c === 0 ? " dim" : ""}`}>
                      {c}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className="muted">Nenhum resultado para esses filtros.</p>}
    </>
  );
}
