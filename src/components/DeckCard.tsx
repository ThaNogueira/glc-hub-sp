import Link from "next/link";
import type { PokemonType } from "@prisma/client";
import { TYPE_BY_ID } from "@/lib/types";
import { TypeIcon } from "./TypeIcon";
import { TypeBadge } from "./TypeBadge";

export type DeckCardData = {
  slug: string;
  title: string;
  type: PokemonType;
  isChampion: boolean;
  coverImage: string | null; // imageSmall da carta-capa
  authorName: string | null;
  updatedAt: string; // ISO
  views: number;
};

/** Card de deck na galeria: carta-capa + tipo + autor, glow do tipo no hover. */
export function DeckCard({ deck }: { deck: DeckCardData }) {
  const t = TYPE_BY_ID[deck.type];
  return (
    <Link
      href={`/decks/${deck.slug}`}
      className="hover-card deck-card"
      style={{ ["--card-glow" as string]: `var(${t.cssVar})` }}
    >
      <span className="cover">
        {deck.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={deck.coverImage} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="placeholder">
            <TypeIcon type={deck.type} size={28} />
          </span>
        )}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <h3>{deck.title}</h3>
        <span className="meta-line">
          <TypeBadge type={deck.type} size={13} />
          {deck.isChampion && (
            <span className="chip ok" title="Deck vencedor de torneio">
              🏆 campeão
            </span>
          )}
        </span>
        <span className="meta-line" style={{ marginTop: "0.3rem" }}>
          {deck.authorName && <span>{deck.authorName}</span>}
          <span>·</span>
          <span>{new Date(deck.updatedAt).toLocaleDateString("pt-BR")}</span>
          {deck.views > 0 && (
            <>
              <span>·</span>
              <span className="tnum">{deck.views} views</span>
            </>
          )}
        </span>
      </span>
    </Link>
  );
}
