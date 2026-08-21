import Link from "next/link";
import type { PokemonType } from "@prisma/client";
import { TypeIcon } from "./TypeIcon";
import { TYPE_BY_ID, WEEKDAYS_PT } from "@/lib/types";

export type StoreCardData = {
  slug: string;
  name: string;
  neighborhood: string | null;
  kind: "STORE" | "EVENT";
  status: "ACTIVE" | "HIATUS";
  badgeCount: number;
  slots: { weekday: number; time: string | null }[];
  topType: PokemonType | null;
  topTypeWins: number;
};

/** Carteirinha de loja: status, grade semanal, insígnias e tipo mais forte. */
export function StoreCard({ store }: { store: StoreCardData }) {
  const top = store.topType ? TYPE_BY_ID[store.topType] : null;
  return (
    <Link href={`/lojas/${store.slug}`} className="hover-card store-card">
      <div className="flex-between" style={{ alignItems: "flex-start" }}>
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
      {top && (
        <p
          className="small store-top-type"
          style={{ ["--tt-color" as string]: `var(${top.cssVar})` }}
          title={`Tipo com mais vitórias na loja: ${top.pt} (${store.topTypeWins})`}
        >
          <TypeIcon type={top.id} size={15} />
          tipo mais forte: <strong>{top.pt}</strong>
          <span className="muted tnum">×{store.topTypeWins}</span>
        </p>
      )}
    </Link>
  );
}
