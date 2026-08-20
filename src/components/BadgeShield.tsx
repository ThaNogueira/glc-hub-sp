import type { PokemonType } from "@prisma/client";
import { TYPE_BY_ID } from "@/lib/types";

/**
 * Insígnia de ginásio: escudo SVG com a cor do tipo (design próprio inspirado
 * nos símbolos de energia — nada de assets oficiais).
 */
export function BadgeShield({
  type,
  size = 56,
}: {
  type: PokemonType;
  size?: number;
}) {
  const t = TYPE_BY_ID[type];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`Insígnia ${t.pt}`}>
      <path
        d="M32 3 L57 13 V33 C57 47 46 57 32 61 C18 57 7 47 7 33 V13 Z"
        fill={t.color}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="2"
      />
      <path
        d="M32 10 L50 17.5 V33 C50 43.5 42 51.5 32 55 C22 51.5 14 43.5 14 33 V17.5 Z"
        fill="rgba(255,255,255,0.16)"
      />
      <circle cx="32" cy="31" r="10" fill="rgba(255,255,255,0.85)" />
      <circle cx="32" cy="31" r="6" fill={t.color} />
    </svg>
  );
}
