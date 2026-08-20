import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Jogadores",
  description: "Treinadores do circuito GLC de São Paulo e suas conquistas.",
};

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";

  const players = await prisma.player.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    include: {
      badges: { where: { status: "ACTIVE" }, select: { type: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = players
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      wins: p.badges.length,
      types: new Set(p.badges.map((b) => b.type)).size,
    }))
    .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));

  return (
    <>
      <h1>Jogadores</h1>
      <p className="lead">{rows.length} treinadores registrados no circuito.</p>

      <form className="filter-bar" method="get" action="/jogadores">
        <label>
          Buscar
          <input type="text" name="q" defaultValue={q} placeholder="Nome do jogador" />
        </label>
        <button type="submit" className="secondary">
          Buscar
        </button>
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Jogador</th>
              <th className="num">Vitórias</th>
              <th className="num">Insígnias</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.slug}>
                <td>
                  <Link href={`/jogadores/${p.slug}`}>{p.name}</Link>
                </td>
                <td className="num">{p.wins}</td>
                <td className="num">{p.types}/11</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
