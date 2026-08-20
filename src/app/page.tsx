import { FilterBar } from "@/components/FilterBar";
import { MetaChart } from "@/components/MetaChart";
import { EmptyState } from "@/components/EmptyState";
import { Reveal } from "@/components/Reveal";
import { getMetaShare, getVenuesForFilter, parseFilters } from "@/lib/queries";
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
        <div className="stat" style={{ ["--stat-accent" as string]: "var(--type-water)" }}>
          <div className="stat-value">{meta.distinctPlayers}</div>
          <div className="stat-label">jogadores premiados</div>
        </div>
        <div className="stat" style={{ ["--stat-accent" as string]: "var(--type-lightning)" }}>
          <div className="stat-value">{activeStores}</div>
          <div className="stat-label">lojas ativas</div>
        </div>
      </div>

      <FilterBar filters={filters} venues={venues} action="/" />

      {meta.total > 0 ? (
        <Reveal>
          <div className="panel">
            <MetaChart rows={meta.rows} total={meta.total} />
          </div>
        </Reveal>
      ) : (
        <EmptyState
          title="A liga está vazia hoje"
          hint="Nenhum registro para esses filtros. Os dados chegam pela sincronização com a planilha — se o site acabou de subir, rode o primeiro sync."
        />
      )}
    </>
  );
}
