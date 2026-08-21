import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { DeckCardsView, type CardView } from "@/components/DeckCardsView";
import { TypeBadge } from "@/components/TypeBadge";
import { VoteButton } from "@/components/VoteButton";
import { getSessionUser } from "@/lib/auth";
import { getBanlist } from "@/lib/cards/search";
import { cardToGlc } from "@/lib/decks/parse";
import { prisma } from "@/lib/db";
import { exportDeckText, type DeckEntry } from "@/lib/glc";
import { renderMarkdown } from "@/lib/markdown";
import { formatBrDate } from "@/lib/normalize";
import { TYPE_BY_ID } from "@/lib/types";
import { deleteDeckAction, linkResultAction, unlinkResultAction } from "../actions";

async function getDeck(slug: string) {
  return prisma.deck.findUnique({
    where: { slug },
    include: {
      coverCard: true,
      author: { select: { id: true, displayName: true } },
      player: { select: { name: true, slug: true } },
      versions: {
        orderBy: { version: "desc" },
        include: { cards: { include: { card: true }, orderBy: { position: "asc" } } },
      },
      resultLinks: { include: { badgeWin: { include: { venue: true } } } },
      _count: { select: { votes: true } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const deck = await getDeck(slug);
  if (!deck || !deck.isPublic) return {};
  const t = TYPE_BY_ID[deck.type];
  return {
    title: deck.title,
    description: `Deck GLC de ${t.pt}${deck.player ? ` por ${deck.player.name}` : deck.author ? ` por ${deck.author.displayName}` : ""} — lista completa, guia e estatísticas.`,
    openGraph: {
      title: `${deck.title} · GLC Hub SP`,
      description: `Deck GLC de ${t.pt} — 60 cartas, singleton, mono-tipo.`,
    },
  };
}

const CATEGORY_LABEL = { POKEMON: "Pokémon", TRAINER: "Treinadores", ENERGY: "Energias" } as const;

export default async function DeckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [deck, user] = await Promise.all([getDeck(slug), getSessionUser()]);
  if (!deck) notFound();

  const isOwner = !!user && (deck.author?.id === user.id || user.role === "ADMIN");
  if (!deck.isPublic && !isOwner) notFound();

  const myVote = user
    ? await prisma.deckVote.findUnique({
        where: { userId_deckId: { userId: user.id, deckId: deck.id } },
        select: { id: true },
      })
    : null;

  // contador de views (não conta o próprio autor)
  if (deck.isPublic && !isOwner) {
    prisma.deck
      .update({ where: { id: deck.id }, data: { views: { increment: 1 } } })
      .catch(() => {});
  }

  const version = deck.versions[0];
  if (!version) notFound();

  const banlist = await getBanlist();
  const entries: DeckEntry[] = version.cards
    .filter((dc) => dc.card)
    .map((dc) => ({ card: cardToGlc(dc.card!, banlist), quantity: dc.quantity }));
  const exportText = exportDeckText(entries);
  const total = entries.reduce((a, e) => a + e.quantity, 0);
  const t = TYPE_BY_ID[deck.type];

  // vitórias disponíveis para vincular (autor com perfil reivindicado)
  const linkedBadgeIds = new Set(deck.resultLinks.map((l) => l.badgeWin.id));
  const linkableWins =
    isOwner && user?.playerId
      ? await prisma.badgeWin.findMany({
          where: {
            playerId: user.playerId,
            type: deck.type,
            status: "ACTIVE",
            id: { notIn: [...linkedBadgeIds] },
          },
          include: { venue: true },
          orderBy: [{ date: { sort: "desc", nulls: "last" } }],
          take: 20,
        })
      : [];

  // arte de fundo do header: recorte CSS da faixa de ilustração da carta-capa
  const heroArt =
    deck.coverCard?.imageLarge ??
    deck.coverCard?.imageSmall ??
    version.cards[0]?.card?.imageLarge ??
    version.cards[0]?.card?.imageSmall ??
    null;

  // vitórias agrupadas por loja: "3 insígnias na TamerShop" + datas em chips
  const winsByVenue = new Map<string, { venue: string; dates: (Date | null)[] }>();
  for (const l of deck.resultLinks) {
    const g = winsByVenue.get(l.badgeWin.venue.name) ?? {
      venue: l.badgeWin.venue.name,
      dates: [],
    };
    g.dates.push(l.badgeWin.date);
    winsByVenue.set(l.badgeWin.venue.name, g);
  }
  const winGroups = [...winsByVenue.values()].sort((a, b) => b.dates.length - a.dates.length);

  return (
    <>
      <div
        className="player-hero deck-hero"
        style={{ ["--hero-color" as string]: `var(${t.cssVar})` }}
      >
        {heroArt && (
          <div
            className="deck-hero-art"
            style={{ backgroundImage: `url(${heroArt})` }}
            aria-hidden="true"
          />
        )}
        <div className="flex-between deck-hero-content" style={{ alignItems: "flex-start" }}>
          <div className="flex-row" style={{ gap: "1rem", alignItems: "start" }}>
            {(deck.coverCard?.imageSmall ?? null) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={deck.coverCard!.imageSmall!}
                alt=""
                width={92}
                style={{ borderRadius: 6, flex: "none" }}
              />
            )}
            <div>
              <h1>{deck.title}</h1>
              <div className="flex-row" style={{ marginTop: "0.4rem" }}>
                <TypeBadge type={deck.type} />
                {!deck.isPublic && <span className="chip warn">rascunho</span>}
                <span className="muted small tnum">{total} cartas</span>
                {deck.views > 0 && <span className="muted small tnum">{deck.views} views</span>}
              </div>
              <p className="small muted" style={{ marginTop: "0.4rem" }}>
                {deck.player ? (
                  <>
                    por <Link href={`/jogadores/${deck.player.slug}`}>{deck.player.name}</Link>
                  </>
                ) : deck.author ? (
                  <>por {deck.author.displayName}</>
                ) : null}
                {" · atualizado em "}
                {deck.updatedAt.toLocaleDateString("pt-BR")}
                {version.version > 1 && ` · v${version.version}`}
              </p>
              {winGroups.length > 0 && (
                <div className="deck-wins">
                  {winGroups.map((g) => (
                    <div key={g.venue} className="deck-win-group">
                      <span className="deck-win-head">
                        <span aria-hidden="true">🏆</span>
                        <strong className="tnum">{g.dates.length}</strong>{" "}
                        {g.dates.length === 1 ? "insígnia" : "insígnias"} de {t.pt} na{" "}
                        <strong>{g.venue}</strong>
                      </span>
                      <span className="deck-win-dates">
                        {g.dates.map((d, i) => (
                          <span key={i} className="date-chip tnum">
                            {d ? formatBrDate(d) : "s/ data"}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex-row">
            <VoteButton
              deckId={deck.id}
              count={deck._count.votes}
              voted={!!myVote}
              back={`/decks/${deck.slug}`}
              loggedIn={!!user}
            />
            <CopyButton text={exportText} />
            {isOwner && (
              <Link href={`/decks/${deck.slug}/editar`} className="btn small">
                Editar
              </Link>
            )}
          </div>
        </div>
      </div>

      <DeckCardsView
        groups={(["POKEMON", "TRAINER", "ENERGY"] as const).map((cat) => ({
          key: cat,
          label: CATEGORY_LABEL[cat],
          // mantém a ordem manual definida no builder (position)
          items: version.cards
            .filter((dc) => dc.category === cat)
            .map((dc) => ({
              rawName: dc.rawName,
              quantity: dc.quantity,
              card: dc.card
                ? {
                    id: dc.card.id,
                    name: dc.card.name,
                    namePt: dc.card.namePt,
                    imageSmall: dc.card.imageSmall,
                    imageLarge: dc.card.imageLarge,
                    setName: dc.card.setName,
                    setPtcgoCode: dc.card.setPtcgoCode,
                    number: dc.card.number,
                    rarity: dc.card.rarity,
                    supertype: dc.card.supertype,
                    subtypes: dc.card.subtypes,
                    types: dc.card.types,
                    hp: dc.card.hp,
                    attacks: (dc.card.attacks as CardView["attacks"]) ?? null,
                    rules: dc.card.rules,
                  }
                : null,
            })),
        }))}
      />

      {deck.guide && (
        <>
          <h2>Guia do deck</h2>
          <div
            className="panel markdown-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(deck.guide) }}
          />
        </>
      )}

      {deck.versions.length > 1 && (
        <>
          <h2>Histórico de versões</h2>
          <ul className="small">
            {deck.versions.map((v) => (
              <li key={v.id}>
                <strong>v{v.version}</strong> — {v.createdAt.toLocaleDateString("pt-BR")}
                {v.changelog && <span className="muted"> · {v.changelog}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {isOwner && (
        <>
          <h2>Gerenciar</h2>
          <div className="panel">
            {user?.playerId ? (
              linkableWins.length > 0 ? (
                <form action={linkResultAction} className="filter-bar" style={{ margin: 0 }}>
                  <input type="hidden" name="deckId" value={deck.id} />
                  <label>
                    Vincular a uma vitória sua ({t.pt})
                    <select name="badgeWinId" required>
                      {linkableWins.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.venue.name}
                          {w.date ? ` — ${formatBrDate(w.date)}` : " — sem data"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="secondary">
                    🏆 Marcar como deck vencedor
                  </button>
                </form>
              ) : (
                <p className="muted small" style={{ margin: 0 }}>
                  Nenhuma vitória de {t.pt} disponível para vincular
                  {deck.resultLinks.length > 0 ? " (todas já vinculadas)" : ""}.
                </p>
              )
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                <Link href="/conta/reivindicar">Reivindique seu perfil de jogador</Link> para
                vincular este deck às suas vitórias.
              </p>
            )}

            {deck.resultLinks.length > 0 && (
              <div className="flex-row" style={{ marginTop: "0.6rem" }}>
                {deck.resultLinks.map((l) => (
                  <form key={l.id} action={unlinkResultAction}>
                    <input type="hidden" name="linkId" value={l.id} />
                    <button className="ghost small">
                      desvincular {l.badgeWin.venue.name}
                      {l.badgeWin.date ? ` ${formatBrDate(l.badgeWin.date)}` : ""} ✕
                    </button>
                  </form>
                ))}
              </div>
            )}

            <form
              action={deleteDeckAction}
              style={{ marginTop: "0.9rem" }}
            >
              <input type="hidden" name="deckId" value={deck.id} />
              <button className="danger small">Excluir deck</button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
