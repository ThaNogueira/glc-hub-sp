"use client";

import { useEffect, useRef, useState } from "react";

/** Input de jogador com autocomplete da base (datalist nativo — leve e acessível). */
export function PlayerAutocomplete({ name, id = "player-ac" }: { name: string; id?: string }) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) {
      setOptions([]);
      return;
    }
    const mySeq = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(q.trim())}`);
        const data = (await res.json()) as { players: { name: string }[] };
        if (mySeq === seq.current) setOptions(data.players.map((p) => p.name));
      } catch {}
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <input
        type="text"
        name={name}
        list={id}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nome do vencedor"
        required
        minLength={2}
        autoComplete="off"
      />
      <datalist id={id}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
