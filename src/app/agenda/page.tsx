import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatBrDate } from "@/lib/normalize";
import { WEEKDAYS_PT } from "@/lib/types";

export const metadata = {
  title: "Agenda de torneios",
  description:
    "Agenda semanal dos torneios de GLC em São Paulo — dia, loja e horário, mais torneios especiais datados.",
};

function todayWeekdayInSp(): number {
  // 1 = segunda ... 7 = domingo, no fuso de São Paulo
  const wd = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[wd] ?? 1;
}

export default async function AgendaPage() {
  const [activeStores, hiatusStores, specials] = await Promise.all([
    prisma.venue.findMany({
      where: { status: "ACTIVE", kind: "STORE", slots: { some: {} } },
      include: { slots: true },
      orderBy: { name: "asc" },
    }),
    prisma.venue.findMany({
      where: { status: "HIATUS", kind: "STORE" },
      orderBy: { name: "asc" },
    }),
    prisma.tournament.findMany({
      where: { date: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      include: { venue: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const today = todayWeekdayInSp();

  return (
    <>
      <h1>Agenda de torneios</h1>
      <p className="lead">Grade semanal do circuito — confirme horários no grupo da comunidade.</p>

      <div className="table-wrap">
        <table className="data schedule-grid">
          <thead>
            <tr>
              <th>Dia</th>
              {activeStores.map((s) => (
                <th key={s.id}>
                  <Link href={`/lojas/${s.slug}`}>{s.name}</Link>
                  {s.neighborhood && (
                    <div className="muted" style={{ textTransform: "none", fontWeight: 400 }}>
                      {s.neighborhood}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS_PT.map((day, i) => {
              const wd = i + 1;
              const isToday = wd === today;
              return (
                <tr key={day}>
                  <td className={isToday ? "today" : ""}>
                    <strong>{day}</strong>
                    {isToday && <span className="chip ok" style={{ marginLeft: 6 }}>hoje</span>}
                  </td>
                  {activeStores.map((s) => {
                    const slot = s.slots.find((x) => x.weekday === wd);
                    return (
                      <td key={s.id} className={`${isToday ? "today " : ""}${slot ? "slot" : ""}`}>
                        {slot?.time ?? <span className="muted">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Torneios especiais</h2>
      {specials.length ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Data</th>
                <th>Loja</th>
                <th>Horário</th>
                <th>Torneio</th>
              </tr>
            </thead>
            <tbody>
              {specials.map((t) => (
                <tr key={t.id}>
                  <td>{formatBrDate(t.date)}</td>
                  <td>
                    <Link href={`/lojas/${t.venue.slug}`}>{t.venue.name}</Link>
                  </td>
                  <td>{t.time ?? "—"}</td>
                  <td>{t.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Nenhum torneio especial agendado no momento.</p>
      )}

      {hiatusStores.length > 0 && (
        <>
          <h2>Lojas em hiato</h2>
          <p className="muted small">
            {hiatusStores.map((s, i) => (
              <span key={s.id}>
                {i > 0 && " · "}
                <Link href={`/lojas/${s.slug}`}>{s.name}</Link>
                {s.neighborhood ? ` (${s.neighborhood})` : ""}
              </span>
            ))}
          </p>
        </>
      )}
    </>
  );
}
