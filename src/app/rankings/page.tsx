import { FilterBar } from "@/components/FilterBar";
import { RankTable } from "@/components/RankTable";
import { EmptyState } from "@/components/EmptyState";
import { getRankings, getVenuesForFilter, parseFilters } from "@/lib/queries";

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

      <FilterBar filters={filters} venues={venues} action="/rankings" />

      {rows.length > 0 ? (
        <RankTable
          rows={rows.map((r) => ({
            player: r.player,
            wins: r.wins,
            badges: r.badges,
            signature: r.signature,
            perType: r.perType,
          }))}
          initialSort={sort}
        />
      ) : (
        <EmptyState
          title="Nenhum líder de ginásio por aqui"
          hint="Nenhum resultado para esses filtros — tente ampliar a temporada ou remover o filtro de loja."
        />
      )}
    </>
  );
}
