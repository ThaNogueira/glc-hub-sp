import { notFound, redirect } from "next/navigation";
import { DeckBuilder } from "@/components/DeckBuilder";
import { getSessionUser } from "@/lib/auth";
import { getBanlistNormalized } from "@/lib/cards/search";
import { cardToGlc } from "@/lib/decks/parse";
import { getSetOptions } from "@/lib/decks/sets";
import { prisma } from "@/lib/db";

export const metadata = { title: "Editar deck", robots: { index: false } };

export default async function EditDeckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/entrar?next=/decks/${slug}/editar`);

  const deck = await prisma.deck.findUnique({
    where: { slug },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { cards: { include: { card: true }, orderBy: { position: "asc" } } },
      },
    },
  });
  if (!deck || deck.authorUserId !== user.id) notFound();

  const version = deck.versions[0];
  const banlist = await getBanlistNormalized();
  const entries = (version?.cards ?? [])
    .filter((dc) => dc.card)
    .map((dc) => ({ card: cardToGlc(dc.card!, banlist), quantity: dc.quantity }));

  const sets = await getSetOptions();

  return (
    <>
      <h1>Editar deck</h1>
      <p className="lead">
        Salvar cria uma nova versão (v{(version?.version ?? 0) + 1}) — use o changelog para anotar
        o que mudou.
      </p>
      <DeckBuilder
        initial={{
          deckId: deck.id,
          title: deck.title,
          type: deck.type,
          guide: deck.guide ?? "",
          coverCardId: deck.coverCardId,
          isPublic: deck.isPublic,
          entries,
        }}
        sets={sets}
      />
    </>
  );
}
