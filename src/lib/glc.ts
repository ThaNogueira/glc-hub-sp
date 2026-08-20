import type { PokemonType } from "@prisma/client";
import { TYPES } from "./types";

/**
 * Regras do Gym Leader Challenge — validação em tempo real do deck builder.
 * Client-safe: sem Prisma/IO; recebe as cartas já carregadas.
 */

export type GlcCard = {
  id: string;
  name: string;
  namePt: string | null;
  supertype: string; // Pokémon | Trainer | Energy
  subtypes: string[];
  types: string[]; // tipos em inglês do dataset ("Fire", ...)
  hp: number | null;
  rules: string[];
  attacks: { name: string; cost?: string[]; convertedEnergyCost?: number }[] | null;
  imageSmall: string | null;
  imageLarge: string | null;
  setName: string;
  setPtcgoCode: string | null;
  number: string;
  hasRuleBox: boolean;
  isAceSpec: boolean;
  isBasicEnergy: boolean;
  glcLegal: boolean;
  banned: boolean;
};

export type DeckEntry = { card: GlcCard; quantity: number };

export type GlcCategory = "POKEMON" | "TRAINER" | "ENERGY";

export function categoryOf(card: Pick<GlcCard, "supertype">): GlcCategory {
  if (card.supertype === "Pokémon") return "POKEMON";
  if (card.supertype === "Energy") return "ENERGY";
  return "TRAINER";
}

function foldName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function typeEnToEnum(en: string): PokemonType | null {
  const hit = TYPES.find((t) => t.en.toLowerCase() === en.toLowerCase());
  return hit?.id ?? null;
}

export function typeEnumToEn(id: PokemonType): string {
  return TYPES.find((t) => t.id === id)?.en ?? id;
}

export type ValidationIssue = { level: "error" | "warning"; message: string; cardName?: string };

export type DeckValidation = {
  count: number;
  deckType: PokemonType | null; // declarado ou inferido do primeiro Pokémon
  issues: ValidationIssue[];
  ok: boolean; // sem erros e com 60 cartas
};

/**
 * Valida o deck contra as regras do GLC:
 * exatamente 60 cartas · singleton por nome (exceto energia básica) ·
 * Pokémon mono-tipo · sem Rule Box / ACE SPEC / banidas / fora do pool BW+.
 */
export function validateDeck(
  entries: DeckEntry[],
  declaredType: PokemonType | null,
): DeckValidation {
  const issues: ValidationIssue[] = [];
  const count = entries.reduce((acc, e) => acc + e.quantity, 0);

  if (count !== 60) {
    issues.push({
      level: "error",
      message:
        count < 60
          ? `O deck tem ${count}/60 cartas — faltam ${60 - count}.`
          : `O deck tem ${count}/60 cartas — remova ${count - 60}.`,
    });
  }

  // singleton por nome (energias básicas liberadas)
  const seen = new Map<string, number>();
  for (const e of entries) {
    if (e.card.isBasicEnergy) continue;
    const key = foldName(e.card.name);
    seen.set(key, (seen.get(key) ?? 0) + e.quantity);
  }
  for (const e of entries) {
    if (e.card.isBasicEnergy) continue;
    const key = foldName(e.card.name);
    if ((seen.get(key) ?? 0) > 1) {
      issues.push({
        level: "error",
        message: `Singleton: só 1 cópia de "${e.card.name}" é permitida.`,
        cardName: e.card.name,
      });
      seen.set(key, 1); // reporta uma vez por nome
    }
  }

  // tipo do deck: declarado ou inferido do primeiro Pokémon
  const pokemon = entries.filter((e) => categoryOf(e.card) === "POKEMON");
  let deckType = declaredType;
  if (!deckType) {
    const first = pokemon[0]?.card.types?.[0];
    deckType = first ? typeEnToEnum(first) : null;
  }

  if (deckType) {
    const en = typeEnumToEn(deckType).toLowerCase();
    for (const e of pokemon) {
      const cardTypes = (e.card.types ?? []).map((t) => t.toLowerCase());
      if (cardTypes.length > 0 && !cardTypes.includes(en)) {
        issues.push({
          level: "error",
          message: `Mono-tipo: "${e.card.name}" (${e.card.types.join("/")}) não é do tipo do deck.`,
          cardName: e.card.name,
        });
      }
    }
  } else if (pokemon.length === 0 && count > 0) {
    issues.push({ level: "warning", message: "O deck ainda não tem Pokémon." });
  }

  // cartas proibidas
  for (const e of entries) {
    if (e.card.banned) {
      issues.push({
        level: "error",
        message: `"${e.card.name}" está na banlist do GLC.`,
        cardName: e.card.name,
      });
    } else if (e.card.hasRuleBox) {
      issues.push({
        level: "error",
        message: `"${e.card.name}" tem Rule Box (ex, V, GX, Radiant...) — proibida no GLC.`,
        cardName: e.card.name,
      });
    } else if (e.card.isAceSpec) {
      issues.push({
        level: "error",
        message: `"${e.card.name}" é ACE SPEC — proibida no GLC.`,
        cardName: e.card.name,
      });
    } else if (!e.card.glcLegal) {
      issues.push({
        level: "error",
        message: `"${e.card.name}" está fora do card pool do GLC (Black & White em diante).`,
        cardName: e.card.name,
      });
    }
  }

  const ok = count === 60 && !issues.some((i) => i.level === "error");
  return { count, deckType, issues, ok };
}

