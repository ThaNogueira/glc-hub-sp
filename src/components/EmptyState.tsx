/** Empty state ilustrado com o tema de ginásio (pokébola/escudo apagados). */
export function EmptyState({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
        <circle cx="44" cy="44" r="34" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M10 44 H33" stroke="currentColor" strokeWidth="3" />
        <path d="M55 44 H78" stroke="currentColor" strokeWidth="3" />
        <circle cx="44" cy="44" r="11" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="44" cy="44" r="4" fill="currentColor" />
        <path
          d="M62 14 l5 5 M67 14 l-5 5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {children}
    </div>
  );
}
