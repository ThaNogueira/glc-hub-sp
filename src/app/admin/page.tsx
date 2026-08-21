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
    userCount,
    venueCount,
    playerCount,
    deckCount,
  ] = await Promise.all([
    prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 8 }),
    prisma.reconciliationIssue.count({ where: { status: "OPEN" } }),
    prisma.badgeWin.count({ where: { status: "ACTIVE" } }),
    getSetting<string>("season2026Start"),
    getSetting<string>("badgeRule"),
    getSetting<string>("shinyGifUrl"),
    prisma.profileClaim.count({ where: { status: "PENDING" } }),
    prisma.storeRequest.count({ where: { status: "PENDING" } }),
    prisma.card.count(),
    prisma.user.count(),
    prisma.venue.count(),
    prisma.player.count(),
    prisma.deck.count({ where: { isPublic: true } }),
  ]);

  const pendingAccounts = pendingClaims + pendingStores;

  const sections = [
    {
      href: "/admin/contas",
      icon: "📥",
      title: "Pendências",
      desc: "Aprovar reivindicações de perfil e pedidos de conta de loja; banlist extra.",
      badge: pendingAccounts,
    },
    {
      href: "/admin/usuarios",
      icon: "👤",
      title: "Usuários",
      desc: "Papel de cada conta e vínculos: qual jogador, qual loja. Excluir contas.",
      badge: 0,
    },
    {
      href: "/admin/lojas",
      icon: "🏪",
      title: "Lojas & eventos",
      desc: "Editar nome, bairro, endereço, tipo e status; excluir duplicatas sem resultados.",
      badge: 0,
    },
    {
      href: "/admin/aliases",
      icon: "✏️",
      title: "Jogadores & aliases",
      desc: "Renomear e excluir jogadores, mapear grafias da planilha, mesclar duplicados.",
      badge: 0,
    },
    {
      href: "/admin/issues",
      icon: "⚠️",
      title: "Issues do sync",
      desc: "Divergências e conflitos detectados na sincronização com a planilha.",
      badge: openIssues,
    },
    {
      href: "/admin/tabs",
      icon: "📋",
      title: "Abas da planilha",
      desc: "Classificar as abas descobertas (log, ranking, programação, ignorar...).",
      badge: 0,
    },
  ];

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
          <div className="stat-value tnum">{badgeCount}</div>
          <div className="stat-label">insígnias</div>
        </div>
        <div className="stat">
          <div className="stat-value tnum">{playerCount}</div>
          <div className="stat-label">jogadores</div>
        </div>
        <div className="stat">
          <div className="stat-value tnum">{venueCount}</div>
          <div className="stat-label">lojas/eventos</div>
        </div>
        <div className="stat">
          <div className="stat-value tnum">{userCount}</div>
          <div className="stat-label">contas</div>
        </div>
        <div className="stat">
          <div className="stat-value tnum">{deckCount}</div>
          <div className="stat-label">decks públicos</div>
        </div>
        <div className="stat">
          <div className="stat-value tnum">{cardCount}</div>
          <div className="stat-label">cartas na base</div>
        </div>
      </div>

      <h2>Gestão</h2>
      <div className="admin-grid">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="hover-card admin-card">
            <div className="flex-between">
              <span className="admin-card-icon" aria-hidden="true">
                {s.icon}
              </span>
              {s.badge > 0 && <span className="admin-badge tnum">{s.badge}</span>}
            </div>
            <h3>{s.title}</h3>
            <p className="small muted">{s.desc}</p>
          </Link>
        ))}
      </div>

      <h2>Dados</h2>
      <div className="panel">
        <div className="flex-row" style={{ gap: "1.5rem", flexWrap: "wrap" }}>
          <form action={syncNowAction}>
            <button type="submit">Sincronizar planilha</button>
            <div className="muted small" style={{ marginTop: "0.3rem" }}>
              baixa a planilha, importa os logs e reconcilia (~1 min)
            </div>
          </form>
          <form action={importCardsAction}>
            <button type="submit" className="secondary">
              Atualizar base de cartas
            </button>
            <div className="muted small" style={{ marginTop: "0.3rem" }}>
              pokemon-tcg-data + imagens Limitless + nomes PT (alguns minutos)
            </div>
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
      </div>

      <h2>Configurações do site</h2>
      <form
        action={updateSettingsAction}
        className="panel"
        style={{ display: "grid", gap: "0.75rem", maxWidth: 640 }}
      >
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
