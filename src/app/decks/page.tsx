import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { DeckCard } from "@/components/DeckCard";
import { EmptyState } from "@/components/EmptyState";
import { Reveal } from "@/components/Reveal";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { TYPES } from "@/lib/types";

export const metadata = {
  title: "Galeria de decks",
  description:
    "Decks de Gym Leader Challenge da comunidade de São Paulo — filtre por tipo, carta ou autor.",
};

export default async function DecksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tipo = one(sp.tipo);
  const carta = one(sp.carta).trim();
  const autor = one(sp.autor).trim();
  const ordenar = one(sp.ordenar) === "vistos" ? "vistos" : "recentes";

  const where: Prisma.DeckWhereInput = { isPublic: true };
  if (TYPES.some((t) => t.id === tipo)) where.type = tipo as Prisma.DeckWhereInput["type"];
  if (carta)
    where.versions = {
      some: { cards: { some: { rawName: { contains: carta, mode: "insensitive" } } } },
    };
  if (autor)
    where.OR = [
      { author: { displayName: { contains: autor, mode: "insensitive" } } },
      { player: { name: { contains: autor, mode: "insensitive" } } },
    ];

  const [decks, user] = await Promise.all([
    prisma.deck.findMany({
      where,
      include: {
        coverCard: true,
        author: { select: { displayName: true } },
        player: { select: { name: true } },
      },
      orderBy: ordenar === "vistos" ? { views: "desc" } : { updatedAt: "desc" },
      take: 60,
    }),
    getSessionUser(),
  ]);

  return (
    <>
      <div className="flex-between">
        <div>
          <h1>Galeria de decks</h1>
          <p className="lead">Decks GLC da comunidade — todos validados nas regras do formato.</p>
        </div>
        <Link href={user ? "/decks/novo" : "/entrar?next=/decks/novo"} className="btn">
          + Montar deck
        </Link>
      </div>

      <form className="filter-bar" method="get" action="/decks">
        <label>
          Tipo
          <select name="tipo" defaultValue={tipo}>
            <option value="">Todos</option>
            {TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.pt}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contém a carta
          <input type="text" name="carta" defaultValue={carta} placeholder="ex.: Rare Candy" />
        </label>
        <label>
          Autor
          <input type="text" name="autor" defaultValue={autor} placeholder="nome" />
        </label>
        <label>
          Ordenar
          <select name="ordenar" defaultValue={ordenar}>
            <option value="recentes">Mais recentes</option>
            <option value="vistos">Mais vistos</option>
          </select>
        </label>
        <button type="submit" className="secondary">
          Filtrar
        </button>
      </form>

      {decks.length > 0 ? (
        <div className="deck-gallery">
          {decks.map((d, i) => (
            <Reveal key={d.id} delay={Math.min(i * 0.025, 0.3)}>
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
                }}
              />
            </Reveal>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nenhum deck publicado ainda"
          hint="Seja o primeiro líder de ginásio a publicar: monte um deck no builder e compartilhe com a liga."
        >
          <p style={{ marginTop: "1rem" }}>
            <Link href={user ? "/decks/novo" : "/entrar?next=/decks/novo"} className="btn">
              Montar meu deck
            </Link>
          </p>
        </EmptyState>
      )}
    </>
  );
}
