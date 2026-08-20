import type { Card } from "@prisma/client";
import { findByName, findByPtcgoCode, getBanlistNormalized } from "../cards/search";
import { fold } from "../normalize";
import type { GlcCard } from "../glc";

/**
 * Importação de decklists em texto (formato TCG Live / Limitless) e,
 * best-effort, por URL (Limitless / Cardboard Warriors). Resolve cada linha
 * contra a base local e reporta as não reconhecidas.
 */

export function cardToGlc(card: Card, banlist: Set<string>): GlcCard {
  return {
    id: card.id,
    name: card.name,
    supertype: card.supertype,
    subtypes: card.subtypes,
    types: card.types,
    hp: card.hp,
    rules: card.rules,
    attacks: (card.attacks as GlcCard["attacks"]) ?? null,
    imageSmall: card.imageSmall,
    imageLarge: card.imageLarge,
    setName: card.setName,
    setPtcgoCode: card.setPtcgoCode,
    number: card.number,
    hasRuleBox: card.hasRuleBox,
    isAceSpec: card.isAceSpec,
    isBasicEnergy: card.isBasicEnergy,
    glcLegal: card.glcLegal,
    banned: banlist.has(fold(card.name)),
  };
}

export type ParsedDeck = {
  entries: { card: GlcCard; quantity: number }[];
  unresolved: string[]; // linhas que não foram reconhecidas
};

// "4 Rare Candy SVI 191" | "1 Snorlax" | "* 2 Ultra Ball PLB 90"
const LINE_RE =
  /^(?:\*\s*)?(\d+)\s*[x×]?\s+(.+?)(?:\s+([A-Z][A-Z0-9]{1,4}(?:-[A-Z]+)?)\s+([A-Za-z]?\d+[a-zA-Z]?))?\s*$/;

const HEADER_RE = /^(pok[eé]mon|trainer|treinador(?:es)?|energy|energia)s?\s*[:(-]?\s*\d*\s*\)?$/i;

export async function parseDeckText(text: string): Promise<ParsedDeck> {
  const banlist = await getBanlistNormalized();
  const byName = new Map<string, { card: GlcCard; quantity: number }>();
  const unresolved: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || HEADER_RE.test(line) || /^total/i.test(line)) continue;

    const m = line.match(LINE_RE);
    if (!m) {
      unresolved.push(line);
      continue;
    }
    const quantity = Number(m[1]);
    const name = m[2].trim();
    const setCode = m[3];
    const number = m[4];

    let card: Card | null = null;
    if (setCode && number) {
      card = await findByPtcgoCode(setCode, number);
      // código e nome divergem (lista corrompida/números errados) → o nome manda
      if (card && fold(card.name) !== fold(name)) {
        card = (await findByName(name)) ?? card;
      }
    }
    if (!card) card = await findByName(name);
    // "Basic Fire Energy" ↔ "Fire Energy" (grafias variam entre exportadores)
    if (!card && /^basic\s+/i.test(name)) card = await findByName(name.replace(/^basic\s+/i, ""));
    if (!card && /energy$/i.test(name)) card = await findByName(`Basic ${name}`);

    if (!card) {
      unresolved.push(line);
      continue;
    }

    const key = fold(card.name);
    const existing = byName.get(key);
    if (existing) existing.quantity += quantity;
    else byName.set(key, { card: cardToGlc(card, banlist), quantity });
  }

  return { entries: [...byName.values()], unresolved };
}

/**
 * Importação por link (Limitless / Cardboard Warriors) — best-effort:
 * baixa a página e tenta extrair linhas de decklist do texto.
 */
export async function parseDeckUrl(url: string): Promise<ParsedDeck & { error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { entries: [], unresolved: [], error: "URL inválida." };
  }
  const allowed = ["limitlesstcg.com", "cardboardwarriors.net", "play.limitlesstcg.com"];
  if (!allowed.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
    return {
      entries: [],
      unresolved: [],
      error: "Só aceitamos links do Limitless ou do Cardboard Warriors — ou cole a lista em texto.",
    };
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "GLCHubSP/1.0 (projeto de fã)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // remove scripts/styles e tags, preservando quebras de linha
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<(br|\/p|\/div|\/li|\/tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"');

    const result = await parseDeckText(text);
    const totalCards = result.entries.reduce((a, e) => a + e.quantity, 0);
    if (result.entries.length < 5 || totalCards < 20) {
      return {
        entries: [],
        unresolved: [],
        error:
          "Não conseguimos extrair a lista dessa página — use a exportação em texto do site e cole aqui.",
      };
    }
    return { entries: result.entries, unresolved: [] };
  } catch {
    return {
      entries: [],
      unresolved: [],
      error: "Falha ao baixar a página — cole a lista em texto.",
    };
  }
}
