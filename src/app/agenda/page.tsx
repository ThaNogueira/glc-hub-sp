import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { Reveal } from "@/components/Reveal";
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
      where: { date: { gte: new Date(Date.now() - 7 * 86_400_000) }, hidden: false },
      include: { venue: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const today = todayWeekdayInSp();

  // grade semanal → cards por dia (mobile-first)
  const byDay = WEEKDAYS_PT.map((label, i) => {
    const wd = i + 1;
    const slots = activeStores
      .flatMap((s) =>
        s.slots
          .filter((x) => x.weekday === wd)
          .map((x) => ({ store: s, time: x.time })),
      )
      .sort((a, b) => (a.time ?? "zz").localeCompare(b.time ?? "zz"));
    return { wd, label, slots };
  });

  return (
    <>
      <h1>Agenda de torneios</h1>
      <p className="lead">Grade semanal do circuito — confirme horários no grupo da comunidade.</p>

      <div className="agenda-week">
        {byDay.map(({ wd, label, slots }) => (
          <div key={wd} className={`agenda-day${wd === today ? " today" : ""}`}>
            <h3>
              {label}
              {wd === today && <span className="chip accent">hoje</span>}
            </h3>
            {slots.length > 0 ? (
              slots.map(({ store, time }) => (
                <div key={store.id} className="agenda-slot">
                  <span>
                    <Link href={`/lojas/${store.slug}`}>{store.name}</Link>
                    {store.neighborhood && (
                      <span className="muted small"> · {store.neighborhood}</span>
                    )}
                  </span>
                  <span className="time">{time ?? ""}</span>
                </div>
              ))
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                sem torneios
              </p>
            )}
          </div>
        ))}
      </div>

      <h2>Torneios especiais</h2>
      {specials.length ? (
        <Reveal>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Loja</th>
                  <th>Horário</th>
                  <th>Torneio</th>
                  <th>Inscrição / premiação</th>
                </tr>
              </thead>
              <tbody>
                {specials.map((t) => (
                  <tr key={t.id}>
                    <td className="tnum">{formatBrDate(t.date)}</td>
                    <td>
                      <Link href={`/lojas/${t.venue.slug}`}>{t.venue.name}</Link>
                    </td>
                    <td>{t.time ?? "—"}</td>
                    <td>
                      {t.name || "—"}
                      {t.origin === "SITE" && (
                        <span className="chip ok" style={{ marginLeft: 6 }}>
                          publicado pela loja
                        </span>
                      )}
                    </td>
                    <td className="small muted" style={{ whiteSpace: "normal", maxWidth: 260 }}>
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
        </Reveal>
      ) : (
        <EmptyState
          title="Nenhum torneio especial agendado"
          hint="Quando as lojas publicarem torneios especiais, eles aparecem aqui junto com os da planilha."
        />
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
