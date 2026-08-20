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

const SUBTYPE_OPTIONS = ["Item", "Supporter", "Pokémon Tool", "Stadium", "Basic", "Stage 1", "Stage 2"];

/** Grupos detalhados do deck (estilo Limitless): Pokémon · Itens · Apoiadores... */
const GROUPS = [
  { key: "pokemon", label: "Pokémon" },
  { key: "item", label: "Itens" },
  { key: "supporter", label: "Apoiadores" },
  { key: "tool", label: "Ferramentas" },
  { key: "stadium", label: "Estádios" },
  { key: "energy", label: "Energias" },
] as const;
type GroupKey = (typeof GROUPS)[number]["key"];

function groupOf(card: GlcCard): GroupKey {
  const cat = categoryOf(card);
  if (cat === "POKEMON") return "pokemon";
  if (cat === "ENERGY") return "energy";
  if (card.subtypes.includes("Supporter")) return "supporter";
  if (card.subtypes.includes("Pokémon Tool")) return "tool";
  if (card.subtypes.includes("Stadium")) return "stadium";
  return "item";
}

function displayName(card: GlcCard): string {
  return card.namePt ?? card.name;
}

function minAttackCost(card: GlcCard): number {
  const costs = (card.attacks ?? [])
    .map((a) => a.convertedEnergyCost ?? (a.cost?.length ?? 0))
    .filter((c) => Number.isFinite(c));
  return costs.length ? Math.min(...costs) : 99;
}

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

  // drag & drop (reordenação manual)
  const dragId = useRef<string | null>(null);

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
        params.set("limit", "80");
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
  function addCard(card: GlcCard) {
    if (card.banned) {
      flashMsg(`"${displayName(card)}" está banida no GLC.`);
      return;
    }

    // energia básica: mesma arte soma +1; arte nova vira entrada própria
    if (card.isBasicEnergy) {
      const sameArt = entries.some((e) => e.card.id === card.id);
      setEntries((prev) =>
        sameArt
          ? prev.map((e) => (e.card.id === card.id ? { ...e, quantity: e.quantity + 1 } : e))
          : [...prev, { card, quantity: 1 }],
      );
      return;
    }

    const existing = entries.find(
      (e) => e.card.name.toLowerCase() === card.name.toLowerCase(),
    );
    if (existing) {
      if (existing.card.id === card.id) {
        flashMsg(`Singleton: "${displayName(card)}" já está no deck.`);
        return;
      }
      // outra arte da mesma carta → troca a impressão, mantém posição/quantidade
      if (coverCardId === existing.card.id) setCoverCardId(card.id);
      setEntries((prev) =>
        prev.map((e) => (e.card.id === existing.card.id ? { ...e, card } : e)),
      );
      flashMsg(
        `Arte de "${displayName(card)}" trocada para ${card.setPtcgoCode ?? card.setName} ${card.number}.`,
      );
      return;
    }

    setEntries((prev) => [...prev, { card, quantity: 1 }]);
  }

  function setQty(cardId: string, qty: number) {
    setEntries((prev) =>
      qty <= 0
        ? prev.filter((e) => e.card.id !== cardId)
        : prev.map((e) => (e.card.id === cardId ? { ...e, quantity: Math.min(qty, 60) } : e)),
    );
    if (coverCardId === cardId && qty <= 0) setCoverCardId(null);
  }

  /** Move a carta arrastada para a posição da carta alvo (mesmo grupo). */
  function moveCard(fromId: string, toId: string) {
    if (fromId === toId) return;
    setEntries((prev) => {
      const fromIdx = prev.findIndex((e) => e.card.id === fromId);
      const toIdx = prev.findIndex((e) => e.card.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      if (groupOf(prev[fromIdx].card) !== groupOf(prev[toIdx].card)) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }

  function sortEntries(mode: "az" | "cost") {
    const groupIndex = (e: DeckEntry) => GROUPS.findIndex((g) => g.key === groupOf(e.card));
    setEntries((prev) =>
      [...prev].sort((a, b) => {
        const g = groupIndex(a) - groupIndex(b);
        if (g !== 0) return g;
        if (mode === "cost" && groupOf(a.card) === "pokemon") {
          const c = minAttackCost(a.card) - minAttackCost(b.card);
          if (c !== 0) return c;
        }
        return displayName(a.card).localeCompare(displayName(b.card));
      }),
    );
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
  const grouped = GROUPS.map((g) => ({
    ...g,
    items: entries.filter((e) => groupOf(e.card) === g.key), // preserva ordem manual
  }));

  const problemNames = new Set(
    validation.issues.filter((i) => i.cardName).map((i) => i.cardName!.toLowerCase()),
  );

  const R = 26;
  const CIRC = 2 * Math.PI * R;
  const ringColor = count === 60 ? "var(--ok)" : count > 60 ? "var(--err)" : "var(--accent)";

  const showZoom = (card: GlcCard, ev: React.MouseEvent) =>
    setZoom({ card, x: ev.clientX, y: ev.clientY });
  const trackZoom = (ev: React.MouseEvent) =>
    setZoom((z) => (z ? { ...z, x: ev.clientX, y: ev.clientY } : z));

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
          {!validation.ok && <span className="small muted">publicação exige deck 60/60 válido</span>}
          {saveError && <span className="form-msg err">{saveError}</span>}
        </div>
      </div>

      {/* abas mobile */}
      <div className="builder-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "search"} onClick={() => setTab("search")}>
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
              placeholder="Buscar carta em PT ou EN… (ex.: doce raro, rare candy)"
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
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ aspectRatio: "63/88" }} />
                  ))}
                </div>
              )}
              {!searching && results.length === 0 && (q.trim().length >= 2 || fType || fSupertype || fSubtype || fSet) && (
                <p className="muted small">Nenhuma carta encontrada — a liga está vazia hoje.</p>
              )}
              {!searching && results.length === 0 && q.trim().length < 2 && !fType && !fSupertype && !fSubtype && !fSet && (
                <p className="muted small">
                  Digite pelo menos 2 letras (português ou inglês) ou use os filtros. Só aparecem
                  cartas jogáveis no GLC — banidas vêm marcadas.
                </p>
              )}
              <div className="card-results">
                {!searching &&
                  results.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      className={`card-thumb${card.banned ? " illegal" : ""}`}
                      onClick={() => addCard(card)}
                      onMouseEnter={(ev) => showZoom(card, ev)}
                      onMouseMove={trackZoom}
                      onMouseLeave={() => setZoom(null)}
                      title={`${displayName(card)}${card.namePt ? ` (${card.name})` : ""} · ${card.setName}${card.banned ? " — BANIDA" : ""}`}
                      aria-label={`Adicionar ${displayName(card)}`}
                    >
                      {card.banned && <span className="flag">BANIDA</span>}
                      {card.imageSmall ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.imageSmall} alt={displayName(card)} loading="lazy" decoding="async" />
                      ) : (
                        <span className="deck-view-fallback">{displayName(card)}</span>
                      )}
                      <span className="set-tag">
                        {card.setPtcgoCode ?? card.setName.slice(0, 6)} {card.number}
                      </span>
                    </button>
                  ))}
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

          {/* ferramentas: ordenar, importar, exportar */}
          <div className="flex-row" style={{ margin: "0.75rem 0" }}>
            <span className="small muted">Ordenar:</span>
            <button type="button" className="secondary small" onClick={() => sortEntries("az")}>
              A–Z
            </button>
            <button type="button" className="secondary small" onClick={() => sortEntries("cost")}>
              Custo
            </button>
            <span className="small muted hide-sm" title="Arraste as cartas para reordenar dentro do grupo">
              ↔ arraste p/ reordenar
            </span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="secondary small"
              onClick={() => {
                setShowImport((v) => !v);
                setShowExport(false);
              }}
            >
              Importar
            </button>
            <button
              type="button"
              className="secondary small"
              onClick={() => {
                setShowExport((v) => !v);
                setShowImport(false);
              }}
              disabled={entries.length === 0}
            >
              Exportar
            </button>
          </div>

          {showImport && (
            <div className="panel" style={{ marginTop: 0 }}>
              <label className="field">
                Cole a lista (formato TCG Live / Limitless — nomes em PT ou EN)
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

          {/* grid visual do deck (estilo Limitless) */}
          {entries.length === 0 ? (
            <p className="muted small">
              O deck está vazio — busque cartas ao lado (ou acima, no celular) e clique para
              adicionar.
            </p>
          ) : (
            grouped.map(
              (g) =>
                g.items.length > 0 && (
                  <div key={g.key} className="deck-list-group">
                    <h4>
                      {g.label}
                      <span className="tnum">{g.items.reduce((a, e) => a + e.quantity, 0)}</span>
                    </h4>
                    <div className="deck-tiles">
                      <AnimatePresence initial={false}>
                        {g.items.map((e) => {
                          const problem = problemNames.has(e.card.name.toLowerCase());
                          const isCover = coverCardId === e.card.id;
                          return (
                            <motion.div
                              key={e.card.id}
                              layout={!reduced}
                              initial={reduced ? false : { opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={reduced ? undefined : { opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.18 }}
                            >
                              {/* wrapper interno: drag nativo (framer intercepta onDragStart no motion.div) */}
                              <div
                                className={`deck-tile${problem ? " problem" : ""}`}
                                draggable
                                onDragStart={(ev) => {
                                  dragId.current = e.card.id;
                                  ev.dataTransfer.setData("text/plain", e.card.id);
                                  ev.dataTransfer.effectAllowed = "move";
                                }}
                                onDragOver={(ev) => ev.preventDefault()}
                                onDrop={(ev) => {
                                  ev.preventDefault();
                                  if (dragId.current) moveCard(dragId.current, e.card.id);
                                  dragId.current = null;
                                }}
                                onMouseEnter={(ev) => showZoom(e.card, ev)}
                                onMouseMove={trackZoom}
                                onMouseLeave={() => setZoom(null)}
                                title={`${e.quantity}× ${displayName(e.card)}${e.card.namePt ? ` (${e.card.name})` : ""}`}
                              >
                              {e.card.imageSmall ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={e.card.imageSmall} alt={displayName(e.card)} loading="lazy" decoding="async" draggable={false} />
                              ) : (
                                <span className="deck-view-fallback">{displayName(e.card)}</span>
                              )}
                              {e.quantity > 1 && <span className="qty-badge tnum">×{e.quantity}</span>}
                              {isCover && (
                                <span className="cover-star" title="Carta-capa do deck">
                                  ★
                                </span>
                              )}
                              <span className="tile-controls">
                                <button
                                  type="button"
                                  onClick={() => setQty(e.card.id, e.quantity - 1)}
                                  aria-label={`Remover uma ${displayName(e.card)}`}
                                  title="Remover 1"
                                >
                                  −
                                </button>
                                {e.card.isBasicEnergy && (
                                  <button
                                    type="button"
                                    onClick={() => setQty(e.card.id, e.quantity + 1)}
                                    aria-label={`Adicionar uma ${displayName(e.card)}`}
                                    title="Adicionar 1"
                                  >
                                    +
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setCoverCardId(isCover ? null : e.card.id)}
                                  aria-label={`Definir ${displayName(e.card)} como capa`}
                                  title={isCover ? "Remover capa" : "Definir como capa"}
                                  style={isCover ? { color: "var(--warn)" } : undefined}
                                >
                                  {isCover ? "★" : "☆"}
                                </button>
                              </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
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
            top: Math.max(12, Math.min(zoom.y - 190, typeof window !== "undefined" ? window.innerHeight - 420 : 0)),
          }}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.card.imageLarge ?? zoom.card.imageSmall ?? ""} alt="" />
          <span className="card-zoom-caption">
            {displayName(zoom.card)}
            {zoom.card.namePt && <span className="muted"> · {zoom.card.name}</span>}
          </span>
        </div>
      )}
    </div>
  );
}
