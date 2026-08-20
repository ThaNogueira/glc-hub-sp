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

  const hasRuleBox =
    card.supertype === "Pokémon" &&
    (subtypes.some((s) => RULE_BOX_SUBTYPES.has(s)) ||
      /rule box|pok[eé]mon ex rule|pok[eé]mon v rule|radiant pok[eé]mon rule|prism star/i.test(
        rulesText,
      ));

  const isAceSpec = subtypes.includes("ACE SPEC");
  const isBasicEnergy = card.supertype === "Energy" && subtypes.includes("Basic");

  // Pool BW em diante (energias básicas valem de qualquer coleção)
  const inPool =
    isBasicEnergy || Boolean(set.releaseDate && set.releaseDate >= GLC_POOL_START);

  const glcLegal = inPool && !hasRuleBox && !isAceSpec;

  return { hasRuleBox, isAceSpec, isBasicEnergy, glcLegal };
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

    const rows: Row[] = [];
    for (const file of files) {
      const setId = file.replace(/\.json$/, "");
      const set = setById.get(setId);
      if (!set) continue;
      const cards: DatasetCard[] = JSON.parse(readFileSync(join(cardsDir, file), "utf8"));
      for (const c of cards) {
        const flags = deriveFlags(c, set);
        rows.push({
          id: c.id,
          name: c.name,
          nameNormalized: fold(c.name),
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
          imageSmall: c.images?.small ?? null,
          imageLarge: c.images?.large ?? null,
          ...flags,
        });
      }
    }

    onProgress(`Dataset lido: ${rows.length} cartas em ${files.length} sets. Gravando...`);

    const existing = new Set(
      (await prisma.card.findMany({ select: { id: true } })).map((c) => c.id),
    );
    const toCreate = rows.filter((r) => !existing.has(r.id));
    const toUpdate = rows.filter((r) => existing.has(r.id));

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
