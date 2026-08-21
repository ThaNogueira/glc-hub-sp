import Link from "next/link";
import { toggleDeckVoteAction } from "@/app/decks/actions";

/**
 * Botão de upvote de deck (form server action — funciona sem JS).
 * Deslogado, vira link para /entrar preservando o destino.
 */
export function VoteButton({
  deckId,
  count,
  voted,
  back,
  loggedIn,
}: {
  deckId: string;
  count: number;
  voted: boolean;
  back: string;
  loggedIn: boolean;
}) {
  if (!loggedIn) {
    return (
      <Link
        href={`/entrar?next=${encodeURIComponent(back)}`}
        className="vote-btn"
        title="Entre para dar upvote"
      >
        ▲ <span className="tnum">{count}</span>
      </Link>
    );
  }
  return (
    <form action={toggleDeckVoteAction} style={{ display: "inline-flex" }}>
      <input type="hidden" name="deckId" value={deckId} />
      <input type="hidden" name="back" value={back} />
      <button
        type="submit"
        className={`vote-btn${voted ? " voted" : ""}`}
        title={voted ? "Remover upvote" : "Dar upvote neste deck"}
        aria-pressed={voted}
      >
        ▲ <span className="tnum">{count}</span>
      </button>
    </form>
  );
}
