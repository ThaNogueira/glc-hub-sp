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

  const R = 92;
  const CX = 130;
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
      <motion.div
        className="metachart-donut"
        onMouseLeave={() => setHover(null)}
        initial={reduced ? false : { opacity: 0, scale: 0.92, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, ease: [0.3, 0.7, 0.3, 1] }}
      >
        <svg viewBox="0 0 260 260" role="img" aria-label="Distribuição de vitórias por tipo">
          <g transform={`rotate(-90 ${CX} ${CX})`}>
            {slices.map((s, i) => {
              const len = Math.max(0.001, s.share) * C;
              const gap = visible.length > 1 ? 3 : 0;
              const dim = hover !== null && hover !== s.type;
              return (
                <motion.circle
                  key={s.type}
                  cx={CX}
                  cy={CX}
                  r={R}
                  fill="none"
                  stroke={TYPE_BY_ID[s.type].color}
                  strokeWidth={hover === s.type ? 36 : 28}
                  strokeDasharray={`${Math.max(0, len - gap)} ${C - len + gap}`}
                  strokeDashoffset={-s.start * C}
                  initial={reduced ? false : { opacity: 0, strokeDasharray: `0 ${C}` }}
                  animate={{
                    opacity: dim ? 0.22 : 1,
                    strokeDasharray: `${Math.max(0, len - gap)} ${C - len + gap}`,
                  }}
                  transition={{
                    strokeDasharray: { duration: 0.8, delay: reduced ? 0 : 0.06 * i, ease: [0.3, 0.7, 0.3, 1] },
                    opacity: { duration: 0.15 },
                  }}
                  style={{ cursor: "pointer", transition: "stroke-width 180ms" }}
                  onMouseEnter={() => setHover(s.type)}
                  onFocus={() => setHover(s.type)}
                  tabIndex={-1}
                />
              );
            })}
          </g>

          {/* ícones dos tipos sobre as fatias (fatias muito finas ficam sem) */}
          {slices.map((s, i) => {
            if (s.share < 0.045) return null;
            const angle = (s.start + s.share / 2) * 2 * Math.PI - Math.PI / 2;
            const ix = CX + Math.cos(angle) * R;
            const iy = CX + Math.sin(angle) * R;
            const size = hover === s.type ? 24 : 19;
            return (
              <motion.image
                key={`icon-${s.type}`}
                href={typeIconSrc(s.type, 24)}
                x={ix - size / 2}
                y={iy - size / 2}
                width={size}
                height={size}
                style={{ pointerEvents: "none" }}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: hover !== null && hover !== s.type ? 0.25 : 1 }}
                transition={{ duration: 0.2, delay: reduced ? 0 : 0.5 + 0.05 * i }}
              />
            );
          })}

          <text
            x={CX}
            y={CX - 6}
            textAnchor="middle"
            fill="var(--text)"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 40 }}
          >
            {hovered ? hovered.count : total}
          </text>
          <text x={CX} y={CX + 20} textAnchor="middle" fill="var(--muted)" style={{ fontSize: 14 }}>
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
      </motion.div>

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
                  animate={{ scaleX: 1 }}
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
