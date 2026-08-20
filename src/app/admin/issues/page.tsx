import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { setIssueStatusAction } from "../actions";

export const metadata = { title: "Admin — issues", robots: { index: false } };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  UNKNOWN_PLAYER: "Jogador novo",
  UNKNOWN_VENUE: "Loja/evento novo",
  UNKNOWN_TYPE: "Tipo não reconhecido",
  PARSE_WARNING: "Aviso de parse",
  ROW_REMOVED: "Linha removida da planilha",
  DUPLICATE_SUSPECT: "Suspeita de duplicata",
  RANK_MISMATCH: "Divergência de ranking",
  NEW_TAB: "Aba nova",
};

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const showAll = sp.todas === "1";

  const issues = await prisma.reconciliationIssue.findMany({
    where: showAll ? undefined : { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <>
      <h1>Divergências e conflitos</h1>
      <p className="lead">
        Tudo que o sync não resolveu sozinho: divergências entre os rankings recalculados e os da
        planilha, linhas removidas, nomes novos.{" "}
        {showAll ? (
          <Link href="/admin/issues">ver só abertas</Link>
        ) : (
          <Link href="/admin/issues?todas=1">ver todas</Link>
        )}
      </p>

      {issues.length === 0 && <p className="muted">Nenhuma issue aberta. 🎉</p>}

      {issues.map((issue) => (
        <div className="panel" key={issue.id}>
          <div className="flex-between">
            <div>
              <span className="chip">{KIND_LABEL[issue.kind] ?? issue.kind}</span>{" "}
              {issue.status !== "OPEN" && <span className="chip ok">{issue.status}</span>}
            </div>
            <span className="muted small">
              {issue.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </span>
          </div>
          <p>{issue.message}</p>
          {issue.payload != null && (
            <details>
              <summary className="muted small">payload</summary>
              <pre className="mono small" style={{ overflowX: "auto" }}>
                {JSON.stringify(issue.payload, null, 2)}
              </pre>
            </details>
          )}
          {issue.status === "OPEN" && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <form action={setIssueStatusAction}>
                <input type="hidden" name="id" value={issue.id} />
                <input type="hidden" name="status" value="RESOLVED" />
                <button className="small">Resolver</button>
              </form>
              <form action={setIssueStatusAction}>
                <input type="hidden" name="id" value={issue.id} />
                <input type="hidden" name="status" value="IGNORED" />
                <button className="secondary small">Ignorar</button>
              </form>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
