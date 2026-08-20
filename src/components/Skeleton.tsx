/** Blocos de skeleton para loading states (nunca spinner genérico). */
export function Skeleton({
  height = "0.9rem",
  width = "100%",
  style,
}: {
  height?: string | number;
  width?: string | number;
  style?: React.CSSProperties;
}) {
  return <div className="skeleton" style={{ height, width, ...style }} aria-hidden="true" />;
}

export function SkeletonTable({ rows = 8, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap" style={{ padding: "0.75rem" }}>
      <div style={{ display: "grid", gap: "0.6rem" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: "0.75rem" }}>
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} width={j === 0 ? "30%" : `${Math.max(10, 22 - j * 4)}%`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonPage({ title = true }: { title?: boolean }) {
  return (
    <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
      {title && <Skeleton height="2rem" width="40%" />}
      <Skeleton height="0.9rem" width="60%" />
      <div className="stat-row">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height="4.2rem" />
        ))}
      </div>
      <SkeletonTable />
    </div>
  );
}
