import type { PokemonType } from "@prisma/client";
import { TYPE_BY_ID, typeIconSrc } from "@/lib/types";

/**
 * Ícone oficial de energia do tipo, servido localmente
 * (fonte: Bulbagarden Archives — ver /creditos).
 * Usa a arte ampliada (128px) quando size > 22 para não ficar embaçado.
 */
export function TypeIcon({
  type,
  size = 18,
  className,
}: {
  type: PokemonType;
  size?: number;
  className?: string;
}) {
  const t = TYPE_BY_ID[type];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeIconSrc(type, size)}
      width={size}
      height={size}
      alt={t.pt}
      title={t.pt}
      loading="lazy"
      decoding="async"
      className={className}
      style={{ display: "inline-block", verticalAlign: "-0.18em" }}
    />
  );
}
