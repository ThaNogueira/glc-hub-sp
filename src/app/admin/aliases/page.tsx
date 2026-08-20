import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import {
  addPlayerAliasAction,
  mergePlayersAction,
  mergeVenuesAction,
  updateVenueAction,
} from "../actions";

export const metadata = { title: "Admin — aliases", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AliasesPage() {
  await requireAdmin();

  const [players, venues] = await Promise.all([
    prisma.player.findMany({
      include: { aliases: true, _count: { select: { badges: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.venue.findMany({
      include: { aliases: true, _count: { select: { badges: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <h1>Jogadores, lojas e aliases</h1>
      <p className="lead">
        Nomes variam entre abas da planilha ("João Victor Soares" vs "JV Soares"). Aliases mapeiam
        variações para o nome canônico; o merge junta registros duplicados.
      </p>

      <h2>Adicionar alias de jogador</h2>
      <form action={addPlayerAliasAction} className="filter-bar">
        <label>
          Alias (como aparece na planilha)
          <input type="text" name="alias" required />
        </label>
        <label>
          Jogador canônico
          <select name="playerId" required>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Adicionar</button>
      </form>

      <h2>Mesclar jogadores duplicados</h2>
      <form action={mergePlayersAction} className="filter-bar">
        <label>
          Duplicado (será apagado)
          <select name="fromId" required>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p._count.badges})
              </option>
            ))}
          </select>
        </label>
        <label>
          Canônico (recebe tudo)
          <select name="toId" required>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p._count.badges})
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Mesclar</button>
      </form>

      <h2>Jogadores ({players.length})</h2>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Nome canônico</th>
              <th className="num">Insígnias</th>
              <th>Aliases</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="num">{p._count.badges}</td>
                <td className="muted" style={{ whiteSpace: "normal" }}>
                  {p.aliases.map((a) => a.alias).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Mesclar lojas/eventos</h2>
      <form action={mergeVenuesAction} className="filter-bar">
        <label>
          Duplicado (será apagado)
          <select name="fromId" required>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v._count.badges})
              </option>
            ))}
          </select>
        </label>
        <label>
          Canônico (recebe tudo)
          <select name="toId" required>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v._count.badges})
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Mesclar</button>
      </form>

      <h2>Lojas e eventos ({venues.length})</h2>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Nome</th>
              <th className="num">Insígnias</th>
              <th>Aliases</th>
              <th>Classificação</th>
            </tr>
          </thead>
          <tbody>
            {venues.map((v) => (
              <tr key={v.id}>
                <td>
                  {v.name}
                  {v.neighborhood ? ` (${v.neighborhood})` : ""}
                </td>
                <td className="num">{v._count.badges}</td>
                <td className="muted" style={{ whiteSpace: "normal" }}>
                  {v.aliases.map((a) => a.alias).join(", ")}
                </td>
                <td>
                  <form action={updateVenueAction} style={{ display: "flex", gap: 4 }}>
                    <input type="hidden" name="id" value={v.id} />
                    <select name="kind" defaultValue={v.kind}>
                      <option value="STORE">Loja</option>
                      <option value="EVENT">Evento</option>
                    </select>
                    <select name="status" defaultValue={v.status}>
                      <option value="ACTIVE">Ativa</option>
                      <option value="HIATUS">Hiato</option>
                    </select>
                    <button className="secondary small">Salvar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
