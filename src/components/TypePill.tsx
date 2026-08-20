import type { PokemonType } from "@prisma/client";
import { TYPE_BY_ID } from "@/lib/types";

export function TypePill({ type }: { type: PokemonType }) {
  const t = TYPE_BY_ID[type];
  return (
    <span
      className="type-pill"
      style={{ background: `color-mix(in srgb, ${t.color} 18%, transparent)`, color: "inherit" }}
    >
      <span className="type-dot" style={{ background: t.color }} />
      {t.pt}
    </span>
  );
}
