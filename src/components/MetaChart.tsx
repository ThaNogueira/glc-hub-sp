"use client";

import { useState } from "react";
import Link from "next/link";
import type { PokemonType } from "@prisma/client";
import { motion, useReducedMotion } from "motion/react";
import { TYPE_BY_ID, typeIconSrc } from "@/lib/types";

export type MetaChartRow = {
  type: PokemonType;
  count: number;
  share: number; // 0..1
  delta: number | null; // vitórias últimos 60 dias − 60 dias anteriores (null = sem datas)
  topPlayer: { name: string; slug: string; wins: number } | null;
};

/** Donut + barras do meta share, com hover que destaca o tipo e esmaece o resto. */
export function MetaChart({ rows, total }: { rows: MetaChartRow[]; total: number }) {
  const [hover, setHover] = useState<PokemonType | null>(null);
  const reduced = useReducedMotion();

  const R = 74;
  const C = 2 * Math.PI * R;
  const visible = rows.filter((r) => r.count > 0);

  let acc = 0;
  const slices = visible.map((r) => {
    const start = acc;
    acc += r.share;
    return { ...r, start };
  });

  const hovered = hover ? rows.find((r) => r.type === hover) : null;
  const maxCount = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="metachart">
      <div className="metachart-donut" onMouseLeave={() => setHover(null)}>
        <svg viewBox="0 0 200 200" role="img" aria-label="Distribuição de vitórias por tipo">
          <g transform="rotate(-90 100 100)">
            {slices.map((s, i) => {
              const len = Math.max(0.001, s.share) * C;
              const gap = visible.length > 1 ? 2.5 : 0;
              const dim = hover !== null && hover !== s.type;
              return (
                <motion.circle
                  key={s.type}
                  cx="100"
                  cy="100"
                  r={R}
                  fill="none"
                  stroke={TYPE_BY_ID[s.type].color}
                  strokeWidth={hover === s.type ? 26 : 20}
                  strokeDasharray={`${Math.max(0, len - gap)} ${C - len + gap}`}
                  strokeDashoffset={-s.start * C}
                  initial={reduced ? false : { opacity: 0, strokeDasharray: `0 ${C}` }}
                  animate={{
                    opacity: dim ? 0.25 : 1,
                    strokeDasharray: `${Math.max(0, len - gap)} ${C - len + gap}`,
                  }}
                  transition={{
                    strokeDasharray: { duration: 0.7, delay: reduced ? 0 : 0.05 * i, ease: [0.3, 0.7, 0.3, 1] },
                    opacity: { duration: 0.15 },
                    strokeWidth: { duration: 0.15 },
                  }}
                  style={{ cursor: "pointer", strokeWidth: hover === s.type ? 26 : 20, transition: "stroke-width 150ms" }}
                  onMouseEnter={() => setHover(s.type)}
                  onFocus={() => setHover(s.type)}
                  tabIndex={-1}
                />
              );
            })}
          </g>
          <text
            x="100"
            y="94"
            textAnchor="middle"
            fill="var(--text)"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 30 }}
          >
            {hovered ? hovered.count : total}
          </text>
          <text x="100" y="114" textAnchor="middle" fill="var(--muted)" style={{ fontSize: 11 }}>
            {hovered ? TYPE_BY_ID[hovered.type].pt : "vitórias"}
          </text>
        </svg>

        {hovered && (
          <div className="metachart-tip" role="status">
            <div className="flex-row" style={{ gap: "0.4rem" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={typeIconSrc(hovered.type, 18)} width={18} height={18} alt="" />
              <strong>{TYPE_BY_ID[hovered.type].pt}</strong>
              <span className="muted">{(hovered.share * 100).toFixed(1)}%</span>
            </div>
            <div className="small">
              {hovered.count} vitória{hovered.count === 1 ? "" : "s"}
              {hovered.delta !== null && (
                <span
                  style={{
                    color: hovered.delta > 0 ? "var(--ok)" : hovered.delta < 0 ? "var(--err)" : "var(--muted)",
                    marginLeft: 6,
                  }}
                >
                  {hovered.delta > 0 ? `▲ +${hovered.delta}` : hovered.delta < 0 ? `▼ ${hovered.delta}` : "· estável"}{" "}
                  <span className="muted">vs 60d anteriores</span>
                </span>
              )}
            </div>
            {hovered.topPlayer && (
              <div className="small muted">
                Líder: {hovered.topPlayer.name} ({hovered.topPlayer.wins})
              </div>
            )}
          </div>
        )}
      </div>

      <div className="metachart-bars" onMouseLeave={() => setHover(null)}>
        {rows.map((r, i) => {
          const t = TYPE_BY_ID[r.type];
          const dim = hover !== null && hover !== r.type;
          return (
            <div
              key={r.type}
              className="metabar-row"
              style={{ opacity: dim ? 0.35 : 1 }}
              onMouseEnter={() => setHover(r.type)}
            >
              <span className="metabar-label">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={typeIconSrc(r.type, 16)} width={16} height={16} alt="" loading="lazy" />
                {t.pt}
              </span>
              <div className="bar-track">
                <motion.div
                  className="bar-fill"
                  style={{
                    background: t.color,
                    width: `${(r.count / maxCount) * 100}%`,
                    transformOrigin: "left center",
                  }}
                  initial={reduced ? false : { scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: reduced ? 0 : 0.04 * i, ease: [0.3, 0.7, 0.3, 1] }}
                />
              </div>
              <span className="metabar-num tnum">{r.count}</span>
              <span className="metabar-share tnum muted">{(r.share * 100).toFixed(1)}%</span>
              {r.topPlayer ? (
                <span className="metabar-top">
                  <Link href={`/jogadores/${r.topPlayer.slug}`}>{r.topPlayer.name}</Link>{" "}
                  <span className="muted">({r.topPlayer.wins})</span>
                </span>
              ) : (
                <span className="metabar-top muted">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
