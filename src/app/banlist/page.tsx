import { BanlistGallery, type BanItem } from "@/components/BanlistGallery";
import { BANLIST_OFICIAL } from "@/lib/banlistOficial";
import { findByName } from "@/lib/cards/search";
import { prisma } from "@/lib/db";
import { fold } from "@/lib/normalize";

export const metadata = {
  title: "Banlist",
  description:
    "Todas as cartas banidas no Gym Leader Challenge, com a explicação de cada ban em português.",
};

function parseBr(d: string): number {
  const [dd, mm, yyyy] = d.split("/").map(Number);
  return new Date(yyyy, (mm ?? 1) - 1, dd ?? 1).getTime();
}

export default async function BanlistPage() {
  // cartas de exibição da lista oficial
  const displayIds = BANLIST_OFICIAL.map((e) => e.displayId);
  const cards = await prisma.card.findMany({ where: { id: { in: displayIds } } });
  const cardById = new Map(cards.map((c) => [c.id, c]));

  const officialNames = new Set(BANLIST_OFICIAL.map((e) => fold(e.name)));

  const items: BanItem[] = BANLIST_OFICIAL.map((e) => {
    const card = cardById.get(e.displayId);
    return {
      name: e.name,
      namePt: card?.namePt ?? null,
      imageSmall: card?.imageSmall ?? null,
      imageLarge: card?.imageLarge ?? card?.imageSmall ?? null,
      printLabel: e.printLabel,
      onlySpecificPrint: e.ids !== null,
      bannedAt: e.bannedAt,
      reasonPt: e.reasonPt,
    };
  }).sort((a, b) => parseBr(b.bannedAt) - parseBr(a.bannedAt));

  // bans extras adicionados pelo admin (valem para o nome inteiro)
  const extras = await prisma.banlistEntry.findMany({ orderBy: { createdAt: "desc" } });
  for (const b of extras) {
    if (officialNames.has(fold(b.cardName))) continue;
    const card = await findByName(b.cardName);
    items.push({
      name: b.cardName,
      namePt: card?.namePt ?? null,
      imageSmall: card?.imageSmall ?? null,
      imageLarge: card?.imageLarge ?? card?.imageSmall ?? null,
      printLabel: "todas as impressões",
      onlySpecificPrint: false,
      bannedAt: b.createdAt.toLocaleDateString("pt-BR"),
      reasonPt:
        b.reason ??
        "Banida no circuito de São Paulo por decisão da comunidade/organização local.",
    });
  }

  return (
    <>
      <h1>Banlist do GLC</h1>
      <p className="lead">
        {items.length} cartas banidas no Gym Leader Challenge. Clique numa carta para ver a arte
        em tamanho grande e entender por que ela foi banida. Fonte:{" "}
        <a
          href="https://gymleaderchallenge.com/ban-list"
          target="_blank"
          rel="noopener noreferrer"
        >
          gymleaderchallenge.com/ban-list
        </a>
        .
      </p>

      <BanlistGallery items={items} />

      <div className="panel" style={{ marginTop: "1.5rem" }}>
        <p className="small muted" style={{ margin: 0 }}>
          Alguns bans valem só para uma impressão específica (marcados no detalhe) — as outras
          versões da mesma carta continuam legais. Além dos bans, o GLC não permite cartas com
          Rule Box (ex, V, GX, VMAX, VSTAR, Radiant, Estrela Prisma...) nem ACE SPEC; essas nem
          aparecem na busca do <a href="/decks/novo">deck builder</a>. A banlist é viva e pode
          mudar — o site reflete a lista vigente.
        </p>
      </div>
    </>
  );
}
