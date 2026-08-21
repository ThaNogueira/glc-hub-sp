"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export type BanItem = {
  name: string;
  namePt: string | null;
  imageSmall: string | null;
  imageLarge: string | null;
  printLabel: string;
  onlySpecificPrint: boolean;
  bannedAt: string; // DD/MM/AAAA
  reasonPt: string;
};

/** Galeria da banlist: grid de cartas; clique abre a arte grande + motivo. */
export function BanlistGallery({ items }: { items: BanItem[] }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<BanItem | null>(null);

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

  return (
    <>
      <div className="ban-grid">
        {items.map((item, i) => (
          <motion.button
            key={item.name}
            type="button"
            className="ban-card"
            onClick={() => setOpen(item)}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
            aria-label={`${item.namePt ?? item.name} — ver motivo do ban`}
          >
            {item.imageSmall ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageSmall} alt={item.namePt ?? item.name} loading="lazy" decoding="async" />
            ) : (
              <span className="deck-view-fallback">{item.name}</span>
            )}
            <span className="ban-stamp">BANIDA</span>
            <span className="ban-date tnum">{item.bannedAt}</span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {open && (
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
              aria-label={`Por que ${open.namePt ?? open.name} foi banida`}
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

              {open.imageLarge && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="ban-modal-img" src={open.imageLarge} alt={open.namePt ?? open.name} />
              )}

              <div className="ban-modal-info">
                <h3>
                  {open.namePt ?? open.name}
                  {open.namePt && <span className="muted"> · {open.name}</span>}
                </h3>
                <p className="small muted" style={{ margin: "0.2rem 0 0" }}>
                  {open.printLabel}
                  {open.onlySpecificPrint && " — só esta impressão é banida"}
                </p>
                <p className="small" style={{ margin: "0.5rem 0 0" }}>
                  <span className="chip warn">banida desde {open.bannedAt}</span>
                </p>
                <p style={{ marginTop: "0.9rem" }}>{open.reasonPt}</p>
                <p className="small muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
                  Detalhes e artigos do comitê:{" "}
                  <a
                    href="https://gymleaderchallenge.com/ban-list"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ban list oficial
                  </a>
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
