import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { prisma } from "../db";
import { fold } from "../normalize";

/**
 * Importador da base de cartas a partir do repositório público
 * PokemonTCG/pokemon-tcg-data (mesmo dataset da pokemontcg.io).
 * Baixa o tarball do GitHub, lê sets/en.json + cards/en/*.json e faz upsert
 * na tabela Card com as flags GLC pré-computadas. Reutilizado pelo script
 * `npm run cards:import` e pelo job periódico do worker.
 */

const TARBALL_URL =
  "https://codeload.github.com/PokemonTCG/pokemon-tcg-data/tar.gz/refs/heads/master";

// Imagens oficiais do Limitless (chave: "CÓDIGO NÚMERO", ex.: "SVI 191")
const LIMITLESS_SMALL_URL = "https://amydev.me/twinleaf-json/image-jsons/limitlesstcg/small.json";
const LIMITLESS_LARGE_URL = "https://amydev.me/twinleaf-json/image-jsons/limitlesstcg/large.json";

// Nomes localizados via TCGdex — o join EN×PT é feito pelo id do TCGdex,
// gerando um dicionário nome-EN → nome-PT (nível de nome, não de impressão)
const TCGDEX_EN_URL = "https://api.tcgdex.net/v2/en/cards";
const TCGDEX_PT_URL = "https://api.tcgdex.net/v2/pt/cards";

// Início do card pool do GLC: Black & White (25/04/2011)
const GLC_POOL_START = "2011/04/25";

// Subtypes que caracterizam Rule Box (proibidos no GLC).
// BREAK fica de fora de propósito: não tem Rule Box e é legal no formato.
const RULE_BOX_SUBTYPES = new Set([
  "EX",
  "ex",
  "GX",
  "V",
  "VMAX",
  "VSTAR",
  "V-UNION",
  "Radiant",
  "Prism Star",
  "TAG TEAM",
  "MEGA",
  "Tera", // Tera ex já cai em "ex"; presente por segurança
]);

type DatasetSet = {
  id: string;
  name: string;
  series: string;
  ptcgoCode?: string;
  releaseDate?: string; // "2011/04/25"
};

type DatasetCard = {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  types?: string[];
  hp?: string;
  rules?: string[];
  evolvesFrom?: string;
  regulationMark?: string;
  legalities?: Record<string, string>;
  attacks?: { name: string; cost?: string[]; convertedEnergyCost?: number; damage?: string; text?: string }[];
  number: string;
  rarity?: string;
  images?: { small?: string; large?: string };
};

export type CardImportStats = {
  sets: number;
  cards: number;
  created: number;
  updated: number;
  ms: number;
};

function deriveFlags(card: DatasetCard, set: DatasetSet) {
  const subtypes = card.subtypes ?? [];
  const rulesText = (card.rules ?? []).join(" ").toLowerCase();

  // Prism Star (◇) tem Rule Box em qualquer supertipo (Lysandre ◇, Beast
  // Energy ◇...); os demais marcadores só existem em Pokémon.
  const hasRuleBox =
    subtypes.includes("Prism Star") ||
    /prism star/i.test(rulesText) ||
    (card.supertype === "Pokémon" &&
      (subtypes.some((s) => RULE_BOX_SUBTYPES.has(s)) ||
        /rule box|pok[eé]mon ex rule|pok[eé]mon v rule|radiant pok[eé]mon rule/i.test(rulesText)));

  const isAceSpec = subtypes.includes("ACE SPEC");
  const isBasicEnergy = card.supertype === "Energy" && subtypes.includes("Basic");

  // Pool BW em diante — desta impressão; a legalidade final considera
  // reprints: um nome vale se QUALQUER impressão for BW+ (calculado depois)
  const inPool =
    isBasicEnergy || Boolean(set.releaseDate && set.releaseDate >= GLC_POOL_START);

  return { hasRuleBox, isAceSpec, isBasicEnergy, inPool };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": "GLCHubSP/1.0 (projeto de fã)" } });
  if (!res.ok) throw new Error(`Fetch falhou (${res.status}): ${url}`);
  return (await res.json()) as T;
}

