import Link from "next/link";
import { WEEKDAYS_PT } from "@/lib/types";

export type StoreCardData = {
  slug: string;
  name: string;
  neighborhood: string | null;
  kind: "STORE" | "EVENT";
  status: "ACTIVE" | "HIATUS";
  badgeCount: number;
  slots: { weekday: number; time: string | null }[];
};

/** Carteirinha de loja: status, grade semanal e insígnias entregues. */
export function StoreCard({ store }: { store: StoreCardData }) {
  return (
    <Link href={`/lojas/${store.slug}`} className="hover-card store-card">
      <div className="flex-between" style={{ alignItems: "start" }}>
        <div>
          <h3>{store.name}</h3>
          <span className="small muted">
            {store.kind === "EVENT" ? "Evento" : (store.neighborhood ?? "São Paulo")}
          </span>
        </div>
        {store.kind === "STORE" &&
          (store.status === "ACTIVE" ? (
            <span className="chip ok">ativa</span>
          ) : (
            <span className="chip warn">em hiato</span>
          ))}
      </div>
      {store.slots.length > 0 && (
        <p className="small" style={{ margin: "0.5rem 0 0" }}>
          {store.slots
            .map((s) => `${WEEKDAYS_PT[s.weekday - 1]}${s.time ? ` ${s.time}` : ""}`)
            .join(" · ")}
        </p>
      )}
      <p className="small muted" style={{ margin: "0.45rem 0 0" }}>
        <strong className="tnum" style={{ color: "var(--text)" }}>
          {store.badgeCount}
        </strong>{" "}
        insígnias entregues
      </p>
    </Link>
  );
}
