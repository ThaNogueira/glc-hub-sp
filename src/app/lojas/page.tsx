import { StoreCard } from "@/components/StoreCard";
import { Reveal } from "@/components/Reveal";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Lojas e eventos",
  description: "As lojas e eventos do circuito GLC de São Paulo.",
};

export default async function StoresPage() {
  const [venues, typeCounts] = await Promise.all([
    prisma.venue.findMany({
      include: {
        _count: { select: { badges: { where: { status: "ACTIVE" } } } },
        slots: true,
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.badgeWin.groupBy({
      by: ["venueId", "type"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
    }),
  ]);

  // tipo com mais vitórias em cada loja
  const topByVenue = new Map<string, { type: (typeof typeCounts)[number]["type"]; wins: number }>();
  for (const tc of typeCounts) {
    const cur = topByVenue.get(tc.venueId);
    if (!cur || tc._count._all > cur.wins) {
      topByVenue.set(tc.venueId, { type: tc.type, wins: tc._count._all });
    }
  }

  const stores = venues.filter((v) => v.kind === "STORE");
  const events = venues.filter((v) => v.kind === "EVENT");

  return (
    <>
      <h1>Lojas e eventos</h1>
      <p className="lead">O circuito GLC de São Paulo, loja a loja.</p>

      <div className="store-grid">
        {stores.map((v, i) => (
          <Reveal key={v.id} delay={Math.min(i * 0.03, 0.3)}>
            <StoreCard
              store={{
                slug: v.slug,
                name: v.name,
                neighborhood: v.neighborhood,
                kind: v.kind,
                status: v.status,
                badgeCount: v._count.badges,
                slots: v.slots.map((s) => ({ weekday: s.weekday, time: s.time })),
                topType: topByVenue.get(v.id)?.type ?? null,
                topTypeWins: topByVenue.get(v.id)?.wins ?? 0,
              }}
            />
          </Reveal>
        ))}
      </div>

      {events.length > 0 && (
        <>
          <h2>Eventos</h2>
          <div className="store-grid">
            {events.map((v) => (
              <StoreCard
                key={v.id}
                store={{
                  slug: v.slug,
                  name: v.name,
                  neighborhood: v.neighborhood,
                  kind: v.kind,
                  status: v.status,
                  badgeCount: v._count.badges,
                  slots: [],
                  topType: topByVenue.get(v.id)?.type ?? null,
                  topTypeWins: topByVenue.get(v.id)?.wins ?? 0,
                }}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