type TcgdexCard = { id: string; name: string };

/** Dicionário nome-EN (fold) → nome-PT, via join dos catálogos do TCGdex. */
async function buildPtNameMap(onProgress: (m: string) => void): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    onProgress("Baixando nomes EN/PT do TCGdex...");
    const [en, pt] = await Promise.all([
      fetchJson<TcgdexCard[]>(TCGDEX_EN_URL),
      fetchJson<TcgdexCard[]>(TCGDEX_PT_URL),
    ]);
    const enById = new Map(en.map((c) => [c.id, c.name]));
    for (const c of pt) {
      const enName = enById.get(c.id);
      if (!enName || !c.name || enName === c.name) continue;
      map.set(fold(enName), c.name);
    }
    onProgress(`Nomes PT mapeados: ${map.size}.`);
  } catch (e) {
    // sem PT o site segue funcionando só em inglês — não derruba o import
    onProgress(`Aviso: nomes PT indisponíveis (${(e as Error).message}).`);
  }
  return map;
}

async function download(url: string, dest: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "GLCHubSP/1.0 (projeto de fã)" },
  });
  if (!res.ok) throw new Error(`Download falhou (${res.status}): ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

export async function importCards(
  onProgress: (msg: string) => void = () => {},
): Promise<CardImportStats> {
  const started = Date.now();
  const workDir = join(tmpdir(), `pokemon-tcg-data-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });

  try {
    onProgress("Baixando pokemon-tcg-data (tarball do GitHub)...");
    const tarball = join(workDir, "data.tar.gz");
    await download(TARBALL_URL, tarball);

    onProgress("Extraindo...");
    execFileSync("tar", ["-xzf", tarball, "-C", workDir]);
    const rootName = readdirSync(workDir).find((n) => n.startsWith("pokemon-tcg-data"));
    if (!rootName) throw new Error("Estrutura inesperada no tarball");
    const root = resolve(workDir, rootName);

    const sets: DatasetSet[] = JSON.parse(readFileSync(join(root, "sets", "en.json"), "utf8"));
    const setById = new Map(sets.map((s) => [s.id, s]));

    const cardsDir = join(root, "cards", "en");
    const files = readdirSync(cardsDir).filter((f) => f.endsWith(".json"));

    type Row = {
      id: string;
      name: string;
      nameNormalized: string;
      namePt: string | null;
      namePtNormalized: string | null;
      supertype: string;
      subtypes: string[];
      types: string[];
      hp: number | null;
      rules: string[];
      evolvesFrom: string | null;
      regulationMark: string | null;
      legalities: object | null;
      attacks: object | null;
      setId: string;
      setName: string;
      setSeries: string | null;
      setPtcgoCode: string | null;
      setReleaseDate: string | null;
      number: string;
      rarity: string | null;
      imageSmall: string | null;
      imageLarge: string | null;
      hasRuleBox: boolean;
      isAceSpec: boolean;
      isBasicEnergy: boolean;
      glcLegal: boolean;
    };

    // imagens do Limitless e nomes PT (falhas nessas fontes não derrubam o import)
    let limitlessSmall: Record<string, string> = {};
    let limitlessLarge: Record<string, string> = {};
    try {
      onProgress("Baixando índice de imagens do Limitless...");
      [limitlessSmall, limitlessLarge] = await Promise.all([
        fetchJson<Record<string, string>>(LIMITLESS_SMALL_URL),
        fetchJson<Record<string, string>>(LIMITLESS_LARGE_URL),
      ]);
    } catch (e) {
      onProgress(`Aviso: imagens do Limitless indisponíveis (${(e as Error).message}).`);
    }
    const ptNames = await buildPtNameMap(onProgress);

    type RowDraft = Row & { inPool: boolean };
    const rows: RowDraft[] = [];
    let limitlessHits = 0;
    for (const file of files) {
      const setId = file.replace(/\.json$/, "");
      const set = setById.get(setId);
      if (!set) continue;
      const cards: DatasetCard[] = JSON.parse(readFileSync(join(cardsDir, file), "utf8"));
      for (const c of cards) {
        const flags = deriveFlags(c, set);
        const limitlessKey = set.ptcgoCode ? `${set.ptcgoCode} ${c.number}` : null;
        const imgSmall = (limitlessKey && limitlessSmall[limitlessKey]) || c.images?.small || null;
        const imgLarge = (limitlessKey && limitlessLarge[limitlessKey]) || c.images?.large || null;
        if (limitlessKey && limitlessSmall[limitlessKey]) limitlessHits++;
        const namePt = ptNames.get(fold(c.name)) ?? null;
        rows.push({
          id: c.id,
          name: c.name,
          nameNormalized: fold(c.name),
          namePt,
          namePtNormalized: namePt ? fold(namePt) : null,
          supertype: c.supertype,
          subtypes: c.subtypes ?? [],
          types: c.types ?? [],
          hp: c.hp && /^\d+$/.test(c.hp) ? Number(c.hp) : null,
          rules: c.rules ?? [],
          evolvesFrom: c.evolvesFrom ?? null,
          regulationMark: c.regulationMark ?? null,
          legalities: c.legalities ?? null,
          attacks: c.attacks ?? null,
          setId: set.id,
          setName: set.name,
          setSeries: set.series ?? null,
          setPtcgoCode: set.ptcgoCode ?? null,
          setReleaseDate: set.releaseDate ?? null,
          number: c.number,
          rarity: c.rarity ?? null,
          imageSmall: imgSmall,
          imageLarge: imgLarge,
          hasRuleBox: flags.hasRuleBox,
          isAceSpec: flags.isAceSpec,
          isBasicEnergy: flags.isBasicEnergy,
          glcLegal: false, // calculado abaixo, no nível do nome (reprints contam)
          inPool: flags.inPool,
        });
      }
    }

    // Legalidade GLC por NOME: se qualquer impressão é BW+ (reprint), todas as
    // impressões do nome valem — o jogador pode usar a arte que preferir.
    const namePool = new Set<string>();
    for (const r of rows) if (r.inPool) namePool.add(r.nameNormalized);
    for (const r of rows) {
      r.glcLegal = namePool.has(r.nameNormalized) && !r.hasRuleBox && !r.isAceSpec;
    }

    onProgress(
      `Dataset lido: ${rows.length} cartas em ${files.length} sets · imagens Limitless: ${limitlessHits}. Gravando...`,
    );

    // remove o campo auxiliar inPool antes de gravar
    const finalRows: Row[] = rows.map(({ inPool: _inPool, ...rest }) => rest);

    const existing = new Set(
      (await prisma.card.findMany({ select: { id: true } })).map((c) => c.id),
    );
    const toCreate = finalRows.filter((r) => !existing.has(r.id));
    const toUpdate = finalRows.filter((r) => existing.has(r.id));

    const CHUNK = 500;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      await prisma.card.createMany({
        data: toCreate
          .slice(i, i + CHUNK)
          .map((r) => ({ ...r, legalities: r.legalities ?? undefined, attacks: r.attacks ?? undefined })),
        skipDuplicates: true,
      });
      onProgress(`Inseridas ${Math.min(i + CHUNK, toCreate.length)}/${toCreate.length}...`);
    }

    const UP_CHUNK = 100;
    for (let i = 0; i < toUpdate.length; i += UP_CHUNK) {
      await prisma.$transaction(
        toUpdate.slice(i, i + UP_CHUNK).map((r) =>
          prisma.card.update({
            where: { id: r.id },
            data: {
              ...r,
              legalities: r.legalities ?? undefined,
              attacks: r.attacks ?? undefined,
              fetchedAt: new Date(),
            },
          }),
        ),
      );
      if (i % 2000 === 0) {
        onProgress(`Atualizadas ${Math.min(i + UP_CHUNK, toUpdate.length)}/${toUpdate.length}...`);
      }
    }

    return {
      sets: files.length,
      cards: rows.length,
      created: toCreate.length,
      updated: toUpdate.length,
      ms: Date.now() - started,
    };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
