import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TYPES } from "@/lib/types";
import { TypeBadge } from "@/components/TypeBadge";
import { DeckCard } from "@/components/DeckCard";
import {
  changePasswordAction,
  logoutAction,
  requestStoreAction,
  resendVerificationAction,
  updateProfileAction,
} from "./actions";

export const metadata = { title: "Minha conta", robots: { index: false } };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const erro = typeof sp.erro === "string" ? sp.erro : null;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const bemvindo = sp.bemvindo === "1";

  const [claims, storeRequests, decks] = await Promise.all([
    prisma.profileClaim.findMany({
      where: { userId: user.id },
      include: { player: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.storeRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.deck.findMany({
      where: { authorUserId: user.id },
      include: { coverCard: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <>
      <div className="flex-between">
        <h1>Minha conta</h1>
        <form action={logoutAction}>
          <button className="ghost small">Sair</button>
        </form>
      </div>

      {bemvindo && (
        <p className="form-msg ok">
          Bem-vindo à liga, {user.displayName}! Enviamos um e-mail de confirmação — verifique sua
          caixa de entrada.
        </p>
      )}
      {erro && <p className="form-msg err">{erro}</p>}
      {ok && <p className="form-msg ok">{ok}</p>}

      {!user.emailVerifiedAt && (
        <div className="panel" style={{ borderColor: "color-mix(in srgb, var(--warn) 45%, transparent)" }}>
          <div className="flex-between">
            <span>
              <strong>E-mail não verificado.</strong>{" "}
              <span className="muted">Confirme {user.email} para liberar todos os recursos.</span>
            </span>
            <form action={resendVerificationAction}>
              <button className="secondary small">Reenviar e-mail</button>
            </form>
          </div>
        </div>
      )}

      <div className="grid-2">
        <section className="panel">
          <h2 className="mt0" style={{ marginTop: 0 }}>
            Perfil
          </h2>
          <form action={updateProfileAction} className="form-grid">
            <label className="field">
              Nome de exibição
              <input type="text" name="displayName" defaultValue={user.displayName} required minLength={2} maxLength={40} />
            </label>
            <label className="field">
              Avatar (URL https)
              <input type="url" name="avatarUrl" defaultValue={user.avatarUrl ?? ""} placeholder="https://..." />
            </label>
            <label className="field">
              Tipo favorito (acento de cor do seu perfil)
              <select name="favoriteType" defaultValue={user.favoriteType ?? ""}>
                <option value="">— automático (tipo com mais vitórias)</option>
                {TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.pt}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button type="submit">Salvar</button>
            </div>
          </form>
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Senha</h2>
          <form action={changePasswordAction} className="form-grid">
            <label className="field">
              Senha atual
              <input type="password" name="current" required autoComplete="current-password" />
            </label>
            <label className="field">
              Nova senha (mín. 8 caracteres)
              <input type="password" name="password" required minLength={8} autoComplete="new-password" />
            </label>
            <div>
              <button type="submit" className="secondary">
                Alterar senha
              </button>
            </div>
          </form>
        </section>
      </div>

      <h2>Perfil de jogador</h2>
      <div className="panel">
        {user.player ? (
          <p>
            Sua conta está vinculada ao perfil{" "}
            <Link href={`/jogadores/${user.player.slug}`}>
              <strong>{user.player.name}</strong>
            </Link>{" "}
            — histórico e insígnias aparecem lá. <TypeBadge type={user.favoriteType ?? "COLORLESS"} iconOnly />
          </p>
        ) : claims.some((c) => c.status === "PENDING") ? (
          <p className="muted">
            Pedido de vínculo com{" "}
            <strong>{claims.find((c) => c.status === "PENDING")?.player.name}</strong> aguardando
            aprovação do admin.
          </p>
        ) : (
          <p>
            Você já joga no circuito? <Link href="/conta/reivindicar">Reivindique seu perfil</Link>{" "}
            para juntar seu histórico de insígnias à sua conta.
          </p>
        )}
      </div>

      <h2>Meus decks</h2>
      {decks.length > 0 ? (
        <div className="deck-gallery">
          {decks.map((d) => (
            <DeckCard
              key={d.id}
              deck={{
                slug: d.slug,
                title: d.isPublic ? d.title : `${d.title} (rascunho)`,
                type: d.type,
                isChampion: d.isChampion,
                coverImage: d.coverCard?.imageSmall ?? null,
                authorName: null,
                updatedAt: d.updatedAt.toISOString(),
                views: d.views,
              }}
            />
          ))}
        </div>
      ) : (
        <p className="muted">
          Nenhum deck ainda — <Link href="/decks/novo">monte seu primeiro deck GLC</Link>.
        </p>
      )}
      <p style={{ marginTop: "0.75rem" }}>
        <Link href="/decks/novo" className="btn">
          + Novo deck
        </Link>
      </p>

      {user.role !== "STORE" && (
        <>
          <h2>Conta de loja</h2>
          <div className="panel">
            {storeRequests.some((r) => r.status === "PENDING") ? (
              <p className="muted">
                Solicitação de conta de loja para{" "}
                <strong>{storeRequests.find((r) => r.status === "PENDING")?.venueName}</strong>{" "}
                aguardando aprovação.
              </p>
            ) : (
              <>
                <p className="muted small">
                  Você organiza torneios GLC em uma loja? Solicite uma conta de loja para publicar
                  torneios na agenda e subir resultados.
                </p>
                <form action={requestStoreAction} className="form-grid">
                  <label className="field">
                    Nome da loja
                    <input type="text" name="venueName" required minLength={2} />
                  </label>
                  <label className="field">
                    Mensagem (como te encontramos, contato etc.)
                    <textarea name="message" rows={2} maxLength={500} />
                  </label>
                  <div>
                    <button type="submit" className="secondary">
                      Solicitar conta de loja
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </>
      )}

      {user.role === "STORE" && user.venue && (
        <>
          <h2>Minha loja</h2>
          <div className="panel">
            <p>
              Conta de loja vinculada a{" "}
              <Link href={`/lojas/${user.venue.slug}`}>
                <strong>{user.venue.name}</strong>
              </Link>
              . <Link href="/loja">Abrir painel da loja →</Link>
            </p>
          </div>
        </>
      )}
    </>
  );
}
