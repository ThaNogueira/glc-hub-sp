import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { getSetting, SETTING_DEFAULTS } from "@/lib/settings";
import { importCardsAction, logoutAction, syncNowAction, updateSettingsAction } from "./actions";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();

  const [
    runs,
    openIssues,
    badgeCount,
    season,
    badgeRule,
    shinyGifUrl,
    pendingClaims,
    pendingStores,
    cardCount,
  ] = await Promise.all([
    prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
    prisma.reconciliationIssue.count({ where: { status: "OPEN" } }),
    prisma.badgeWin.count({ where: { status: "ACTIVE" } }),
    getSetting<string>("season2026Start"),
    getSetting<string>("badgeRule"),
    getSetting<string>("shinyGifUrl"),
    prisma.profileClaim.count({ where: { status: "PENDING" } }),
    prisma.storeRequest.count({ where: { status: "PENDING" } }),
    prisma.card.count(),
  ]);

  return (
    <>
      <div className="flex-between">
        <h1>Painel admin</h1>
        <form action={logoutAction}>
          <button className="secondary small">Sair</button>
        </form>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-value">{badgeCount}</div>
          <div className="stat-label">insígnias no banco</div>
        </div>
        <div className="stat">
          <div className="stat-value">{openIssues}</div>
          <div className="stat-label">
            <Link href="/admin/issues">issues abertas</Link>
          </div>
        </div>
        <div className="stat">
          <div className="stat-value">{pendingClaims + pendingStores}</div>
          <div className="stat-label">
            <Link href="/admin/contas">contas pendentes</Link>
          </div>
        </div>
        <div className="stat">
          <div className="stat-value">{cardCount}</div>
          <div className="stat-label">cartas na base</div>
        </div>
      </div>

      <p>
        <Link href="/admin/issues">Divergências e conflitos</Link> ·{" "}
        <Link href="/admin/aliases">Jogadores, lojas e aliases</Link> ·{" "}
        <Link href="/admin/lojas">Editar lojas/eventos</Link> ·{" "}
        <Link href="/admin/usuarios">Usuários</Link> ·{" "}
        <Link href="/admin/tabs">Abas da planilha</Link> ·{" "}
        <Link href="/admin/contas">Contas e banlist</Link>
      </p>

      <h2>Sincronização</h2>
      <div className="flex-row">
        <form action={syncNowAction}>
          <button type="submit">Sincronizar planilha</button>{" "}
          <span className="muted small">
            (baixa a planilha, importa os logs e roda a reconciliação — pode levar ~1 min)
          </span>
        </form>
      </div>
      <div className="flex-row" style={{ marginTop: "0.5rem" }}>
        <form action={importCardsAction}>
          <button type="submit" className="secondary">
            Atualizar base de cartas
          </button>{" "}
          <span className="muted small">
            (baixa o pokemon-tcg-data e importa novos sets — pode levar alguns minutos)
          </span>
        </form>
      </div>

      <div className="table-wrap" style={{ marginTop: "1rem" }}>
        <table className="data">
          <thead>
            <tr>
              <th>Início</th>
              <th>Duração</th>
              <th>Gatilho</th>
              <th>Status</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{r.startedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                <td className="num">
                  {r.finishedAt
                    ? `${Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000)}s`
                    : "…"}
                </td>
                <td>{r.trigger}</td>
                <td>
                  {r.ok === null ? (
                    <span className="chip">rodando</span>
                  ) : r.ok ? (
                    <span className="chip ok">ok</span>
                  ) : (
                    <span className="chip warn">erro</span>
                  )}
                </td>
                <td className="mono small" style={{ whiteSpace: "normal", maxWidth: 420 }}>
                  {r.error ?? (r.stats ? JSON.stringify(r.stats).slice(0, 220) : "")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Configurações</h2>
      <form action={updateSettingsAction} className="panel" style={{ display: "grid", gap: "0.75rem", maxWidth: 640 }}>
        <label style={{ display: "grid", gap: "0.2rem" }}>
          <span className="small muted">
            Início da temporada 2026 (fronteira do recorte "Temporada 2026")
          </span>
          <input type="date" name="season2026Start" defaultValue={String(season)} />
        </label>
        <label style={{ display: "grid", gap: "0.2rem" }}>
          <span className="small muted">
            Regra de insígnia vigente (texto exibido no site; muda por votação da comunidade)
          </span>
          <textarea name="badgeRule" rows={3} defaultValue={String(badgeRule)} />
        </label>
        <label style={{ display: "grid", gap: "0.2rem" }}>
          <span className="small muted">
            Shiny da semana — URL do GIF que decora a home (ex.:
            https://projectpokemon.org/images/shiny-sprite/kirlia.gif)
          </span>
          <input type="url" name="shinyGifUrl" defaultValue={String(shinyGifUrl)} />
        </label>
        <div>
          <button type="submit">Salvar</button>{" "}
          <span className="muted small">padrão: {SETTING_DEFAULTS.season2026Start}</span>
        </div>
      </form>
    </>
  );
}
