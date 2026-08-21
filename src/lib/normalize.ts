import type { PokemonType } from "@prisma/client";
import { TYPES } from "./types";

/** Normaliza para chave de lookup: minúsculas, sem acento, espaços colapsados. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function slugify(s: string): string {
  return fold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Variações de grafia aceitas no parse, além dos nomes canônicos PT e EN. */
const TYPE_VARIANTS: Record<string, PokemonType> = {
  grama: "GRASS",
  agua: "WATER",
  eletrico: "LIGHTNING",
  raio: "LIGHTNING",
  normal: "COLORLESS",
  luta: "FIGHTING",
  psiquico: "PSYCHIC",
  dragao: "DRAGON",
  escuridao: "DARKNESS",
  sombrio: "DARKNESS",
  dark: "DARKNESS",
  aco: "METAL",
  ferro: "METAL",
};

const TYPE_LOOKUP: Record<string, PokemonType> = {
  ...Object.fromEntries(TYPES.map((t) => [fold(t.pt), t.id])),
  ...Object.fromEntries(TYPES.map((t) => [fold(t.en), t.id])),
  ...TYPE_VARIANTS,
};

export function normalizeType(raw: string): PokemonType | null {
  return TYPE_LOOKUP[fold(raw)] ?? null;
}

/** "DD/MM/YYYY" ou "DD/MM/YY" → Date (UTC meio-dia, para não deslizar de fuso). */
export function parseBrDate(raw: string): Date | null {
  const m = fold(raw).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2020 || year > 2100) return null;
  const d = new Date(Date.UTC(year, month - 1, day, 12));
  if (d.getUTCDate() !== day || d.getUTCMonth() !== month - 1) return null;
  return d;
}

/** Semana ISO-8601 no formato "2026-W34" (chave do "decks em alta"). */
export function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function formatBrDate(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/** "Citadel\n (Santana)" → { name: "Citadel", neighborhood: "Santana" } */
export function splitVenueHeader(raw: string): { name: string; neighborhood: string | null } {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  const m = collapsed.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (m) return { name: m[1].trim(), neighborhood: m[2].trim() };
  return { name: collapsed, neighborhood: null };
}
