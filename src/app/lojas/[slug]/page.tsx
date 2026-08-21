import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TypeBadge } from "@/components/TypeBadge";
import { TypeIcon } from "@/components/TypeIcon";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { getRankings } from "@/lib/queries";
import { formatBrDate } from "@/lib/normalize";
import { TYPE_BY_ID, WEEKDAYS_PT } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const venue = await prisma.venue.findUnique({ where: { slug } });
  if (!venue) return {};
  return {
    title: venue.name,
    description: `${venue.name}${venue.neighborhood ? ` (${venue.neighborhood})` : ""} no circuito GLC SP — horários, resultados e ranking interno.`,
  };
}

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = await prisma.venue.findUnique({
    where: { slug },
    include: {
      slots: { orderBy: { weekday: "asc" } },
      tournaments: { where: { date: { gte: new Date() } }, orderBy: { date: "asc" } },
    },
  });
  if (!venue) notFound();

  const [ranking, recent, typeCounts] = await Promise.all([
    getRankings({ venue: venue.slug }),
    prisma.badgeWin.findMany({
      where: { venueId: venue.id, status: "ACTIVE" },
      include: { player: true },
      orderBy: [{ date: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 30,
    }),
    prisma.badgeWin.groupBy({
      by: ["type"],
      where: { venueId: venue.id, status: "ACTIVE" },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 1,
    }),
  ]);

  const topType = typeCounts[0] ? TYPE_BY_ID[typeCounts[0].type] : null;

  return (
    <>
      <div className="player-hero">
        <div className="flex-between">
          <div>
            <h1>{venue.name}</h1>
            <p className="lead" style={{ margin: "0.2rem 0 0" }}>
              {venue.kind === "EVENT" ? "Evento" : (venue.neighborhood ?? "São Paulo")}
            </p>
          </div>
          {venue.kind === "STORE" &&
            (venue.status === "ACTIVE" ? (
              <span className="chip ok">ativa</span>
            ) : (
              <span className="chip warn">em hiato</span>
            ))}
        </div>

        {venue.address && (
          <p style={{ marginBottom: 0 }}>
            <strong>Endereço:</strong> {venue.address}
          </p>
        )}

        {venue.slots.length > 0 && (
          <p style={{ marginBottom: 0 }}>
            <strong>Torneio semanal:</strong>{" "}
            {venue.slots
              .map((s) => `${WEEKDAYS_PT[s.weekday - 1]} ${s.time ?? ""}`.trim())
              .join(" · ")}
          </p>
        )}

        {topType && (
          <p
            className="store-top-type"
            style={{ marginBottom: 0, ["--tt-color" as string]: `var(${topType.cssVar})` }}
          >
            <TypeIcon type={topType.id} size={18} />
            <strong>Tipo mais forte da loja:</strong> {topType.pt}{" "}
            <span className="muted tnum">({typeCounts[0]._count._all} vitórias)</span>
          </p>
        )}
      </div>

      {venue.tournaments.length > 0 && (
        <>
          <h2>Próximos torneios</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Horário</th>
                  <th>Torneio</th>
                  <th>Inscrição / premiação</th>
                </tr>
              </thead>
              <tbody>
                {venue.tournaments.map((t) => (
                  <tr key={t.id}>
                    <td className="tnum">{formatBrDate(t.date)}</td>
                    <td>{t.time ?? "—"}</td>
                    <td>{t.name ?? "Torneio GLC"}</td>
                    <td className="small muted" style={{ whiteSpace: "normal", maxWidth: 280 }}>
                      {[t.priceInfo, t.prizeInfo].filter(Boolean).join(" · ") || "—"}
                      {t.registrationUrl && (
                        <>
                          {" · "}
                          <a href={t.registrationUrl} target="_blank" rel="noopener noreferrer">
                            inscrição
                          </a>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Ranking da loja</h2>
      {ranking.length > 0 ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Jogador</th>
                <th className="num">Vitórias</th>
                <th className="num">Insígnias</th>
              </tr>
            </thead>
            <tbody>
              {ranking.slice(0, 20).map((r, i) => (
                <tr key={r.player.id}>
                  <td className="num muted">{i + 1}</td>
                  <td>
                    <Link href={`/jogadores/${r.player.slug}`}>{r.player.name}</Link>
                  </td>
                  <td className="num">{r.wins}</td>
                  <td className="num">{r.badges}/11</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Sem resultados por aqui ainda" />
      )}

      <h2>Resultados recentes</h2>
      {recent.length > 0 ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Data</th>
                <th>Vencedor</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((b) => (
                <tr key={b.id}>
                  <td className="tnum">
                    {b.date ? formatBrDate(b.date) : <span className="muted">sem data</span>}
                  </td>
                  <td>
                    <Link href={`/jogadores/${b.player.slug}`}>{b.player.name}</Link>
                  </td>
                  <td>
                    <TypeBadge type={b.type} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="A liga está vazia hoje" hint="Nenhum resultado registrado ainda." />
      )}
    </>
  );
}
