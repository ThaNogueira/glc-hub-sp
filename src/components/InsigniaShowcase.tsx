"use client";

import { useState } from "react";
import type { PokemonType } from "@prisma/client";
import { motion, useReducedMotion } from "motion/react";
import { TYPES, TYPE_BY_ID } from "@/lib/types";
import { BadgeShield } from "./BadgeShield";

export type InsigniaInfo = {
  type: PokemonType;
  count: number;
  /** primeira conquista: "DD/MM/YYYY" (ou null p/ histórico sem data) */
  firstDate: string | null;
  firstVenue: string | null;
};

/**
 * A coleção de insígnias do perfil — o momento "uau": conquistadas brilham
 * ao entrar na viewport pela primeira vez; não conquistadas ficam em
 * silhueta; tooltip com data e loja da primeira conquista.
 */
export function InsigniaShowcase({ items }: { items: InsigniaInfo[] }) {
  const reduced = useReducedMotion();
  const [shined, setShined] = useState<Set<PokemonType>>(new Set());
  const byType = new Map(items.map((i) => [i.type, i]));
  const earned = items.filter((i) => i.count > 0).length;

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: "0.75rem" }}>
        <strong className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>
          {earned}/11 insígnias
        </strong>
        {earned === 11 && <span className="chip ok">Coleção completa!</span>}
      </div>
      <div className="progress-track" style={{ marginBottom: "1.1rem" }}>
        <div className="progress-fill" style={{ width: `${(earned / 11) * 100}%` }} />
      </div>

      <div className="badge-grid">
        {TYPES.map((t, i) => {
          const info = byType.get(t.id);
          const count = info?.count ?? 0;
          const lit = count > 0;
          const tip = lit
            ? `${t.pt} ×${count}${
                info?.firstDate
                  ? `\nconquistada em ${info.firstDate}${info.firstVenue ? ` · ${info.firstVenue}` : ""}`
                  : info?.firstVenue
                    ? `\nconquistada na ${info.firstVenue}`
                    : ""
              }`
            : `${t.pt} — ainda não conquistada`;
          return (
            <motion.div
              key={t.id}
              className={`badge-cell${lit ? " lit" : " unlit"}${shined.has(t.id) ? " shine" : ""}`}
              style={{ ["--badge-color" as string]: TYPE_BY_ID[t.id].color }}
              initial={reduced ? false : { opacity: 0, scale: 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.3, delay: reduced ? 0 : i * 0.045 }}
              onViewportEnter={() => {
                if (lit && !reduced) {
                  setShined((prev) => (prev.has(t.id) ? prev : new Set(prev).add(t.id)));
                }
              }}
            >
              <span className="badge-art" data-tip={tip} tabIndex={0}>
                <BadgeShield type={t.id} size={62} />
              </span>
              <div>{t.pt}</div>
              <div className="count">{lit ? `×${count}` : "—"}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
