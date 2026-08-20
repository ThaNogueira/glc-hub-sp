import type { PokemonType } from "@prisma/client";
import { TYPE_BY_ID, typeIconSrc } from "@/lib/types";

/**
 * Insígnia de ginásio: escudo SVG na cor do tipo com o ícone oficial de
 * energia ao centro (servido localmente — ver /creditos).
 */
export function BadgeShield({ type, size = 56 }: { type: PokemonType; size?: number }) {
  const t = TYPE_BY_ID[type];
  const iconSize = size * 0.42;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`Insígnia ${t.pt}`}
    >
      <path
        d="M32 3 L57 13 V33 C57 47 46 57 32 61 C18 57 7 47 7 33 V13 Z"
        fill={t.color}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="2"
      />
      <path
        d="M32 10 L50 17.5 V33 C50 43.5 42 51.5 32 55 C22 51.5 14 43.5 14 33 V17.5 Z"
        fill="rgba(255,255,255,0.14)"
      />
      <circle cx="32" cy="31" r="12.5" fill="rgba(255,255,255,0.92)" />
      <image
        href={typeIconSrc(type, iconSize)}
        x={32 - 10.5}
        y={31 - 10.5}
        width={21}
        height={21}
      />
    </svg>
  );
}
