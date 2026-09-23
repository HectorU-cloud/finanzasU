export function SkeletonLine({ width = "100%", height = "16px", className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{
        width,
        height,
        background: "var(--surface-alt)",
      }}
    />
  );
}

export function SkeletonCard({ className = "" }) {
  return (
    <div
      className={`rounded-2xl p-4 shadow-sm ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl animate-pulse"
          style={{ background: "var(--surface-alt)" }}
        />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="60%" height="14px" />
          <SkeletonLine width="40%" height="11px" />
        </div>
        <SkeletonLine width="60px" height="14px" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3, variant = "card" }) {
  if (variant === "card") {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (variant === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl p-4 shadow-sm space-y-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <SkeletonLine width="40%" height="32px" />
            <SkeletonLine width="80%" height="14px" />
            <SkeletonLine width="60%" height="11px" />
            <SkeletonLine width="100%" height="8px" />
          </div>
        ))}
      </div>
    );
  }

  return null;
}