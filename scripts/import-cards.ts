/**
 * Importa/atualiza a base local de cartas a partir do repositório
 * PokemonTCG/pokemon-tcg-data. Idempotente — rode quando quiser (novos sets).
 *   npm run cards:import
 */
import { loadDotEnv } from "../src/lib/env";
loadDotEnv();

async function main() {
  const { importCards } = await import("../src/lib/cards/import");
  const stats = await importCards((msg) => console.log(msg));
  console.log(
    `Import concluído: ${stats.cards} cartas (${stats.created} novas, ${stats.updated} atualizadas) em ${Math.round(stats.ms / 1000)}s.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
