import { prisma } from "./db";

/** Defaults de configuração (editáveis no admin, persistidos em `Setting`). */
export const SETTING_DEFAULTS = {
  season2026Start: "2026-01-01",
  badgeRule:
    "Todos os jogadores que finalizarem o torneio com a mesma pontuação do primeiro colocado ganham a insígnia (votação da comunidade em 20/07/25).",
  // decoração semanal da home — troque a URL no admin toda semana
  shinyGifUrl: "https://projectpokemon.org/images/shiny-sprite/kirlia.gif",
} as const;

export async function getSetting<T>(key: keyof typeof SETTING_DEFAULTS): Promise<T | string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return (row?.value as T) ?? SETTING_DEFAULTS[key];
}

export async function setSetting(key: string, value: unknown) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
}

/** Início da temporada 2026 (fronteira do recorte "Temporada 2026" vs histórico). */
export async function getSeason2026Start(): Promise<Date> {
  const raw = (await getSetting<string>("season2026Start")) as string;
  const d = new Date(`${raw}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? new Date("2026-01-01T12:00:00Z") : d;
}

export async function getBadgeRule(): Promise<string> {
  return (await getSetting<string>("badgeRule")) as string;
}

/** GIF do Pokémon shiny da semana (decoração da home, editável no admin). */
export async function getShinyGifUrl(): Promise<string> {
  const raw = (await getSetting<string>("shinyGifUrl")) as string;
  return /^https:\/\//i.test(raw) ? raw : SETTING_DEFAULTS.shinyGifUrl;
}
