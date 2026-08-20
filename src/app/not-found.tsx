import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state" style={{ padding: "5rem 1rem" }}>
      <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
        <path
          d="M60 8 L104 26 V60 C104 85 85 103 60 112 C35 103 16 85 16 60 V26 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          opacity="0.5"
        />
        <circle cx="60" cy="58" r="17" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.5" />
        <path d="M48 46 L72 70 M72 46 L48 70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      </svg>
      <h3 style={{ fontSize: "1.4rem" }}>404 — este ginásio não existe</h3>
      <p>
        A página que você procura não está no circuito. Talvez o líder tenha se mudado, ou o link
        veio errado do grupo.
      </p>
      <p style={{ marginTop: "1rem" }}>
        <Link href="/" className="btn">
          Voltar ao hub
        </Link>
      </p>
    </div>
  );
}
