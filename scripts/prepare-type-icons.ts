/**
 * Prepara os ícones dos 11 tipos a partir de /tipos (PNGs 20×20 fornecidos
 * manualmente, origem: Bulbagarden Archives) para /public/icons/types/:
 *   {TYPE}.png     — original 20×20, para usos pequenos (≤ 22px)
 *   {TYPE}-lg.png  — upscale 128×128 (lanczos3 + sharpen), para insígnias,
 *                    OG images e ícones grandes sem ficar embaçado.
 *   npx tsx scripts/prepare-type-icons.ts
 */
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

// nome do arquivo em /tipos → id do enum PokemonType
const SOURCES: Record<string, string> = {
  grass: "GRASS",
  water: "WATER",
  fire: "FIRE",
  lightning: "LIGHTNING",
  colorless: "COLORLESS",
  fight: "FIGHTING",
  psy: "PSYCHIC",
  dragon: "DRAGON",
  dark: "DARKNESS",
  metal: "METAL",
  fairy: "FAIRY",
};

const LG_SIZE = 128;

async function main() {
  const srcDir = resolve(process.cwd(), "tipos");
  const outDir = resolve(process.cwd(), "public/icons/types");
  mkdirSync(outDir, { recursive: true });

  for (const [file, typeId] of Object.entries(SOURCES)) {
    const src = resolve(srcDir, `${file}.png`);
    if (!existsSync(src)) throw new Error(`Arquivo não encontrado: ${src}`);

    // original, sem tocar
    await sharp(src).png().toFile(resolve(outDir, `${typeId}.png`));

    // upscale: lanczos3 preserva bordas melhor que o bilinear padrão;
    // um sharpen leve devolve a definição perdida na interpolação.
    await sharp(src)
      .resize(LG_SIZE, LG_SIZE, { kernel: sharp.kernel.lanczos3 })
      .sharpen({ sigma: 1.2, m1: 0.5, m2: 0.5 })
      .png()
      .toFile(resolve(outDir, `${typeId}-lg.png`));

    console.log(`${typeId}: 20px + ${LG_SIZE}px`);
  }
  console.log(`Ícones prontos em public/icons/types/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
