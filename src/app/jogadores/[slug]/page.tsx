import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeShield } from "@/components/BadgeShield";
import { TypePill } from "@/components/TypePill";
import { prisma } from "@/lib/db";
import { formatBrDate } from "@/lib/normalize";
import { TYPES, TYPE_BY_ID } from "@/lib/types";

async function getPlayer(slug: string) {
  return prisma.player.findUnique({
    where: { slug },
    include: {
      badges: {
        where: { status: "ACTIVE" },
        include: { venue: true },
        orderBy: [{ date: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      },
      externalRefs: true,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const player = await getPlayer(slug);
  if (!player) return {};
  const types = new Set(player.badges.map((b) => b.type)).size;
  return {
    title: player.name,
    description: `${player.name} no circuito GLC SP: ${player.badges.length} vitórias, ${types}/11 insígnias.`,
    openGraph: {
      title: `${player.name} · GLC Hub SP`,
      description: `${player.badges.length} vitórias · ${types}/11 insígnias de ginásio`,
    },
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = await getPlayer(slug);
  if (!player) notFound();

  const perType = new Map<string, number>();
  for (const b of player.badges) perType.set(b.type, (perType.get(b.type) ?? 0) + 1);
  const distinct = perType.size;

  const signature =
    [...perType.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as
      | keyof typeof TYPE_BY_ID
      | undefined;

  const presencial = player.badges.filter((b) => b.modality === "PRESENCIAL").length;
  const online = player.badges.length - presencial;

  return (
    <>
      <div className="panel">
        <div className="flex-between">
          <div>
            <h1 className="mt0">{player.name}</h1>
            {signature && (
              <p className="lead">
                Tipo signature: <TypePill type={signature} />
              </p>
            )}
          </div>
          {distinct === 11 && <span className="chip ok">Coleção completa — 11 insígnias!</span>}
        </div>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-value">{player.badges.length}</div>
            <div className="stat-label">vitórias</div>
          </div>
          <div className="stat">
            <div className="stat-value">{distinct}/11</div>
            <div className="stat-label">insígnias (tipos distintos)</div>
          </div>
          <div className="stat">
            <div className="stat-value">{presencial}</div>
            <div className="stat-label">presencial</div>
          </div>
          <div className="stat">
            <div className="stat-value">{online}</div>
            <div className="stat-label">online</div>
          </div>
        </div>
      </div>

      <h2>Jornada de ginásios</h2>
      <div className="panel">
        <div className="badge-grid">
          {TYPES.map((t) => {
            const count = perType.get(t.id) ?? 0;
            return (
              <div key={t.id} className={`badge-cell${count === 0 ? " unlit" : ""}`}>
                <BadgeShield type={t.id} />
                <div>{t.pt}</div>
                <div className="count">{count > 0 ? `×${count}` : "—"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {player.externalRefs.length > 0 && (
        <>
          <h2>Decklists publicadas</h2>
          <ul>
            {player.externalRefs.map((ref) => (
              <li key={ref.id}>
                <a href={ref.url} target="_blank" rel="noopener noreferrer">
                  {ref.kind === "PLAYER_PROFILE" ? "Perfil de decks" : "Deck"} no{" "}
                  {ref.source === "CARDBOARD_WARRIOR" ? "Cardboard Warriors" : "Limitless"}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Histórico de vitórias</h2>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Data</th>
              <th>Loja / evento</th>
              <th>Tipo</th>
              <th>Modalidade</th>
            </tr>
          </thead>
          <tbody>
            {player.badges.map((b) => (
              <tr key={b.id}>
                <td>{b.date ? formatBrDate(b.date) : <span className="muted">sem data</span>}</td>
                <td>
                  <Link href={`/lojas/${b.venue.slug}`}>{b.venue.name}</Link>
                </td>
                <td>
                  <TypePill type={b.type} />
                </td>
                <td className="muted">{b.modality === "ONLINE" ? "Online" : "Presencial"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