// ---------------------------------------------------------------------------
// Estatísticas ao vivo do builder
// ---------------------------------------------------------------------------

export type DeckStats = {
  pokemon: number;
  trainer: number;
  energy: number;
  /** curva: nº de Pokémon por custo mínimo de ataque (0..5+) */
  curve: number[];
  draw: number;
  search: number;
  recovery: number;
};

const RE_DRAW = /draw (a card|\d+ cards|cards)/i;
const RE_SEARCH = /search your deck/i;
const RE_RECOVERY = /(from your discard pile)|(discard pile (into|to) your (hand|deck))/i;

export function deckStats(entries: DeckEntry[]): DeckStats {
  let pokemon = 0;
  let trainer = 0;
  let energy = 0;
  const curve = [0, 0, 0, 0, 0, 0]; // índice 5 = "5+"
  let draw = 0;
  let search = 0;
  let recovery = 0;

  for (const e of entries) {
    const cat = categoryOf(e.card);
    if (cat === "POKEMON") {
      pokemon += e.quantity;
      const costs = (e.card.attacks ?? [])
        .map((a) => a.convertedEnergyCost ?? (a.cost?.length ?? 0))
        .filter((c) => Number.isFinite(c));
      if (costs.length > 0) {
        const min = Math.min(...costs);
        curve[Math.min(min, 5)] += e.quantity;
      }
    } else if (cat === "ENERGY") {
      energy += e.quantity;
    } else {
      trainer += e.quantity;
    }

    const text = (e.card.rules ?? []).join(" ");
    if (RE_DRAW.test(text)) draw += e.quantity;
    if (RE_SEARCH.test(text)) search += e.quantity;
    if (RE_RECOVERY.test(text)) recovery += e.quantity;
  }

  return { pokemon, trainer, energy, curve, draw, search, recovery };
}

// ---------------------------------------------------------------------------
// Exportação em texto (formato TCG Live / Limitless)
// ---------------------------------------------------------------------------

export function exportDeckText(entries: DeckEntry[]): string {
  const groups: { label: string; cat: GlcCategory }[] = [
    { label: "Pokémon", cat: "POKEMON" },
    { label: "Trainer", cat: "TRAINER" },
    { label: "Energy", cat: "ENERGY" },
  ];
  const lines: string[] = [];
  for (const g of groups) {
    const items = entries.filter((e) => categoryOf(e.card) === g.cat);
    if (items.length === 0) continue;
    const total = items.reduce((a, e) => a + e.quantity, 0);
    lines.push(`${g.label}: ${total}`);
    for (const e of items) {
      const code = e.card.setPtcgoCode ? ` ${e.card.setPtcgoCode} ${e.card.number}` : "";
      lines.push(`${e.quantity} ${e.card.name}${code}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
