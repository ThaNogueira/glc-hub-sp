import { redirect } from "next/navigation";
import { DeckBuilder } from "@/components/DeckBuilder";
import { getSessionUser } from "@/lib/auth";
import { getSetOptions } from "@/lib/decks/sets";

export const metadata = { title: "Novo deck GLC" };

export default async function NewDeckPage() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/decks/novo");

  const sets = await getSetOptions();

  return (
    <>
      <h1>Novo deck GLC</h1>
      <p className="lead">
        60 cartas · singleton (exceto energia básica) · Pokémon mono-tipo · sem Rule Box. A
        validação roda em tempo real.
      </p>
      <DeckBuilder
        initial={{
          title: "",
          type: "",
          guide: "",
          coverCardId: null,
          isPublic: false,
          entries: [],
        }}
        sets={sets}
      />
    </>
  );
}
