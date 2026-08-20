import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { updateTabKindAction } from "../actions";

export const metadata = { title: "Admin — abas", robots: { index: false } };
export const dynamic = "force-dynamic";

const KINDS = [
  ["LOG_PRESENCIAL", "Log presencial"],
  ["LOG_ONLINE", "Log online"],
  ["RANK", "Rank (só validação)"],
  ["SCHEDULE", "Programação"],
  ["RULES", "Regras"],
  ["PLAYERS", "Lista de jogadores"],
  ["DECKLISTS", "Decklists"],
  ["IGNORE", "Ignorar"],
  ["UNCLASSIFIED", "Não classificada"],
] as const;

export default async function TabsPage() {
  await requireAdmin();
  const tabs = await prisma.sheetTab.findMany({ orderBy: { title: "asc" } });

  return (
    <>
      <h1>Abas da planilha</h1>
      <p className="lead">
        Abas descobertas dinamicamente a cada sync. Novas abas chegam como "não classificada" —
        defina aqui como cada uma deve ser tratada.
      </p>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Aba</th>
              <th>Vista pela última vez</th>
              <th>"Última atualização" (planilha)</th>
              <th>Classificação</th>
            </tr>
          </thead>
          <tbody>
            {tabs.map((t) => (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td className="muted">
                  {t.lastSeenAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </td>
                <td className="muted">{t.lastUpdatedNote ?? "—"}</td>
                <td>
                  <form action={updateTabKindAction} style={{ display: "flex", gap: 4 }}>
                    <input type="hidden" name="id" value={t.id} />
                    <select name="kind" defaultValue={t.kind}>
                      {KINDS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
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
