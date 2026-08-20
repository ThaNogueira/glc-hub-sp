import type { PokemonType } from "@prisma/client";

export type TypeInfo = {
  id: PokemonType;
  pt: string;
  en: string;
  color: string; // cor base do tipo (paleta do design system)
  textOn: string; // cor de texto legível sobre `color` sólido
  cssVar: string; // CSS variable exposta em globals.css
};

/** Os 11 tipos do GLC, na ordem canônica das colunas da planilha. */
export const TYPES: TypeInfo[] = [
  { id: "GRASS", pt: "Planta", en: "Grass", color: "#7AC74C", textOn: "#0c1408", cssVar: "--type-grass" },
  { id: "WATER", pt: "Água", en: "Water", color: "#6390F0", textOn: "#070d1c", cssVar: "--type-water" },
  { id: "FIRE", pt: "Fogo", en: "Fire", color: "#EE8130", textOn: "#180a02", cssVar: "--type-fire" },
  { id: "LIGHTNING", pt: "Elétrico", en: "Lightning", color: "#F7D02C", textOn: "#171203", cssVar: "--type-lightning" },
  { id: "COLORLESS", pt: "Incolor", en: "Colorless", color: "#A8A77A", textOn: "#111108", cssVar: "--type-colorless" },
  { id: "FIGHTING", pt: "Lutador", en: "Fighting", color: "#C22E28", textOn: "#ffffff", cssVar: "--type-fighting" },
  { id: "PSYCHIC", pt: "Psíquico", en: "Psychic", color: "#F95587", textOn: "#1a040c", cssVar: "--type-psychic" },
  { id: "DRAGON", pt: "Dragão", en: "Dragon", color: "#6F35FC", textOn: "#ffffff", cssVar: "--type-dragon" },
  { id: "DARKNESS", pt: "Noturno", en: "Darkness", color: "#705746", textOn: "#ffffff", cssVar: "--type-darkness" },
  { id: "METAL", pt: "Metal", en: "Metal", color: "#B7B7CE", textOn: "#101018", cssVar: "--type-metal" },
  { id: "FAIRY", pt: "Fada", en: "Fairy", color: "#D685AD", textOn: "#180810", cssVar: "--type-fairy" },
];

export const TYPE_BY_ID: Record<PokemonType, TypeInfo> = Object.fromEntries(
  TYPES.map((t) => [t.id, t]),
) as Record<PokemonType, TypeInfo>;

/** Ícone local (origem: Bulbagarden Archives, ver /creditos). */
export function typeIconSrc(type: PokemonType, size: number): string {
  return size > 22 ? `/icons/types/${type}-lg.png` : `/icons/types/${type}.png`;
}

/** Mapeia o tipo em inglês do dataset pokemon-tcg-data para o enum. */
export function typeFromDataset(en: string): PokemonType | null {
  const hit = TYPES.find((t) => t.en.toLowerCase() === en.toLowerCase());
  return hit?.id ?? null;
}

export const WEEKDAYS_PT = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
]; // índice 0 = weekday 1 (segunda) ... 6 = weekday 7 (domingo)
