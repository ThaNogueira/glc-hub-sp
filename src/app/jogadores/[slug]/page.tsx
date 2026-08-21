import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InsigniaShowcase, type InsigniaInfo } from "@/components/InsigniaShowcase";
import { TypeBadge } from "@/components/TypeBadge";
import { DeckCard } from "@/components/DeckCard";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatBrDate } from "@/lib/normalize";
import { TYPE_BY_ID } from "@/lib/types";

async function getPlayer(slug: string) {
  return prisma.player.findUnique({
    where: { slug },
    include: {
      badges: {
        where: { status: "ACTIVE" },
        include: { venue: true, deckLinks: { include: { deck: true } } },
        orderBy: [{ date: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      },
      externalRefs: true,
      user: {
        select: {
          displayName: true,
          avatarUrl: true,
          favoriteType: true,
          pokemonPlayerId: true,
        },
      },
      decks: {
        where: { isPublic: true },
        include: { coverCard: true, author: { select: { displayName: true } } },
        orderBy: { updatedAt: "desc" },
        take: 6,
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const player = await getPlayer(slug);
  if (!player) return {};
  const types = new Set(player.badges.map((b) => b.type)).size;
  return {
    title: player.name,
    description: `${player.name} no circuito GLC SP: ${player.badges.length} vitórias, ${types}/11 insígnias.`,
    openGraph: {
      title: `${player.name} · GLC Hub SP`,
      description: `${player.badges.length} vitórias · ${types}/11 insígnias de ginásio`,
    },
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [player, viewer] = await Promise.all([getPlayer(slug), getSessionUser()]);
  if (!player) notFound();

  // Player ID oficial: visível para lojas, admin e para o próprio jogador
  const canSeePokemonId =
    !!viewer &&
    (viewer.role === "STORE" || viewer.role === "ADMIN" || viewer.playerId === player.id);

  // agregados por tipo + primeira conquista (para o tooltip das insígnias)
  const perType = new Map<string, { count: number; firstDate: Date | null; firstVenue: string | null }>();
  for (const b of [...player.badges].reverse()) {
    const cur = perType.get(b.type);
    if (!cur) {
      perType.set(b.type, { count: 1, firstDate: b.date, firstVenue: b.venue.name });
    } else {
      cur.count++;
    }
  }
  const distinct = perType.size;

  const signature =
    ([...perType.entries()].sort((a, b) => b[1].count - a[1].count)[0]?.[0] as
      | keyof typeof TYPE_BY_ID
      | undefined) ?? null;
  const accentType = player.user?.favoriteType ?? signature;

  const presencial = player.badges.filter((b) => b.modality === "PRESENCIAL").length;
  const online = player.badges.length - presencial;

  const insignias: InsigniaInfo[] = [...perType.entries()].map(([type, v]) => ({
    type: type as InsigniaInfo["type"],
    count: v.count,
    firstDate: v.firstDate ? formatBrDate(v.firstDate) : null,
    firstVenue: v.firstVenue,
  }));

  return (
    <>
      <div
        className="player-hero"
        style={
          accentType
            ? { ["--hero-color" as string]: `var(${TYPE_BY_ID[accentType].cssVar})` }
            : undefined
        }
      >
        <div className="flex-between">
          <div className="flex-row" style={{ gap: "0.9rem" }}>
            {player.user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.user.avatarUrl} alt="" className="avatar" />
            ) : (
              <span className="avatar placeholder" aria-hidden="true">
                {player.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div>
              <h1>{player.name}</h1>
              <div className="flex-row" style={{ marginTop: "0.35rem" }}>
                {signature && (
                  <span className="small muted">
                    Tipo signature: <TypeBadge type={signature} />
                  </span>
                )}
                {player.user && (
                  <span className="chip ok" title="Perfil verificado — o próprio jogador administra este perfil">
                    ✓ verificado
                  </span>
                )}
              </div>
              {canSeePokemonId && player.user?.pokemonPlayerId && (
                <p className="small muted" style={{ margin: "0.35rem 0 0" }}>
                  Player ID Pokémon: <strong className="tnum">{player.user.pokemonPlayerId}</strong>{" "}
                  <span title="Visível só para lojas e admin">🔒</span>
                </p>
              )}
            </div>
          </div>
          {distinct === 11 && <span className="chip ok">Coleção completa — 11 insígnias!</span>}
        </div>
        <div className="stat-row" style={{ marginBottom: 0 }}>
          <div className="stat">
            <div className="stat-value">{player.badges.length}</div>
            <div className="stat-label">vitórias</div>
          </div>
          <div className="stat">
            <div className="stat-value">{distinct}/11</div>
            <div className="stat-label">insígnias (tipos distintos)</div>
          </div>
          <div className="stat">
            <div className="stat-value">{presencial}</div>
            <div className="stat-label">presencial</div>
          </div>
          <div className="stat">
            <div className="stat-value">{online}</div>
            <div className="stat-label">online</div>
          </div>
        </div>
      </div>

      <h2>Jornada de ginásios</h2>
      <div className="panel">
        <InsigniaShowcase items={insignias} />
      </div>

      {player.decks.length > 0 && (
        <>
          <h2>Decks publicados</h2>
          <div className="deck-gallery">
            {player.decks.map((d) => (
              <DeckCard
                key={d.id}
                deck={{
                  slug: d.slug,
                  title: d.title,
                  type: d.type,
                  isChampion: d.isChampion,
                  coverImage: d.coverCard?.imageSmall ?? null,
                  authorName: player.name,
                  updatedAt: d.updatedAt.toISOString(),
                  views: d.views,
                }}
              />
            ))}
          </div>
        </>
      )}

      {player.externalRefs.length > 0 && (
        <>
          <h2>Decklists externas</h2>
          <ul>
            {player.externalRefs.map((ref) => (
              <li key={ref.id}>
                <a href={ref.url} target="_blank" rel="noopener noreferrer">
                  {ref.kind === "PLAYER_PROFILE" ? "Perfil de decks" : "Deck"} no{" "}
                  {ref.source === "CARDBOARD_WARRIOR" ? "Cardboard Warriors" : "Limitless"}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Histórico de vitórias</h2>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Data</th>
              <th>Loja / evento</th>
              <th>Tipo</th>
              <th>Modalidade</th>
              <th>Deck</th>
            </tr>
          </thead>
          <tbody>
            {player.badges.map((b) => (
              <tr key={b.id}>
                <td className="tnum">
                  {b.date ? formatBrDate(b.date) : <span className="muted">sem data</span>}
                </td>
                <td>
                  <Link href={`/lojas/${b.venue.slug}`}>{b.venue.name}</Link>
                </td>
                <td>
                  <TypeBadge type={b.type} />
                </td>
                <td className="muted">{b.modality === "ONLINE" ? "Online" : "Presencial"}</td>
                <td>
                  {b.deckLinks.length > 0 ? (
                    b.deckLinks.map((l) => (
                      <Link key={l.id} href={`/decks/${l.deck.slug}`}>
                        {l.deck.title}
                      </Link>
                    ))
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
