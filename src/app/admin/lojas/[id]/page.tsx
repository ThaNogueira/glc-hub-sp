import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { formatBrDate } from "@/lib/normalize";
import { WEEKDAYS_PT } from "@/lib/types";
import {
  deleteTournamentAction,
  deleteVenueAction,
  resetSlotAction,
  saveTournamentAction,
  saveVenueScheduleAction,
  updateVenueDetailsAction,
} from "../../actions";

export const metadata = { title: "Admin — editar loja", robots: { index: false } };
export const dynamic = "force-dynamic";

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AdminVenueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const ok = one(sp.ok);
  const erro = one(sp.erro);

  const [venue, allVenues] = await Promise.all([
    prisma.venue.findUnique({
      where: { id },
      include: {
        slots: { orderBy: { weekday: "asc" } },
        user: { select: { email: true, displayName: true } },
        _count: { select: { badges: true } },
        tournaments: {
          where: { hidden: false },
          orderBy: { date: "desc" },
          take: 25,
        },
      },
    }),
    prisma.venue.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!venue) notFound();

  return (
    <>
      <p className="small" style={{ marginTop: "1rem" }}>
        <Link href="/admin/lojas">← Todas as lojas</Link>
      </p>
      <div className="flex-between">
        <h1>{venue.name}</h1>
        <Link href={`/lojas/${venue.slug}`} className="btn secondary small">
          Ver página pública
        </Link>
      </div>

      {ok && <p className="form-msg ok">{ok}</p>}
      {erro && <p className="form-msg err">{erro}</p>}

      {/* ---------------- dados da loja ---------------- */}
      <h2>Dados da loja</h2>
      <div className="panel">
        <form action={updateVenueDetailsAction} className="admin-entity-form">
          <input type="hidden" name="id" value={venue.id} />
          <input type="hidden" name="back" value="1" />
          <label>
            Nome
            <input type="text" name="name" defaultValue={venue.name} required maxLength={80} />
          </label>
          <label>
            Bairro
            <input
              type="text"
              name="neighborhood"
              defaultValue={venue.neighborhood ?? ""}
              maxLength={60}
            />
          </label>
          <label style={{ flex: "1 1 220px" }}>
            Endereço
            <input type="text" name="address" defaultValue={venue.address ?? ""} maxLength={160} />
          </label>
          <label>
            Tipo
            <select name="kind" defaultValue={venue.kind}>
              <option value="STORE">Loja</option>
              <option value="EVENT">Evento</option>
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={venue.status}>
              <option value="ACTIVE">Ativa</option>
              <option value="HIATUS">Hiato</option>
            </select>
          </label>
          <label
            className="flex-row small"
            style={{ flexDirection: "row", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}
            title="Com a trava ligada, o sync da planilha não sobrescreve bairro/status/tipo desta loja"
          >
            <input type="checkbox" name="manualLock" defaultChecked={venue.manualLock} />
            proteger do sync 🔒
          </label>
          <button className="small">Salvar</button>
        </form>
        <p className="small muted" style={{ margin: "0.6rem 0 0" }}>
          {venue.manualLock
            ? "🔒 Trava ativa: a planilha NÃO sobrescreve os dados desta loja."
            : "Sem trava: o sync da planilha pode atualizar bairro/status/tipo. Ao salvar com a caixa marcada, sua edição passa a valer sempre."}
        </p>
      </div>

      {/* ---------------- grade semanal ---------------- */}
      <h2>Grade semanal</h2>
      <div className="panel">
        <form action={saveVenueScheduleAction}>
          <input type="hidden" name="venueId" value={venue.id} />
          <div className="table-wrap" style={{ boxShadow: "none" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Horário (vazio = sem torneio)</th>
                  <th>Origem</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS_PT.map((day, i) => {
                  const weekday = i + 1;
                  const slot = venue.slots.find((s) => s.weekday === weekday);
                  return (
                    <tr key={day}>
                      <td>
                        <strong>{day}</strong>
                      </td>
                      <td>
                        <input
                          type="text"
                          name={`time_${weekday}`}
                          defaultValue={slot?.time ?? ""}
                          placeholder="ex.: 19h30"
                          maxLength={60}
                        />
                      </td>
                      <td>
                        {slot ? (
                          slot.manual ? (
                            <span className="chip warn" title="Editado no admin — sync não mexe">
                              🔒 manual
                            </span>
                          ) : (
                            <span className="chip">planilha</span>
                          )
                        ) : (
                          <span className="muted small">—</span>
                        )}
                      </td>
                      <td>
                        {slot?.manual && (
                          <button
                            className="secondary small"
                            formAction={resetSlotAction}
                            name="id"
                            value={slot.id}
                            title="Descarta a edição manual; o próximo sync traz o valor da planilha"
                          >
                            seguir planilha
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <button type="submit">Salvar grade</button>{" "}
            <span className="small muted">
              o que você alterar fica 🔒 manual e NÃO é sobrescrito pela planilha
            </span>
          </div>
        </form>
      </div>

      {/* ---------------- torneios ---------------- */}
      <h2>Torneios ({venue.tournaments.length})</h2>
      <div className="panel">
        <p className="small muted" style={{ marginTop: 0 }}>
          Aqui dá para corrigir data/horário/nome e <strong>trocar a loja associada</strong> de um
          torneio. Torneios editados ficam 🔒 manuais; excluídos da planilha não voltam no sync.
        </p>
        {venue.tournaments.map((t) => (
          <form
            key={t.id}
            action={saveTournamentAction}
            className="admin-entity-form"
            style={{ padding: "0.5rem 0", borderTop: "1px solid var(--border)" }}
          >
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="backVenue" value={venue.id} />
            <label>
              Data
              <input type="date" name="date" defaultValue={toInputDate(t.date)} required />
            </label>
            <label>
              Horário
              <input type="text" name="time" defaultValue={t.time ?? ""} maxLength={40} />
            </label>
            <label style={{ flex: "1 1 160px" }}>
              Nome
              <input type="text" name="name" defaultValue={t.name ?? ""} maxLength={120} />
            </label>
            <label>
              Loja associada
              <select name="venueId" defaultValue={t.venueId}>
                {allVenues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="small muted" style={{ alignSelf: "center" }}>
              {t.origin === "SHEET" ? "planilha" : "site"}
              {t.manual ? " · 🔒" : ""} · {formatBrDate(t.date)}
            </span>
            <button className="small">Salvar</button>
            <button
              className="danger small"
              formAction={deleteTournamentAction}
              title={t.origin === "SHEET" ? "Oculta (a planilha não recria)" : "Exclui"}
            >
              Excluir
            </button>
          </form>
        ))}

        <h3 style={{ marginTop: "1.25rem" }}>Novo torneio</h3>
        <form action={saveTournamentAction} className="admin-entity-form">
          <input type="hidden" name="backVenue" value={venue.id} />
          <label>
            Data
            <input type="date" name="date" required />
          </label>
          <label>
            Horário
            <input type="text" name="time" placeholder="ex.: 14h" maxLength={40} />
          </label>
          <label style={{ flex: "1 1 160px" }}>
            Nome
            <input type="text" name="name" placeholder="ex.: Especial de Natal" maxLength={120} />
          </label>
          <label>
            Loja
            <select name="venueId" defaultValue={venue.id}>
              {allVenues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <button className="small">Criar</button>
        </form>
      </div>

      {/* ---------------- conta e exclusão ---------------- */}
      <h2>Conta e exclusão</h2>
      <div className="panel">
        <div className="flex-row small" style={{ gap: "1rem", flexWrap: "wrap" }}>
          <span>
            Conta da loja:{" "}
            {venue.user ? (
              <strong>
                {venue.user.displayName} ({venue.user.email})
              </strong>
            ) : (
              <span className="muted">nenhuma</span>
            )}{" "}
            — troca em <Link href="/admin/usuarios">Usuários</Link>
          </span>
          <span className="tnum muted">{venue._count.badges} resultados registrados</span>
          <span style={{ flex: 1 }} />
          {venue._count.badges === 0 ? (
            <form action={deleteVenueAction}>
              <input type="hidden" name="id" value={venue.id} />
              <button className="danger small">Excluir loja</button>
            </form>
          ) : (
            <span className="muted small">
              🔒 tem resultados — para juntar a outra loja use o{" "}
              <Link href="/admin/aliases">merge</Link>
            </span>
          )}
        </div>
      </div>
    </>
  );
}
