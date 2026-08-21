import { fold } from "./normalize";

/**
 * Banlist oficial do Gym Leader Challenge (gymleaderchallenge.com/ban-list).
 *
 * Vários bans valem só para uma impressão específica (ex.: só o Oranguru do
 * Ultra Prism é banido — o do Guardians Rising continua legal), por isso cada
 * entrada lista os `ids` exatos banidos; `ids: null` = todas as impressões
 * do nome. As explicações em PT resumem o racional publicado pelo comitê.
 *
 * A tabela BanlistEntry do banco (admin) continua existindo para bans extras
 * da comunidade — esses valem para o nome inteiro.
 */

export type BanEntry = {
  /** Nome EN exato da carta. */
  name: string;
  /** Impressões banidas (ids pokemontcg.io); null = todas as impressões. */
  ids: string[] | null;
  /** Id da impressão usada como imagem na página da banlist. */
  displayId: string;
  /** Rótulo do set/número, como no site oficial. */
  printLabel: string;
  /** Data em que o ban entrou em vigor (DD/MM/AAAA). */
  bannedAt: string;
  /** Por que foi banida, em português. */
  reasonPt: string;
};

export const BANLIST_OFICIAL: BanEntry[] = [
  {
    name: "Lysandre's Trump Card",
    ids: null,
    displayId: "xy4-99",
    printLabel: "XY Phantom Forces 99/119",
    bannedAt: "16/11/2021",
    reasonPt:
      "Embaralha o descarte dos DOIS jogadores de volta nos decks — recursos nunca acabam, loops viram infinitos e partidas de controle simplesmente não terminam. É tão problemática que a própria Pokémon a baniu de todos os formatos oficiais; o GLC apenas seguiu.",
  },
  {
    name: "Oranguru",
    ids: ["sm5-114"],
    displayId: "sm5-114",
    printLabel: "SM Ultra Prism 114/156",
    bannedAt: "16/11/2021",
    reasonPt:
      "O ataque Resource Management devolve 3 cartas do descarte para o fundo do deck por uma energia qualquer. Em decks de controle/mill isso vira um motor de recursos infinitos: o jogo nunca acaba por deck out e as partidas se arrastam sem contra-jogo. Só esta impressão é banida — o Oranguru de Guardians Rising (Instruct) continua legal.",
  },
  {
    name: "Forest of Giant Plants",
    ids: null,
    displayId: "xy7-74",
    printLabel: "XY Ancient Origins 74/98",
    bannedAt: "10/01/2022",
    reasonPt:
      "Permite que Pokémon de Planta evoluam no MESMO turno em que entram em jogo. Decks de Planta abriam com Vileplume/Shiftry no primeiro turno e travavam o oponente (bloqueio de itens e afins) antes de ele fazer qualquer jogada — jogo decidido no turno 1.",
  },
  {
    name: "Chip-Chip Ice Axe",
    ids: null,
    displayId: "sm10-165",
    printLabel: "SM Unbroken Bonds 165/214",
    bannedAt: "08/06/2022",
    reasonPt:
      "Item que olha o topo do deck do oponente e ESCOLHE o que ele vai comprar. Junto com Hiker e cartas de descarte de mão, formava o pacote de trava que controlava todas as compras do adversário, turno após turno, sem chance de reação. O formato singleton não tem respostas suficientes contra isso.",
  },
  {
    name: "Hiker",
    ids: ["sm7-133", "sma-SV85"],
    displayId: "sm7-133",
    printLabel: "SM Celestial Storm 133/168 · Hidden Fates SV85/SV94",
    bannedAt: "08/06/2022",
    reasonPt:
      "A outra metade do pacote de controle de compra: olha as 5 cartas do topo de qualquer deck e decide o que fica. Com Chip-Chip Ice Axe, os decks de trava ditavam cada carta que o oponente compraria — banidas juntas pelo mesmo motivo.",
  },
  {
    name: "Kyogre",
    ids: ["swsh45-21"],
    displayId: "swsh45-21",
    printLabel: "Shining Fates 021/072",
    bannedAt: "11/11/2022",
    reasonPt:
      "Amazing Surge causa 80 de dano em TODOS os Pokémon do oponente. Com a aceleração de energia dos decks de Água, virava uma varredura de banco que fechava o jogo de uma vez no late game — sem aviso e sem contra-jogo. Só esta impressão (Amazing Rare) é banida.",
  },
  {
    name: "Pokémon Research Lab",
    ids: null,
    displayId: "sm11-205",
    printLabel: "SM Unified Minds 205/236",
    bannedAt: "01/11/2023",
    reasonPt:
      "Estádio que busca no deck até 2 evoluções de Unidentified Fossil e as joga direto no banco, todo turno, de graça. Decks de fósseis enchiam o campo sem custo e alimentavam estratégias de trava/mill com consistência que nenhum outro motor do formato tinha.",
  },
  {
    name: "Raikou",
    ids: ["swsh4-50"],
    displayId: "swsh4-50",
    printLabel: "SWSH Vivid Voltage 050/185",
    bannedAt: "01/09/2024",
    reasonPt:
      "Amazing Shot atira 120 de dano direto num Pokémon do banco — o suficiente para nocautear quase qualquer atacante em formação do formato antes de ele jogar. Decks de Elétrico eliminavam a linha de evolução do oponente repetidamente. Só a impressão Amazing Rare é banida.",
  },
  {
    name: "Marshadow",
    ids: ["sm35-45", "smp-SM85"],
    displayId: "sm35-45",
    printLabel: "Shining Legends 45/73 · Promo SM85",
    bannedAt: "01/09/2024",
    reasonPt:
      "A habilidade Let Loose embaralha a mão do oponente e o deixa com apenas 4 cartas — no primeiro turno, combinada com mais descarte de mão, deixava o adversário sem recursos antes de jogar. Peça central dos decks de trava e de starts injustos. As demais impressões de Marshadow continuam legais.",
  },
  {
    name: "Duskull",
    ids: ["sm12-83"],
    displayId: "sm12-83",
    printLabel: "SM Cosmic Eclipse 83/236",
    bannedAt: "01/09/2024",
    reasonPt:
      "Coração do 'donk' psíquico: com Ominous Eyes (2 contadores de dano por 1 energia) e as ferramentas de dano extra do formato, conseguia nocautear os básicos frágeis do oponente logo no primeiro turno — vitórias antes de o adversário fazer a primeira jogada. Só esta impressão é banida.",
  },
  {
    name: "Double Colorless Energy",
    ids: null,
    displayId: "sm35-69",
    printLabel: "todas as impressões",
    bannedAt: "24/04/2025",
    reasonPt:
      "Duas energias em uma carta, sem custo nem condição, em qualquer deck. Acelerava demais os atacantes pesados (principalmente os Incolores) e estava em praticamente todas as listas — o comitê baniu para devolver o ritmo e a diversidade que definem o GLC.",
  },
  {
    name: "Twin Energy",
    ids: null,
    displayId: "swsh2-174",
    printLabel: "SWSH Rebel Clash 174/192",
    bannedAt: "24/04/2025",
    reasonPt:
      "Irmã da Double Colorless: fornece 2 energias incolores para qualquer Pokémon sem Rule Box — ou seja, para TODO Pokémon do GLC. Banida junto com a DCE pelo mesmo motivo: aceleração universal barata demais, que uniformizava os decks.",
  },
  {
    name: "Dimension Valley",
    ids: null,
    displayId: "xy4-93",
    printLabel: "XY Phantom Forces 93/119",
    bannedAt: "20/04/2026",
    reasonPt:
      "Estádio que reduz em 1 incolor o custo de TODOS os ataques psíquicos. Decks de Psíquico atacavam praticamente de graça (vários atacantes ficavam com custo zero), criando um ritmo que nenhum outro tipo conseguia acompanhar.",
  },
];

/** Matcher de ban: nome (fold) → ids banidos (null = todas as impressões). */
export type BanMatcher = Map<string, Set<string> | null>;

export function buildOfficialMatcher(): BanMatcher {
  const m: BanMatcher = new Map();
  for (const e of BANLIST_OFICIAL) m.set(fold(e.name), e.ids ? new Set(e.ids) : null);
  return m;
}

export function isCardBanned(
  matcher: BanMatcher,
  card: { name: string; id: string },
): boolean {
  const entry = matcher.get(fold(card.name));
  if (entry === undefined) return false;
  return entry === null || entry.has(card.id);
}
