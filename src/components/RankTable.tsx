"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PokemonType } from "@prisma/client";
import { motion, useReducedMotion } from "motion/react";
import { TYPES, TYPE_BY_ID, typeIconSrc } from "@/lib/types";

export type RankTableRow = {
  player: { id: string; name: string; slug: string };
  wins: number;
  badges: number;
  signature: PokemonType | null;
  perType: Partial<Record<PokemonType, number>>;
};

type SortKey = "vitorias" | "insignias";

/**
 * Ranking com top 3 em destaque (carteirinhas com glow do tipo signature)
 * e reordenação animada ao trocar o critério.
 */
export function RankTable({ rows, initialSort }: { rows: RankTableRow[]; initialSort: SortKey }) {
  const [sort, setSort] = useState<SortKey>(initialSort);
  const reduced = useReducedMotion();

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) =>
      sort === "insignias"
        ? b.badges - a.badges || b.wins - a.wins || a.player.name.localeCompare(b.player.name)
        : b.wins - a.wins || b.badges - a.badges || a.player.name.localeCompare(b.player.name),
    );
    return arr;
  }, [rows, sort]);

  const top3 = sorted.slice(0, 3);
  const medals = ["gold", "silver", "bronze"] as const;

  return (
    <div>
      <div className="flex-row" style={{ margin: "0.75rem 0" }} role="group" aria-label="Ordenação">
        <button
          type="button"
          className={sort === "vitorias" ? "small" : "secondary small"}
          onClick={() => setSort("vitorias")}
          aria-pressed={sort === "vitorias"}
        >
          Por vitórias
        </button>
        <button
          type="button"
          className={sort === "insignias" ? "small" : "secondary small"}
          onClick={() => setSort("insignias")}
          aria-pressed={sort === "insignias"}
        >
          Por insígnias
        </button>
      </div>

      {top3.length > 0 && (
        <div className="podium">
          {top3.map((r, i) => {
            const sig = r.signature ? TYPE_BY_ID[r.signature] : null;
            return (
              <motion.div key={r.player.id} layout={!reduced} transition={{ duration: 0.35 }}>
                <Link
                  href={`/jogadores/${r.player.slug}`}
                  className="hover-card podium-card"
                  style={{ ["--card-glow" as string]: sig ? `var(${sig.cssVar})` : undefined }}
                >
                  <span className={`medal ${medals[i]}`}>{i + 1}</span>
                  <div className="podium-body">
                    <strong>{r.player.name}</strong>
                    <span className="small muted">
                      {r.wins} vitória{r.wins === 1 ? "" : "s"} · {r.badges}/11 insígnias
                    </span>
                  </div>
                  {sig && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={typeIconSrc(sig.id, 26)} width={26} height={26} alt={sig.pt} title={`Tipo signature: ${sig.pt}`} />
                  )}
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="table-wrap" style={{ marginTop: "0.9rem" }}>
        <table className="data">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Jogador</th>
              <th className="num">Vitórias</th>
              <th className="num">Insígnias</th>
              {TYPES.map((t) => (
                <th key={t.id} className="num" title={t.pt}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={typeIconSrc(t.id, 15)} width={15} height={15} alt={t.pt} loading="lazy" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <motion.tr key={r.player.id} layout={!reduced} transition={{ duration: 0.3 }}>
                <td className="num muted">{i + 1}</td>
                <td>
                  <Link href={`/jogadores/${r.player.slug}`}>{r.player.name}</Link>
                </td>
                <td className="num">
                  <strong>{r.wins}</strong>
                </td>
                <td className="num">
                  <strong>{r.badges}</strong>
                  <span className="muted">/11</span>
                </td>
                {TYPES.map((t) => {
                  const c = r.perType[t.id] ?? 0;
                  return (
                    <td key={t.id} className={`num${c === 0 ? " dim" : ""}`}>
                      {c}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
