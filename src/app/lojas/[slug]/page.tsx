import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TypePill } from "@/components/TypePill";
import { prisma } from "@/lib/db";
import { getRankings } from "@/lib/queries";
import { formatBrDate } from "@/lib/normalize";
import { WEEKDAYS_PT } from "@/lib/types";

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

  const [ranking, recent] = await Promise.all([
    getRankings({ venue: venue.slug }),
    prisma.badgeWin.findMany({
      where: { venueId: venue.id, status: "ACTIVE" },
      include: { player: true },
      orderBy: [{ date: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 30,
    }),
  ]);

  return (
    <>
      <div className="panel">
        <div className="flex-between">
          <div>
            <h1 className="mt0">{venue.name}</h1>
            <p className="lead">
              {venue.kind === "EVENT" ? "Evento" : venue.neighborhood ?? "São Paulo"}
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
          <p>
            <strong>Endereço:</strong> {venue.address}
          </p>
        )}

        {venue.slots.length > 0 && (
          <p>
            <strong>Torneio semanal:</strong>{" "}
            {venue.slots
              .map((s) => `${WEEKDAYS_PT[s.weekday - 1]} ${s.time ?? ""}`.trim())
              .join(" · ")}
          </p>
        )}

        {venue.tournaments.length > 0 && (
          <p>
            <strong>Próximos torneios especiais:</strong>{" "}
            {venue.tournaments
              .map((t) => `${formatBrDate(t.date)}${t.name ? ` — ${t.name}` : ""}`)
              .join(" · ")}
          </p>
        )}
      </div>

      <h2>Ranking da loja</h2>
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

      <h2>Resultados recentes</h2>
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
                <td>{b.date ? formatBrDate(b.date) : <span className="muted">sem data</span>}</td>
                <td>
                  <Link href={`/jogadores/${b.player.slug}`}>{b.player.name}</Link>
                </td>
                <td>
                  <TypePill type={b.type} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
