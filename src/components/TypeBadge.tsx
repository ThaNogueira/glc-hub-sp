import type { PokemonType } from "@prisma/client";
import { TYPE_BY_ID } from "@/lib/types";
import { TypeIcon } from "./TypeIcon";

/** Badge de tipo: ícone + nome PT sobre fundo tintado na cor do tipo. */
export function TypeBadge({
  type,
  iconOnly = false,
  size = 16,
}: {
  type: PokemonType;
  iconOnly?: boolean;
  size?: number;
}) {
  const t = TYPE_BY_ID[type];
  return (
    <span
      className={`type-badge${iconOnly ? " icon-only" : ""}`}
      style={{ ["--tb-color" as string]: `var(${t.cssVar})` }}
      title={t.pt}
    >
      <TypeIcon type={type} size={size} />
      {!iconOnly && t.pt}
    </span>
  );
}
