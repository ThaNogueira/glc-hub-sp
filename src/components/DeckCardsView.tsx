"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { TYPES, typeIconSrc } from "@/lib/types";

export type CardView = {
  id: string;
  name: string;
  namePt: string | null;
  imageSmall: string | null;
  imageLarge: string | null;
  setName: string;
  setPtcgoCode: string | null;
  number: string;
  rarity: string | null;
  supertype: string;
  subtypes: string[];
  types: string[];
  hp: number | null;
  attacks: { name: string; cost?: string[]; damage?: string; text?: string }[] | null;
  rules: string[];
};

export type DeckViewItem = {
  rawName: string;
  quantity: number;
  card: CardView | null;
};

export type DeckViewGroup = {
  key: string;
  label: string;
  items: DeckViewItem[];
};

const SUPERTYPE_PT: Record<string, string> = {
  "Pokémon": "Pokémon",
  Trainer: "Treinador",
  Energy: "Energia",
};

function iconForEnType(en: string): string | null {
  const t = TYPES.find((x) => x.en === en);
  return t ? typeIconSrc(t.id, 16) : null;
}

/** Custo de ataque como ícones de energia (fallback: texto). */
function CostIcons({ cost }: { cost?: string[] }) {
  if (!cost || cost.length === 0) return null;
  return (
    <span className="attack-cost" aria-label={`Custo: ${cost.join(", ")}`}>
      {cost.map((c, i) => {
        const src = iconForEnType(c === "Free" ? "Colorless" : c);
        return src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} width={15} height={15} alt={c} />
        ) : (
          <span key={i} className="small muted">
            {c}
          </span>
        );
      })}
    </span>
  );
}

/** Grade visual do deck com popup de detalhes da carta. */
export function DeckCardsView({ groups }: { groups: DeckViewGroup[] }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<DeckViewItem | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const c = open?.card ?? null;

  return (
    <>
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.key}>
              <h2>
                {g.label}{" "}
                <span className="muted tnum small">
                  {g.items.reduce((a, i) => a + i.quantity, 0)}
                </span>
              </h2>
              <div className="deck-view-grid">
                {g.items.map((item, idx) =>
                  item.card?.imageSmall ? (
                    <button
                      key={`${item.card.id}-${idx}`}
                      type="button"
                      className="deck-view-card as-button"
                      onClick={() => setOpen(item)}
                      title={`${item.quantity}× ${item.card.namePt ?? item.rawName} — clique para detalhes`}
                      aria-label={`Detalhes de ${item.card.namePt ?? item.rawName}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.card.imageSmall} alt={item.rawName} loading="lazy" decoding="async" />
                      {item.quantity > 1 && <span className="qty-badge tnum">×{item.quantity}</span>}
                    </button>
                  ) : (
                    <div key={`${item.rawName}-${idx}`} className="deck-view-card">
                      <span className="deck-view-fallback">{item.rawName}</span>
                      {item.quantity > 1 && <span className="qty-badge tnum">×{item.quantity}</span>}
                    </div>
                  ),
                )}
              </div>
            </section>
          ),
      )}

      <AnimatePresence>
        {open && c && (
          <motion.div
            className="ban-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(null)}
          >
            <motion.div
              className="ban-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Detalhes de ${c.namePt ?? c.name}`}
              initial={reduced ? false : { opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="ghost icon-btn ban-modal-close"
                onClick={() => setOpen(null)}
                aria-label="Fechar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>

              {(c.imageLarge ?? c.imageSmall) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="ban-modal-img" src={c.imageLarge ?? c.imageSmall!} alt={c.namePt ?? c.name} />
              )}

              <div className="ban-modal-info">
                <h3>
                  {c.namePt ?? c.name}
                  {c.namePt && <span className="muted"> · {c.name}</span>}
                </h3>
                <p className="small muted" style={{ margin: "0.2rem 0 0" }}>
                  {c.setName}
                  {c.setPtcgoCode ? ` (${c.setPtcgoCode})` : ""} · nº {c.number}
                  {c.rarity ? ` · ${c.rarity}` : ""}
                </p>

                <div className="flex-row small" style={{ marginTop: "0.55rem", gap: "0.45rem" }}>
                  <span className="chip">
                    {SUPERTYPE_PT[c.supertype] ?? c.supertype}
                    {c.subtypes.length > 0 && ` · ${c.subtypes.join(" · ")}`}
                  </span>
                  {c.hp != null && <span className="chip tnum">{c.hp} HP</span>}
                  {c.types.map((tp) => {
                    const src = iconForEnType(tp);
                    return src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={tp} src={src} width={18} height={18} alt={tp} title={tp} />
                    ) : null;
                  })}
                  <span className="chip tnum">×{open.quantity} no deck</span>
                </div>

                {(c.attacks ?? []).length > 0 && (
                  <div style={{ marginTop: "0.9rem" }}>
                    {c.attacks!.map((a, i) => (
                      <div key={i} className="card-attack">
                        <div className="flex-row" style={{ gap: "0.45rem" }}>
                          <CostIcons cost={a.cost} />
                          <strong>{a.name}</strong>
                          {a.damage && <span className="tnum muted">{a.damage}</span>}
                        </div>
                        {a.text && <p className="small">{a.text}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {c.rules.length > 0 && c.supertype !== "Pokémon" && (
                  <div style={{ marginTop: "0.9rem" }}>
                    {c.rules
                      .filter((r) => !/^you may play|^this card stays/i.test(r))
                      .map((r, i) => (
                        <p key={i} className="small" style={{ marginTop: i === 0 ? 0 : "0.4rem" }}>
                          {r}
                        </p>
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
