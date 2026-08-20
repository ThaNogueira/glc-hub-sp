import { StoreCard } from "@/components/StoreCard";
import { Reveal } from "@/components/Reveal";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Lojas e eventos",
  description: "As lojas e eventos do circuito GLC de São Paulo.",
};

export default async function StoresPage() {
  const venues = await prisma.venue.findMany({
    include: {
      _count: { select: { badges: { where: { status: "ACTIVE" } } } },
      slots: true,
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

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
                }}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
