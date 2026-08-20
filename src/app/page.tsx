import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { Logo } from "@/components/Logo";
import { MetaChart } from "@/components/MetaChart";
import { EmptyState } from "@/components/EmptyState";
import { Reveal } from "@/components/Reveal";
import { getMetaShare, getVenuesForFilter, parseFilters } from "@/lib/queries";
import { getShinyGifUrl } from "@/lib/settings";
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
  const [meta, venues, activeStores, shinyGifUrl] = await Promise.all([
    getMetaShare(filters),
    getVenuesForFilter(),
    prisma.venue.count({ where: { status: "ACTIVE", kind: "STORE" } }),
    getShinyGifUrl().catch(() => null),
  ]);

  return (
    <>
      <section className="hero">
        <div>
          <Logo width={360} />
          <p className="hero-tagline">
            O hub do Gym Leader Challenge de São Paulo: meta do circuito, agenda das lojas,
            rankings, insígnias e decks da comunidade.
          </p>
          <div className="hero-actions">
            <Link href="/decks/novo" className="btn">
              Montar um deck GLC
            </Link>
            <Link href="/agenda" className="btn secondary">
              Ver agenda da semana
            </Link>
          </div>
        </div>
        {shinyGifUrl && (
          <div className="shiny-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shinyGifUrl} alt="Pokémon shiny da semana" loading="lazy" />
            <span className="shiny-label">✨ shiny da semana</span>
          </div>
        )}
      </section>

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

      <h2 style={{ marginTop: "1.5rem" }}>Meta do circuito</h2>
      <p className="lead">
        No GLC o arquétipo é o tipo: cada insígnia registrada conta uma vitória para o tipo usado.
      </p>

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
