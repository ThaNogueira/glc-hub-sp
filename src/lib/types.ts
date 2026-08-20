import type { PokemonType } from "@prisma/client";

export type TypeInfo = {
  id: PokemonType;
  pt: string;
  en: string;
  color: string; // cor oficial-ish do símbolo de energia
  textOn: string; // cor de texto legível sobre `color`
};

/** Os 11 tipos do GLC, na ordem canônica das colunas da planilha. */
export const TYPES: TypeInfo[] = [
  { id: "GRASS", pt: "Planta", en: "Grass", color: "#4e9a35", textOn: "#fff" },
  { id: "WATER", pt: "Água", en: "Water", color: "#2481c9", textOn: "#fff" },
  { id: "FIRE", pt: "Fogo", en: "Fire", color: "#d3423e", textOn: "#fff" },
  { id: "LIGHTNING", pt: "Elétrico", en: "Lightning", color: "#e5b000", textOn: "#1c1c1c" },
  { id: "COLORLESS", pt: "Incolor", en: "Colorless", color: "#a49db0", textOn: "#1c1c1c" },
  { id: "FIGHTING", pt: "Lutador", en: "Fighting", color: "#b06030", textOn: "#fff" },
  { id: "PSYCHIC", pt: "Psíquico", en: "Psychic", color: "#8e44ad", textOn: "#fff" },
  { id: "DRAGON", pt: "Dragão", en: "Dragon", color: "#a8891c", textOn: "#fff" },
  { id: "DARKNESS", pt: "Noturno", en: "Darkness", color: "#2f3b4d", textOn: "#fff" },
  { id: "METAL", pt: "Metal", en: "Metal", color: "#7a8b99", textOn: "#fff" },
  { id: "FAIRY", pt: "Fada", en: "Fairy", color: "#d9538f", textOn: "#fff" },
];

export const TYPE_BY_ID: Record<PokemonType, TypeInfo> = Object.fromEntries(
  TYPES.map((t) => [t.id, t]),
) as Record<PokemonType, TypeInfo>;

export const WEEKDAYS_PT = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
]; // índice 0 = weekday 1 (segunda) ... 6 = weekday 7 (domingo)
