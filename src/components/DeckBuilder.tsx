"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { PokemonType } from "@prisma/client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  categoryOf,
  deckStats,
  exportDeckText,
  validateDeck,
  type DeckEntry,
  type GlcCard,
} from "@/lib/glc";
import { TYPES, TYPE_BY_ID, typeIconSrc } from "@/lib/types";
import {
  parseDeckTextAction,
  parseDeckUrlAction,
  saveDeckAction,
  type SaveDeckPayload,
} from "@/app/decks/actions";

export type BuilderInitial = {
  deckId?: string;
  title: string;
  type: PokemonType | "";
  guide: string;
  coverCardId: string | null;
  isPublic: boolean;
  entries: { card: GlcCard; quantity: number }[];
};

type SetOption = { id: string; name: string };

const CATEGORY_LABEL = { POKEMON: "Pokémon", TRAINER: "Treinadores", ENERGY: "Energias" } as const;
const SUBTYPE_OPTIONS = ["Item", "Supporter", "Pokémon Tool", "Stadium", "Basic", "Stage 1", "Stage 2"];

export function DeckBuilder({ initial, sets }: { initial: BuilderInitial; sets: SetOption[] }) {
  const reduced = useReducedMotion();
  const [entries, setEntries] = useState<DeckEntry[]>(initial.entries);
  const [title, setTitle] = useState(initial.title);
  const [declaredType, setDeclaredType] = useState<PokemonType | "">(initial.type);
  const [guide, setGuide] = useState(initial.guide);
  const [coverCardId, setCoverCardId] = useState<string | null>(initial.coverCardId);
  const [changelog, setChangelog] = useState("");
  const [tab, setTab] = useState<"search" | "deck">("deck");
  const [flash, setFlash] = useState<{ msg: string; key: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // busca
  const [q, setQ] = useState("");
  const [fType, setFType] = useState("");
  const [fSupertype, setFSupertype] = useState("");
  const [fSubtype, setFSubtype] = useState("");
  const [fSet, setFSet] = useState("");
  const [results, setResults] = useState<GlcCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [zoom, setZoom] = useState<{ card: GlcCard; x: number; y: number } | null>(null);
  const searchSeq = useRef(0);

  // import/export
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, startImporting] = useTransition();
  const [copied, setCopied] = useState(false);

  const validation = useMemo(
    () => validateDeck(entries, declaredType || null),
    [entries, declaredType],
  );
  const stats = useMemo(() => deckStats(entries), [entries]);
  const count = validation.count;

  const flashMsg = useCallback((msg: string) => setFlash({ msg, key: Date.now() }), []);

  // ---------------------------------------------------------------- busca
  useEffect(() => {
    const hasFilter = fType || fSupertype || fSubtype || fSet;
    if (q.trim().length < 2 && !hasFilter) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (q.trim().length >= 2) params.set("q", q.trim());
        if (fType) params.set("type", fType);
        if (fSupertype) params.set("supertype", fSupertype);
        if (fSubtype) params.set("subtype", fSubtype);
        if (fSet) params.set("set", fSet);
        params.set("limit", "42");
        const res = await fetch(`/api/cards/search?${params}`);
        const data = (await res.json()) as { cards: GlcCard[] };
        if (seq === searchSeq.current) setResults(data.cards ?? []);
      } catch {
        if (seq === searchSeq.current) setResults([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, fType, fSupertype, fSubtype, fSet]);

  // ---------------------------------------------------------------- deck ops
  const isIllegal = (card: GlcCard) =>
    card.banned || card.hasRuleBox || card.isAceSpec || !card.glcLegal;

  function illegalReason(card: GlcCard): string {
    if (card.banned) return "banida no GLC";
    if (card.hasRuleBox) return "Rule Box";
    if (card.isAceSpec) return "ACE SPEC";
    if (!card.glcLegal) return "fora do pool BW+";
    return "";
  }

  function addCard(card: GlcCard) {
    if (isIllegal(card)) {
      flashMsg(`"${card.name}" é proibida no GLC (${illegalReason(card)}).`);
      return;
    }
    setEntries((prev) => {
      const idx = prev.findIndex(
        (e) => e.card.name.toLowerCase() === card.name.toLowerCase(),
      );
      if (idx >= 0) {
        if (prev[idx].card.isBasicEnergy) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          return next;
        }
        flashMsg(`Singleton: "${card.name}" já está no deck.`);
        return prev;
      }
      return [...prev, { card, quantity: 1 }];
    });
  }

  function setQty(cardId: string, qty: number) {
    setEntries((prev) =>
      qty <= 0
        ? prev.filter((e) => e.card.id !== cardId)
        : prev.map((e) => (e.card.id === cardId ? { ...e, quantity: Math.min(qty, 60) } : e)),
    );
    if (coverCardId === cardId && qty <= 0) setCoverCardId(null);
  }

  // ---------------------------------------------------------------- import/export
  function mergeImported(imported: { card: GlcCard; quantity: number }[], unresolved: string[]) {
    if (imported.length === 0) {
      setImportMsg("Nenhuma carta reconhecida.");
      return;
    }
    if (entries.length > 0 && !window.confirm("Substituir a lista atual pela importada?")) return;
    setEntries(imported);
    setCoverCardId(null);
    setImportMsg(
      unresolved.length > 0
        ? `Importado com ${unresolved.length} linha(s) não reconhecida(s):\n${unresolved.slice(0, 8).join("\n")}`
        : `Lista importada: ${imported.reduce((a, e) => a + e.quantity, 0)} cartas.`,
    );
    setShowImport(false);
    setTab("deck");
  }

  function doImportText() {
    setImportMsg(null);
    startImporting(async () => {
      const res = await parseDeckTextAction(importText);
      mergeImported(res.entries, res.unresolved);
    });
  }

  function doImportUrl() {
    setImportMsg(null);
    startImporting(async () => {
      const res = await parseDeckUrlAction(importUrl);
      if (res.error) {
        setImportMsg(res.error);
        return;
      }
      mergeImported(res.entries, res.unresolved);
    });
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportDeckText(entries));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* textarea visível permite copiar manualmente */
    }
  }

  // ---------------------------------------------------------------- salvar
  function save(publish: boolean) {
    setSaveError(null);
    const payload: SaveDeckPayload = {
      deckId: initial.deckId,
      title,
      type: declaredType || null,
      guide,
      coverCardId,
      publish,
      changelog,
      entries: entries.map((e) => ({ cardId: e.card.id, quantity: e.quantity })),
    };
    startSaving(async () => {
      const res = await saveDeckAction(JSON.stringify(payload));
      if (res?.error) setSaveError(res.error);
      // sucesso = redirect do server action
    });
  }

  // ---------------------------------------------------------------- render
  const groups = (["POKEMON", "TRAINER", "ENERGY"] as const).map((cat) => ({
    cat,
    items: entries
      .filter((e) => categoryOf(e.card) === cat)
      .sort((a, b) => a.card.name.localeCompare(b.card.name)),
  }));

  const problemNames = new Set(
    validation.issues.filter((i) => i.cardName).map((i) => i.cardName!.toLowerCase()),
  );

  const R = 26;
  const CIRC = 2 * Math.PI * R;
  const ringColor = count === 60 ? "var(--ok)" : count > 60 ? "var(--err)" : "var(--accent)";

  return (
    <div>
      {/* cabeçalho: título, tipo, anel 60/60, salvar */}
      <div className="panel builder-head">
        <div className="flex-row" style={{ flex: 1, minWidth: 260 }}>
          <div className="ring-wrap" aria-label={`${count} de 60 cartas`}>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle className="ring-track" cx="32" cy="32" r={R} />
              <circle
                className="ring-value"
                cx="32"
                cy="32"
                r={R}
                stroke={ringColor}
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - Math.min(count, 60) / 60)}
              />
            </svg>
            <span className="ring-label">{count}</span>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nome do deck (ex.: Lutador Regirock Control)"
              style={{ width: "100%", fontSize: "1.05rem", fontWeight: 600 }}
              maxLength={80}
              aria-label="Nome do deck"
            />
            <div className="flex-row" style={{ marginTop: "0.4rem" }}>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: "0.4rem" }}>
                Tipo
                <select
                  value={declaredType}
                  onChange={(e) => setDeclaredType(e.target.value as PokemonType | "")}
                  aria-label="Tipo do deck"
                >
                  <option value="">automático (1º Pokémon)</option>
                  {TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.pt}
                    </option>
                  ))}
                </select>
              </label>
              {validation.deckType && (
                <span
                  className="type-badge"
                  style={{ ["--tb-color" as string]: `var(${TYPE_BY_ID[validation.deckType].cssVar})` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={typeIconSrc(validation.deckType, 16)} width={16} height={16} alt="" />
                  {TYPE_BY_ID[validation.deckType].pt}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gap: "0.4rem", minWidth: 200 }}>
          {initial.deckId && (
            <input
              type="text"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="Changelog desta versão (opcional)"
              maxLength={300}
            />
          )}
          <div className="flex-row">
            <button type="button" className="secondary" disabled={saving} onClick={() => save(false)}>
              {saving ? "Salvando…" : "Salvar rascunho"}
            </button>
            <button type="button" disabled={saving || !validation.ok} onClick={() => save(true)}>
              Publicar
            </button>
          </div>
          {!validation.ok && (
            <span className="small muted">publicação exige deck 60/60 válido</span>
          )}
          {saveError && <span className="form-msg err">{saveError}</span>}
        </div>
      </div>

      {/* abas mobile */}
      <div className="builder-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "search"}
          onClick={() => setTab("search")}
        >
          Buscar cartas
        </button>
        <button type="button" role="tab" aria-selected={tab === "deck"} onClick={() => setTab("deck")}>
          Deck ({count})
        </button>
      </div>

      <div className="builder-layout">
        {/* ------------------------------------------------ busca */}
        <section className={`builder-pane${tab === "search" ? " active" : ""}`} aria-label="Busca de cartas">
          <div className="panel" style={{ marginTop: 0 }}>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar carta… (ex.: pidgeot, rare candy)"
              style={{ width: "100%" }}
              aria-label="Buscar carta"
              autoFocus
            />
            <div className="flex-row" style={{ marginTop: "0.5rem" }}>
              <select value={fSupertype} onChange={(e) => setFSupertype(e.target.value)} aria-label="Categoria">
                <option value="">Categoria</option>
                <option value="Pokémon">Pokémon</option>
                <option value="Trainer">Treinador</option>
                <option value="Energy">Energia</option>
              </select>
              <select value={fType} onChange={(e) => setFType(e.target.value)} aria-label="Tipo">
                <option value="">Tipo</option>
                {TYPES.map((t) => (
                  <option key={t.id} value={t.en}>
                    {t.pt}
                  </option>
                ))}
              </select>
              <select value={fSubtype} onChange={(e) => setFSubtype(e.target.value)} aria-label="Subtipo">
                <option value="">Subtipo</option>
                {SUBTYPE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select value={fSet} onChange={(e) => setFSet(e.target.value)} aria-label="Coleção" style={{ maxWidth: 180 }}>
                <option value="">Coleção</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: "0.75rem", minHeight: 120 }}>
              {searching && (
                <div className="card-results" aria-hidden="true">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ aspectRatio: "63/88" }} />
                  ))}
                </div>
              )}
              {!searching && results.length === 0 && (q.trim().length >= 2 || fType || fSupertype || fSubtype || fSet) && (
                <p className="muted small">Nenhuma carta encontrada — a liga está vazia hoje.</p>
              )}
              {!searching && results.length === 0 && q.trim().length < 2 && !fType && !fSupertype && !fSubtype && !fSet && (
                <p className="muted small">
                  Digite pelo menos 2 letras ou use os filtros. A busca roda na base local
                  (pokemon-tcg-data) e cada nome aparece uma vez — no GLC a carta é o nome.
                </p>
              )}
              <div className="card-results">
                {!searching &&
                  results.map((card) => {
                    const illegal = isIllegal(card);
                    return (
                      <button
                        key={card.id}
                        type="button"
                        className={`card-thumb${illegal ? " illegal" : ""}`}
                        onClick={() => addCard(card)}
                        onMouseEnter={(ev) =>
                          setZoom({ card, x: ev.clientX, y: ev.clientY })
                        }
                        onMouseMove={(ev) => setZoom((z) => (z ? { ...z, x: ev.clientX, y: ev.clientY } : z))}
                        onMouseLeave={() => setZoom(null)}
                        title={`${card.name} · ${card.setName}${illegal ? ` — ${illegalReason(card)}` : ""}`}
                        aria-label={`Adicionar ${card.name}`}
                      >
                        {illegal && <span className="flag">{illegalReason(card)}</span>}
                        {card.imageSmall ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={card.imageSmall} alt={card.name} loading="lazy" decoding="async" />
                        ) : (
                          <span
                            className="skeleton"
                            style={{ aspectRatio: "63/88", display: "block", animation: "none" }}
                          >
                            <span className="small" style={{ padding: 4, display: "block" }}>{card.name}</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ deck em construção */}
        <section className={`builder-pane${tab === "deck" ? " active" : ""}`} aria-label="Deck em construção">
          {/* validação sempre visível */}
          <div className="validation-panel" style={{ marginBottom: "0.75rem" }} aria-live="polite">
            {validation.ok ? (
              <div className="v-line ok">✓ Deck válido para GLC — 60 cartas, singleton, mono-tipo.</div>
            ) : validation.issues.length === 0 ? (
              <div className="v-line">Monte seu deck: 60 cartas, singleton, mono-tipo, sem Rule Box.</div>
            ) : (
              validation.issues.slice(0, 8).map((issue, i) => (
                <div key={i} className={`v-line ${issue.level === "error" ? "err" : "warn"}`}>
                  {issue.level === "error" ? "✕" : "△"} {issue.message}
                </div>
              ))
            )}
            <AnimatePresence>
              {flash && (
                <motion.div
                  key={flash.key}
                  className="v-line err shake"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  ✕ {flash.msg}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* estatísticas ao vivo */}
          <div className="panel" style={{ marginTop: 0, padding: "0.7rem 0.9rem" }}>
            <div className="flex-row small" style={{ gap: "0.9rem" }}>
              <span>
                <strong className="tnum">{stats.pokemon}</strong> Pokémon
              </span>
              <span>
                <strong className="tnum">{stats.trainer}</strong> Treinadores
              </span>
              <span>
                <strong className="tnum">{stats.energy}</strong> Energias
              </span>
            </div>
            {count > 0 && (
              <div className="stack-bar" aria-hidden="true">
                <span style={{ width: `${(stats.pokemon / count) * 100}%`, background: "var(--type-fighting)" }} />
                <span style={{ width: `${(stats.trainer / count) * 100}%`, background: "var(--type-water)" }} />
                <span style={{ width: `${(stats.energy / count) * 100}%`, background: "var(--type-lightning)" }} />
              </div>
            )}
            <div className="flex-row small" style={{ marginTop: "0.5rem", gap: "0.9rem" }}>
              <span title="Cartas que compram (draw)">
                🃏 draw <strong className="tnum">{stats.draw}</strong>
              </span>
              <span title="Cartas que buscam no deck (search)">
                🔍 search <strong className="tnum">{stats.search}</strong>
              </span>
              <span title="Cartas que recuperam do descarte (recovery)">
                ♻️ recovery <strong className="tnum">{stats.recovery}</strong>
              </span>
              {stats.pokemon > 0 && (
                <span className="curve-bars" title="Curva: custo mínimo de ataque dos Pokémon">
                  curva{" "}
                  {stats.curve.map((v, i) => (
                    <span key={i} className="curve-col">
                      <span
                        className="curve-fill"
                        style={{ height: `${Math.min(100, (v / Math.max(1, stats.pokemon)) * 220)}%` }}
                      />
                      <span className="curve-label">{i === 5 ? "5+" : i}</span>
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>

          {/* import / export */}
          <div className="flex-row" style={{ margin: "0.75rem 0" }}>
            <button type="button" className="secondary small" onClick={() => { setShowImport((v) => !v); setShowExport(false); }}>
              Importar lista
            </button>
            <button
              type="button"
              className="secondary small"
              onClick={() => { setShowExport((v) => !v); setShowImport(false); }}
              disabled={entries.length === 0}
            >
              Exportar
            </button>
          </div>

          {showImport && (
            <div className="panel" style={{ marginTop: 0 }}>
              <label className="field">
                Cole a lista (formato TCG Live / Limitless)
                <textarea
                  rows={6}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={"Pokémon: 12\n1 Pidgey MEW 16\n1 Pidgeotto MEW 17\n..."}
                />
              </label>
              <div className="flex-row" style={{ marginTop: "0.5rem" }}>
                <button type="button" className="small" disabled={importing || !importText.trim()} onClick={doImportText}>
                  {importing ? "Resolvendo…" : "Importar texto"}
                </button>
              </div>
              <label className="field" style={{ marginTop: "0.75rem" }}>
                Ou link do Limitless / Cardboard Warriors
                <input
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://limitlesstcg.com/decks/list/..."
                />
              </label>
              <div className="flex-row" style={{ marginTop: "0.5rem" }}>
                <button type="button" className="small secondary" disabled={importing || !importUrl.trim()} onClick={doImportUrl}>
                  {importing ? "Baixando…" : "Importar do link"}
                </button>
              </div>
              {importMsg && (
                <p className="form-msg err small" style={{ whiteSpace: "pre-line", marginTop: "0.5rem" }}>
                  {importMsg}
                </p>
              )}
            </div>
          )}
          {importMsg && !showImport && (
            <p className="form-msg ok small" style={{ whiteSpace: "pre-line" }}>
              {importMsg}
            </p>
          )}

          {showExport && (
            <div className="panel" style={{ marginTop: 0 }}>
              <textarea rows={8} readOnly value={exportDeckText(entries)} style={{ width: "100%" }} />
              <div className="flex-row" style={{ marginTop: "0.5rem" }}>
                <button type="button" className="small" onClick={copyExport}>
                  {copied ? "Copiado ✓" : "Copiar para o clipboard"}
                </button>
              </div>
            </div>
          )}

          {/* lista do deck */}
          {entries.length === 0 ? (
            <p className="muted small">
              O deck está vazio — busque cartas ao lado (ou acima, no celular) e clique para
              adicionar.
            </p>
          ) : (
            groups.map(
              (g) =>
                g.items.length > 0 && (
                  <div key={g.cat} className="deck-list-group">
                    <h4>
                      {CATEGORY_LABEL[g.cat]}
                      <span className="tnum">{g.items.reduce((a, e) => a + e.quantity, 0)}</span>
                    </h4>
                    <AnimatePresence initial={false}>
                      {g.items.map((e) => {
                        const problem = problemNames.has(e.card.name.toLowerCase());
                        return (
                          <motion.div
                            key={e.card.id}
                            className={`deck-line${problem ? " problem" : ""}`}
                            initial={reduced ? false : { opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={reduced ? undefined : { opacity: 0, x: 10 }}
                            transition={{ duration: 0.18 }}
                            layout={!reduced}
                          >
                            <span className="qty">{e.quantity}×</span>
                            <span
                              className="nm"
                              onMouseEnter={(ev) => setZoom({ card: e.card, x: ev.clientX, y: ev.clientY })}
                              onMouseMove={(ev) => setZoom((z) => (z ? { ...z, x: ev.clientX, y: ev.clientY } : z))}
                              onMouseLeave={() => setZoom(null)}
                            >
                              {e.card.name}{" "}
                              <span className="muted small">
                                {e.card.setPtcgoCode ?? e.card.setName} {e.card.number}
                              </span>
                            </span>
                            {e.card.isBasicEnergy && (
                              <>
                                <button type="button" className="ghost small" onClick={() => setQty(e.card.id, e.quantity - 1)} aria-label={`Remover uma ${e.card.name}`}>
                                  −
                                </button>
                                <button type="button" className="ghost small" onClick={() => setQty(e.card.id, e.quantity + 1)} aria-label={`Adicionar uma ${e.card.name}`}>
                                  +
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className="ghost small"
                              onClick={() => setCoverCardId(coverCardId === e.card.id ? null : e.card.id)}
                              title={coverCardId === e.card.id ? "Carta-capa do deck" : "Definir como carta-capa"}
                              aria-label={`Definir ${e.card.name} como capa`}
                              style={coverCardId === e.card.id ? { opacity: 1, color: "var(--warn)" } : undefined}
                            >
                              {coverCardId === e.card.id ? "★" : "☆"}
                            </button>
                            {!e.card.isBasicEnergy && (
                              <button type="button" className="ghost small" onClick={() => setQty(e.card.id, 0)} aria-label={`Remover ${e.card.name}`}>
                                ✕
                              </button>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                ),
            )
          )}

          {/* guia */}
          <div className="deck-list-group" style={{ marginTop: "1rem" }}>
            <h4>Guia do deck (markdown, opcional)</h4>
            <textarea
              rows={5}
              value={guide}
              onChange={(e) => setGuide(e.target.value)}
              placeholder={"## Como jogar\nAbra com..."}
              style={{ width: "100%" }}
            />
          </div>
        </section>
      </div>

      {/* preview ampliado (desktop) */}
      {zoom && (zoom.card.imageLarge || zoom.card.imageSmall) && (
        <div
          className="card-zoom"
          style={{
            left: Math.min(zoom.x + 18, typeof window !== "undefined" ? window.innerWidth - 280 : 0),
            top: Math.max(12, Math.min(zoom.y - 180, typeof window !== "undefined" ? window.innerHeight - 380 : 0)),
          }}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.card.imageLarge ?? zoom.card.imageSmall ?? ""} alt="" />
        </div>
      )}
    </div>
  );
}
