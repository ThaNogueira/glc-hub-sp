import Link from "next/link";
import { DeckCard } from "@/components/DeckCard";
import { FilterBar } from "@/components/FilterBar";
import { Logo } from "@/components/Logo";
import { MetaChart } from "@/components/MetaChart";
import { EmptyState } from "@/components/EmptyState";
import { Reveal } from "@/components/Reveal";
import { getMetaShare, getVenuesForFilter, parseFilters } from "@/lib/queries";
import { formatBrDate, isoWeekKey } from "@/lib/normalize";
import { getShinyGifUrl } from "@/lib/settings";
import { WEEKDAYS_PT } from "@/lib/types";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Meta do circuito",
  description:
    "Meta share por tipo do Gym Leader Challenge em São Paulo — vitórias por tipo, filtros por loja, temporada e modalidade.",
};

function todayWeekdayInSp(): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[wd] ?? 1;
}

/** Decks em alta: mais upvotes da semana; sem votos na semana, top geral. */
async function getTrendingDecks() {
  const deckInclude = {
    coverCard: true,
    author: { select: { displayName: true } },
    player: { select: { name: true } },
    _count: { select: { votes: true } },
  } as const;

  const weekly = await prisma.deckVote.groupBy({
    by: ["deckId"],
    where: { weekKey: isoWeekKey(), deck: { isPublic: true } },
    _count: { deckId: true },
    orderBy: { _count: { deckId: "desc" } },
    take: 8,
  });

  if (weekly.length > 0) {
    const decks = await prisma.deck.findMany({
      where: { id: { in: weekly.map((w) => w.deckId) } },
      include: deckInclude,
    });
    const order = new Map(weekly.map((w, i) => [w.deckId, i]));
    return decks.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  }

  // semana parada: mostra os mais votados no geral (depois os mais recentes)
  return prisma.deck.findMany({
    where: { isPublic: true },
    include: deckInclude,
    orderBy: [{ votes: { _count: "desc" } }, { updatedAt: "desc" }],
    take: 8,
  });
}

export default async function MetaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const today = todayWeekdayInSp();
  const [meta, venues, activeStores, shinyGifUrl, todaySlots, upcoming, trending] =
    await Promise.all([
      getMetaShare(filters),
      getVenuesForFilter(),
      prisma.venue.count({ where: { status: "ACTIVE", kind: "STORE" } }),
      getShinyGifUrl().catch(() => null),
      prisma.weeklySlot.findMany({
        where: { weekday: today, time: { not: null }, venue: { status: "ACTIVE" } },
        include: { venue: { select: { name: true, slug: true, neighborhood: true } } },
        orderBy: { venue: { name: "asc" } },
      }),
      prisma.tournament.findMany({
        where: {
          hidden: false,
          date: { gte: new Date(new Date().toISOString().slice(0, 10)) },
        },
        include: { venue: { select: { name: true, slug: true } } },
        orderBy: { date: "asc" },
        take: 5,
      }),
      getTrendingDecks().catch(() => []),
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

      {/* hoje + eventos especiais — bate o olho e sabe onde jogar */}
      <div className="home-grid">
        <Reveal>
          <div className="panel home-card">
            <h2 style={{ marginTop: 0 }}>
              🗓️ Hoje tem GLC <span className="muted small">({WEEKDAYS_PT[today - 1]})</span>
            </h2>
            {todaySlots.length > 0 ? (
              <ul className="home-list">
                {todaySlots.map((s) => (
                  <li key={s.id}>
                    <Link href={`/lojas/${s.venue.slug}`}>
                      <strong>{s.venue.name}</strong>
                    </Link>
                    {s.venue.neighborhood && (
                      <span className="muted small"> · {s.venue.neighborhood}</span>
                    )}
                    <span className="home-time tnum">{s.time}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                Hoje a liga descansa — confira a <Link href="/agenda">agenda da semana</Link>.
              </p>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="panel home-card">
            <h2 style={{ marginTop: 0 }}>⭐ Eventos especiais próximos</h2>
            {upcoming.length > 0 ? (
              <ul className="home-list">
                {upcoming.map((t) => (
                  <li key={t.id}>
                    <span className="date-chip tnum">{formatBrDate(t.date)}</span>{" "}
                    <Link href={`/lojas/${t.venue.slug}`}>
                      <strong>{t.venue.name}</strong>
                    </Link>
                    {t.name && <span className="muted"> · {t.name}</span>}
                    {t.time && <span className="home-time tnum">{t.time}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                Nenhum evento especial agendado — as lojas anunciam por aqui e na{" "}
                <Link href="/agenda">agenda</Link>.
              </p>
            )}
          </div>
        </Reveal>
      </div>

      {/* decks com mais upvotes da semana */}
      {trending.length > 0 && (
        <>
          <div className="flex-between" style={{ marginTop: "2rem" }}>
            <h2 style={{ margin: 0 }}>🔥 Decks em alta</h2>
            <Link href="/decks" className="small">
              ver galeria →
            </Link>
          </div>
          <p className="lead small" style={{ marginTop: "0.25rem" }}>
            Os decks mais votados pela comunidade — dê upvote nos seus favoritos.
          </p>
          <div className="carousel" role="list" aria-label="Decks em alta">
            {trending.map((d) => (
              <div role="listitem" key={d.id}>
                <DeckCard
                  deck={{
                    slug: d.slug,
                    title: d.title,
                    type: d.type,
                    isChampion: d.isChampion,
                    coverImage: d.coverCard?.imageSmall ?? null,
                    authorName: d.player?.name ?? d.author?.displayName ?? null,
                    updatedAt: d.updatedAt.toISOString(),
                    views: d.views,
                    votes: d._count.votes,
                  }}
                />
              </div>
            ))}
          </div>
        </>
      )}

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
