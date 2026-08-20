"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copiar lista" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="secondary small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {}
      }}
    >
      {copied ? "Copiado ✓" : label}
    </button>
  );
}
