import Link from "next/link";
import { redirect } from "next/navigation";
import { PlayerAutocomplete } from "@/components/PlayerAutocomplete";
import { TypeBadge } from "@/components/TypeBadge";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatBrDate } from "@/lib/normalize";
import { TYPES } from "@/lib/types";
import {
  createTournamentAction,
  deleteResultAction,
  deleteTournamentAction,
  postResultAction,
} from "./actions";

export const metadata = { title: "Painel da loja", robots: { index: false } };

export default async function StorePanelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("STORE", "ADMIN");
  if (!user.venueId || !user.venue) redirect("/conta");
  const sp = await searchParams;
  const erro = typeof sp.erro === "string" ? sp.erro : null;
  const ok = typeof sp.ok === "string" ? sp.ok : null;

  const [tournaments, results] = await Promise.all([
    prisma.tournament.findMany({
      where: { venueId: user.venueId, date: { gte: new Date(Date.now() - 86_400_000) } },
      orderBy: { date: "asc" },
    }),
    prisma.badgeWin.findMany({
      where: { venueId: user.venueId, origin: "SITE" },
      include: { player: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <>
      <h1>Painel da loja</h1>
      <p className="lead">
        <Link href={`/lojas/${user.venue.slug}`}>
          <strong>{user.venue.name}</strong>
        </Link>{" "}
        — publique torneios na agenda e registre resultados pós-evento.
      </p>

      {erro && <p className="form-msg err">{erro}</p>}
      {ok && <p className="form-msg ok">{ok}</p>}

      <div className="grid-2">
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Publicar torneio</h2>
          <form action={createTournamentAction} className="form-grid">
            <div className="flex-row">
              <label className="field">
                Data
                <input type="date" name="date" required />
              </label>
              <label className="field">
                Horário
                <input type="text" name="time" placeholder="ex.: 19h30" />
              </label>
            </div>
            <label className="field">
              Nome do torneio (opcional)
              <input type="text" name="name" placeholder="ex.: GLC Mensal" />
            </label>
            <div className="flex-row">
              <label className="field">
                Valor
                <input type="text" name="priceInfo" placeholder="ex.: R$ 20" />
              </label>
              <label className="field">
                Premiação
                <input type="text" name="prizeInfo" placeholder="ex.: vale-loja + insígnia" />
              </label>
            </div>
            <label className="field">
              Link de inscrição (opcional)
              <input type="url" name="registrationUrl" placeholder="https://..." />
            </label>
            <label className="field">
              Descrição (opcional)
              <textarea name="description" rows={2} maxLength={1000} />
            </label>
            <div>
              <button type="submit">Publicar na agenda</button>
            </div>
          </form>
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Registrar resultado</h2>
          <p className="muted small">
            O resultado alimenta o meta, os rankings e as insígnias do jogador imediatamente. Se a
            planilha registrar o mesmo resultado depois, o sistema detecta a duplicata para
            revisão.
          </p>
          <form action={postResultAction} className="form-grid">
            <label className="field">
              Data do torneio
              <input type="date" name="date" required />
            </label>
            <label className="field">
              Vencedor
              <PlayerAutocomplete name="playerName" />
            </label>
            <label className="field">
              Tipo do deck vencedor
              <select name="type" required defaultValue="">
                <option value="" disabled>
                  — selecione
                </option>
                {TYPES.map((t) => (
                  <option key={t.id} value={t.pt}>
                    {t.pt}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button type="submit">Registrar insígnia</button>
            </div>
          </form>
        </section>
      </div>

      <h2>Torneios publicados</h2>
      {tournaments.length === 0 ? (
        <p className="muted">Nenhum torneio futuro publicado.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Data</th>
                <th>Horário</th>
                <th>Nome</th>
                <th>Origem</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t) => (
                <tr key={t.id}>
                  <td className="tnum">{formatBrDate(t.date)}</td>
                  <td>{t.time ?? "—"}</td>
                  <td>{t.name ?? "—"}</td>
                  <td>
                    {t.origin === "SITE" ? (
                      <span className="chip ok">site</span>
                    ) : (
                      <span className="chip">planilha</span>
                    )}
                  </td>
                  <td>
                    {t.origin === "SITE" && (
                      <form action={deleteTournamentAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="ghost small">remover</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Resultados registrados pelo site</h2>
      {results.length === 0 ? (
        <p className="muted">Nenhum resultado registrado pela loja ainda.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Data</th>
                <th>Vencedor</th>
                <th>Tipo</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.map((b) => (
                <tr key={b.id}>
                  <td className="tnum">{b.date ? formatBrDate(b.date) : "—"}</td>
                  <td>
                    <Link href={`/jogadores/${b.player.slug}`}>{b.player.name}</Link>
                  </td>
                  <td>
                    <TypeBadge type={b.type} />
                  </td>
                  <td>
                    {b.status === "ACTIVE" ? (
                      <span className="chip ok">ativo</span>
                    ) : (
                      <span className="chip warn">em revisão</span>
                    )}
                  </td>
                  <td>
                    <form action={deleteResultAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="ghost small">remover</button>
                    </form>
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
