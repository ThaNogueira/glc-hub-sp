import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { TypeBadge } from "@/components/TypeBadge";
import { getSessionUser } from "@/lib/auth";
import { getBanlistNormalized } from "@/lib/cards/search";
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

  // contador de views (não conta o próprio autor)
  if (deck.isPublic && !isOwner) {
    prisma.deck
      .update({ where: { id: deck.id }, data: { views: { increment: 1 } } })
      .catch(() => {});
  }

  const version = deck.versions[0];
  if (!version) notFound();

  const banlist = await getBanlistNormalized();
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

  return (
    <>
      <div
        className="player-hero"
        style={{ ["--hero-color" as string]: `var(${t.cssVar})` }}
      >
        <div className="flex-between" style={{ alignItems: "start" }}>
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
              {deck.resultLinks.length > 0 && (
                <p className="small" style={{ marginTop: "0.4rem" }}>
                  {deck.resultLinks.map((l) => (
                    <span key={l.id} className="chip ok" style={{ marginRight: 6 }}>
                      🏆 ganhou a insígnia de {t.pt} na {l.badgeWin.venue.name}
                      {l.badgeWin.date ? ` em ${formatBrDate(l.badgeWin.date)}` : ""}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
          <div className="flex-row">
            <CopyButton text={exportText} />
            {isOwner && (
              <Link href={`/decks/${deck.slug}/editar`} className="btn small">
                Editar
              </Link>
            )}
          </div>
        </div>
      </div>

      {(["POKEMON", "TRAINER", "ENERGY"] as const).map((cat) => {
        // mantém a ordem manual definida no builder (position)
        const items = version.cards.filter((dc) => dc.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat}>
            <h2>
              {CATEGORY_LABEL[cat]}{" "}
              <span className="muted tnum small">
                {items.reduce((a, i) => a + i.quantity, 0)}
              </span>
            </h2>
            <div className="deck-view-grid">
              {items.map((dc) => (
                <div key={dc.id} className="deck-view-card" title={`${dc.quantity}× ${dc.rawName}`}>
                  {dc.card?.imageSmall ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={dc.card.imageSmall} alt={dc.rawName} loading="lazy" decoding="async" />
                  ) : (
                    <span className="deck-view-fallback">{dc.rawName}</span>
                  )}
                  {dc.quantity > 1 && <span className="qty-badge tnum">×{dc.quantity}</span>}
                </div>
              ))}
            </div>
          </section>
        );
      })}

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
