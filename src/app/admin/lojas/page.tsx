import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Admin — lojas e eventos", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminVenuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const ok = one(sp.ok);
  const erro = one(sp.erro);

  const venues = await prisma.venue.findMany({
    include: {
      _count: { select: { badges: true, tournaments: true, slots: true } },
      user: { select: { email: true } },
    },
    orderBy: [{ kind: "asc" }, { status: "asc" }, { name: "asc" }],
  });

  const stores = venues.filter((v) => v.kind === "STORE");
  const events = venues.filter((v) => v.kind === "EVENT");

  const card = (v: (typeof venues)[number]) => (
    <Link key={v.id} href={`/admin/lojas/${v.id}`} className="hover-card admin-card">
      <div className="flex-between">
        <h3 style={{ margin: 0 }}>{v.name}</h3>
        <span className="flex-row" style={{ gap: "0.3rem" }}>
          {v.manualLock && (
            <span title="Protegida do sync — edições manuais valem" aria-label="travada">
              🔒
            </span>
          )}
          {v.kind === "STORE" &&
            (v.status === "ACTIVE" ? (
              <span className="chip ok">ativa</span>
            ) : (
              <span className="chip warn">hiato</span>
            ))}
        </span>
      </div>
      <p className="small muted" style={{ margin: "0.3rem 0 0" }}>
        {v.neighborhood ?? (v.kind === "EVENT" ? "evento" : "—")}
      </p>
      <p className="small muted" style={{ margin: "0.45rem 0 0" }}>
        <span className="tnum">{v._count.badges}</span> resultados ·{" "}
        <span className="tnum">{v._count.slots}</span> dias na grade ·{" "}
        <span className="tnum">{v._count.tournaments}</span> torneios
        {v.user ? ` · conta: ${v.user.email}` : ""}
      </p>
      <p className="small" style={{ margin: "0.5rem 0 0", color: "var(--link)" }}>
        Editar dados, horários e torneios →
      </p>
    </Link>
  );

  return (
    <>
      <h1>Lojas e eventos</h1>
      <p className="lead">
        Clique numa loja para editar tudo dela: dados, grade de horários e torneios. Edições
        manuais ficam travadas (🔒) e <strong>não são sobrescritas</strong> pelo sync da planilha.
      </p>

      {ok && <p className="form-msg ok">{ok}</p>}
      {erro && <p className="form-msg err">{erro}</p>}

      <div className="admin-grid">{stores.map(card)}</div>

      {events.length > 0 && (
        <>
          <h2>Eventos</h2>
          <div className="admin-grid">{events.map(card)}</div>
        </>
      )}
    </>
  );
}
