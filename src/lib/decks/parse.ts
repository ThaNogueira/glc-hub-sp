import type { Card } from "@prisma/client";
import { findByName, findByPtcgoCode, getBanlist } from "../cards/search";
import { fold } from "../normalize";
import { isCardBanned, type BanMatcher } from "../banlistOficial";
import type { GlcCard } from "../glc";

/**
 * Importação de decklists em texto (formato TCG Live / Limitless) e,
 * best-effort, por URL (Limitless / Cardboard Warriors). Resolve cada linha
 * contra a base local e reporta as não reconhecidas.
 */

export function cardToGlc(card: Card, banlist: BanMatcher): GlcCard {
  return {
    id: card.id,
    name: card.name,
    namePt: card.namePt,
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
    banned: isCardBanned(banlist, card),
  };
}

/** Linha que o parser não resolveu, com candidatas para o usuário escolher. */
export type UnresolvedLine = {
  line: string;
  name: string;
  quantity: number;
  suggestions: GlcCard[];
};

export type ParsedDeck = {
  entries: { card: GlcCard; quantity: number }[];
  unresolved: UnresolvedLine[];
};

// "4 Rare Candy SVI 191" | "1 Snorlax" | "* 2 Ultra Ball PLB 90"
// (com sufixo opcional PH/RH do TCG Live: "1 Kirlia SIT 68 PH")
// número aceita prefixo de letras ("BW28", "SWSH003", "GG01", "SV025", "TG12")
const LINE_RE =
  /^(?:\*\s*)?(\d+)\s*[x×]?\s+(.+?)(?:\s+([A-Z][A-Z0-9]{1,4}(?:-[A-Z]+)?)\s+([A-Za-z]{0,4}\d+[a-zA-Z]*))?(?:\s+(?:PH|RH))?\s*$/;

const HEADER_RE = /^(pok[eé]mon|trainer|treinador(?:es)?|energy|energia)s?\s*[:(-]?\s*\d*\s*\)?$/i;

/** Remove ruído do TCG Live: tokens "{W}", sufixo PH/RH, espaços duplos. */
function cleanCardName(raw: string): string {
  return raw
    .replace(/\{[A-Z*+]\}/gi, " ")
    .replace(/\s+(?:PH|RH)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const BASIC_ENERGY_RE =
  /^(?:basic\s+)?(grass|water|fire|lightning|psychic|fighting|darkness|metal|fairy)\s+energy$/i;

export async function parseDeckText(
  text: string,
  opts: { suggest?: boolean } = {},
): Promise<ParsedDeck> {
  const banlist = await getBanlist();
  const byName = new Map<string, { card: GlcCard; quantity: number }>();
  const unresolved: UnresolvedLine[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || HEADER_RE.test(line) || /^total/i.test(line)) continue;

    const m = line.match(LINE_RE);
    if (!m) {
      unresolved.push({ line, name: cleanCardName(line), quantity: 1, suggestions: [] });
      continue;
    }
    const quantity = Number(m[1]);
    const name = cleanCardName(m[2]);
    const setCode = m[3];
    const number = m[4];

    // 1º: código de coleção; 2º: nome exato (EN/PT); depois variações
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
    if (!card && /energ(y|ia)/i.test(name)) card = await findByName(`Basic ${name}`);
    // energia básica sem match exato (código estranho, arte de promo etc.):
    // usa a arte padrão mais recente daquela energia
    if (!card) {
      const be = name.match(BASIC_ENERGY_RE);
      if (be) card = await findByName(`${be[1]} Energy`);
    }

    if (!card) {
      // nada bateu — busca fuzzy vira lista de candidatas pro usuário escolher
      let suggestions: GlcCard[] = [];
      if (opts.suggest !== false && name.length >= 2) {
        const { searchCards } = await import("../cards/search");
        suggestions = (await searchCards({ q: name, limit: 18 })).filter((s) => !s.banned);
      }
      unresolved.push({ line, name, quantity, suggestions });
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

    // sem sugestões aqui: o texto da página tem muito ruído que não é carta
    const result = await parseDeckText(text, { suggest: false });
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
