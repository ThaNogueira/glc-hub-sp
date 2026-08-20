import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fold } from "@/lib/normalize";
import { claimProfileAction } from "../actions";

export const metadata = { title: "Reivindicar perfil", robots: { index: false } };

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (user.playerId) redirect("/conta");

  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const erro = typeof sp.erro === "string" ? sp.erro : null;

  const players = q
    ? await prisma.player.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { aliases: { some: { normalized: { contains: fold(q) } } } },
          ],
        },
        include: {
          user: { select: { id: true } },
          _count: { select: { badges: { where: { status: "ACTIVE" } } } },
        },
        orderBy: { name: "asc" },
        take: 20,
      })
    : [];

  return (
    <>
      <h1>Reivindicar perfil</h1>
      <p className="lead">
        Busque seu nome como aparece na planilha (aba &quot;Lista Jogadores&quot;). O admin aprova o
        vínculo e o seu histórico de insígnias passa a aparecer na sua conta.
      </p>
      {erro && <p className="form-msg err">{erro}</p>}

      <form className="filter-bar" method="get" action="/conta/reivindicar">
        <label>
          Seu nome na planilha
          <input type="search" name="q" defaultValue={q} placeholder="ex.: João Victor" required />
        </label>
        <button type="submit" className="secondary">
          Buscar
        </button>
      </form>

      {q && players.length === 0 && (
        <p className="muted">
          Nenhum jogador encontrado com &quot;{q}&quot;. Se você é novo no circuito, seu perfil é
          criado automaticamente na primeira vitória registrada.
        </p>
      )}

      {players.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Jogador</th>
                <th className="num">Vitórias</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/jogadores/${p.slug}`}>{p.name}</Link>
                  </td>
                  <td className="num">{p._count.badges}</td>
                  <td>
                    {p.user ? (
                      <span className="chip">já reivindicado</span>
                    ) : (
                      <form action={claimProfileAction} className="flex-row" style={{ gap: "0.4rem" }}>
                        <input type="hidden" name="playerId" value={p.id} />
                        <input
                          type="text"
                          name="note"
                          placeholder="observação p/ o admin (opcional)"
                          style={{ maxWidth: 220 }}
                        />
                        <button type="submit" className="small">
                          É meu perfil
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
